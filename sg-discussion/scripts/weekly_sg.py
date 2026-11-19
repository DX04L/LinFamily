import os
import re
import json
import hashlib
import base64
from datetime import datetime, timezone, timedelta
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup
import firebase_admin
from firebase_admin import credentials, firestore

# 1. 初始化 Firebase Admin
cred_dict = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
if not firebase_admin._apps:
    cred = credentials.Certificate(cred_dict)
    firebase_admin.initialize_app(cred)
db = firestore.client()

SOURCE_URL = "https://www.changelife.org.tw/serviceCellGroup.php"
GEMINI_API_ROOT = "https://generativelanguage.googleapis.com/v1beta"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7"
}


def discover_gemini_models(api_key: str) -> list:
    resp = requests.get(f"{GEMINI_API_ROOT}/models?key={api_key}", timeout=20)
    resp.raise_for_status()
    models = resp.json().get("models", [])
    skip_keywords = ["embedding", "imagen", "image", "veo", "tts", "aqa", "bisect", "robotics", "computer-use", "audio", "vision"]
    candidates = []
    for m in models:
        name = m.get("name", "").strip()
        if "generateContent" not in m.get("supportedGenerationMethods", []):
            continue
        lower_name = name.lower()
        if any(k in lower_name for k in skip_keywords):
            continue
        if "gemini" in lower_name:
            candidates.append(name)

    def priority(path: str):
        s = path.lower()
        is_flash = 0 if "flash" in s else 1
        is_lite = 1 if "lite" in s else 0
        m = re.search(r"gemini-(\d+(?:\.\d+)?)", s)
        ver = float(m.group(1)) if m else 0.0
        return (is_flash, is_lite, -ver, s)

    candidates.sort(key=priority)
    return candidates


def extract_date_id(text: str) -> str:
    """從文字中萃取標準日期 ID (YYYY-MM-DD)，作為 Firestore 文件主鍵與排序依據"""
    m = re.search(r"(20\d{2})\s*[./年-]\s*(\d{1,2})\s*[./月-]\s*(\d{1,2})", text)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return f"{y:04d}-{mo:02d}-{d:02d}"
    m2 = re.search(r"(\d{1,2})\s*[./月-]\s*(\d{1,2})\s*(?:日|[-–—~～])", text)
    if m2:
        now = datetime.now(timezone(timedelta(hours=8)))
        mo, d = int(m2.group(1)), int(m2.group(2))
        return f"{now.year:04d}-{mo:02d}-{d:02d}"
    return ""


def fetch_cell_group_items() -> list:
    """抓取江子翠行道會小組教材網頁，解析目前架上的所有週次教材"""
    resp = requests.get(SOURCE_URL, headers=HEADERS, timeout=20)
    resp.encoding = resp.apparent_encoding or "utf-8"
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()

    items = []
    seen_ids = set()

    # 策略 A：尋找網頁中的教材連結（如 PDF 檔或內頁連結）
    links = []
    for a in soup.find_all("a", href=True):
        href = urljoin(SOURCE_URL, a["href"].strip())
        label = " ".join(a.get_text(" ", strip=True).split())
        parent_text = " ".join(a.parent.get_text(" ", strip=True).split()) if a.parent else label
        combined = f"{label} {parent_text}"
        if any(k in combined for k in ["小組", "教材", "WEEK", "Week", "週", "信息", ".pdf", "cell", "Cell"]) or extract_date_id(combined):
            if href not in [x["href"] for x in links] and "serviceCellGroup.php" not in href:
                links.append({"href": href, "label": label, "context": combined[:500]})

    for link in links:
        date_id = extract_date_id(link["context"])
        if not date_id or date_id in seen_ids:
            continue

        raw_content = link["context"]
        pdf_bytes = None
        if link["href"].lower().endswith(".pdf"):
            try:
                pdf_resp = requests.get(link["href"], headers=HEADERS, timeout=25)
                if pdf_resp.ok and len(pdf_resp.content) < 8_000_000:
                    pdf_bytes = pdf_resp.content
            except Exception as e:
                print(f"⚠️ PDF 下載失敗 ({link['href']}): {e}")
        else:
            try:
                sub_resp = requests.get(link["href"], headers=HEADERS, timeout=20)
                sub_resp.encoding = sub_resp.apparent_encoding or "utf-8"
                if sub_resp.ok:
                    sub_soup = BeautifulSoup(sub_resp.text, "html.parser")
                    for t in sub_soup(["script", "style", "nav", "footer"]):
                        t.decompose()
                    body_text = "\n".join(line.strip() for line in sub_soup.get_text("\n").splitlines() if line.strip())
                    if len(body_text) > 100:
                        raw_content = body_text[:12000]
            except Exception as e:
                print(f"⚠️ 內頁讀取失敗 ({link['href']}): {e}")

        seen_ids.add(date_id)
        items.append({
            "date": date_id,
            "source_url": link["href"],
            "raw_text": raw_content,
            "pdf_bytes": pdf_bytes
        })

    # 策略 B：若教材內容直接刊登在主頁面段落/區塊中
    if not items:
        full_text = "\n".join(line.strip() for line in soup.get_text("\n").splitlines() if line.strip())
        date_matches = list(re.finditer(r"(20\d{2}\s*[./年-]\s*\d{1,2}\s*[./月-]\s*\d{1,2}[^\n]*)", full_text))
        if date_matches:
            for idx, m in enumerate(date_matches):
                start = m.start()
                end = date_matches[idx + 1].start() if idx + 1 < len(date_matches) else len(full_text)
                chunk = full_text[start:end].strip()
                date_id = extract_date_id(m.group(1))
                if date_id and date_id not in seen_ids and len(chunk) > 80:
                    seen_ids.add(date_id)
                    items.append({
                        "date": date_id,
                        "source_url": SOURCE_URL,
                        "raw_text": chunk[:12000],
                        "pdf_bytes": None
                    })

    print(f"📋 從官網共偵測到 {len(items)} 份架上小組教材：{[i['date'] for i in items]}")
    return items


def generate_sg_content_with_gemini(item: dict) -> dict:
    """呼叫 Gemini API 將原始小組教材轉化為結構化互動填空、背景註釋與討論引導"""
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("缺少 GEMINI_API_KEY 環境變數")

    prompt = f"""你是「江子翠行道會」的資深牧養同工兼保守福音派聖經學者。
請根據下方抓取到的本週小組牧養教材原始內容，整理並深化為繁體中文（台灣教會慣用語）的互動教材 JSON。

【輸出 JSON 嚴格格式要求（不要包含 ```json 標記）】
{{
  "week_badge": "週次標籤，例如 WEEK 2（若無則依月份推算）",
  "date_range": "日期區間顯示文字，例如 2026/11/10 — 11/15",
  "series_tag": "系列主題標籤，例如 信心 ④（若無則填 主日信息）",
  "title": "本週主日信息標題（例如：亞伯拉罕的信心（下））",
  "main_scripture_ref": "主題經文出處（例如：希伯來書 11:17–19）",
  "main_scripture_key": "主題經文對應下方 bubbles 的 key（例如：main_ref）",
  "paragraphs": [
    "信息內文第 1 段。請忠實保留原信息脈絡並修飾通順。在每段挑選 1~2 個核心神學關鍵詞用 [[blank:答案詞]] 標記（全篇共 5~8 個填空）；在重要經文引用或神學專有名詞處用 [[pop:泡泡key|顯示文字]] 標記，對應下方 bubbles 字典。",
    "信息內文第 2 段..."
  ],
  "bubbles": {{
    "main_ref": {{
      "typeLabel": "主題經文｜和合本",
      "title": "希伯來書 11:17–19",
      "content": "完整和合本經文內容",
      "source": "神學洞見：一句話點出本段經文的核心信息。"
    }},
    "key_2": {{
      "typeLabel": "相關經文｜和合本 或 神學概念",
      "title": "標題或經文出處",
      "content": "完整經文或神學解釋（100-180字）",
      "source": "參考出處或經文細節說明"
    }}
  }},
  "background_blocks": [
    {{
      "title": "一、書卷寫作背景與救贖歷史脈絡",
      "desc": "約 150-220 字，嚴謹的保守福音派釋經背景（可用 <strong> 強調重點）",
      "ref": "參考出處：真實保守派聖經註釋書（如丁道爾、天道、麥克阿瑟等，不確定則寫聖經經文出處）"
    }},
    {{
      "title": "二、核心經文的神學張力與信息焦點",
      "desc": "約 150-220 字解析",
      "ref": "參考出處"
    }},
    {{
      "title": "三、救贖歷史預表與新約應用",
      "desc": "約 150-220 字解析",
      "ref": "參考出處"
    }}
  ],
  "word_studies": [
    {{
      "title": "1. 關鍵詞彙名稱",
      "lang": "希伯來文 / 希臘文原文字根與音譯（若不確定原文拼音可寫：聖經神學關鍵詞）",
      "desc": "約 120-180 字原文詞義與神學深度解析（可用 <strong> 強調）"
    }},
    {{
      "title": "2. 關鍵詞彙名稱",
      "lang": "原文資訊",
      "desc": "解析內容"
    }}
  ],
  "questions": [
    {{
      "question": "小組討論題目 1（優先採用原教材題目，若原教材題目不足則設計 3-4 題由淺入深的破冰、觀察、應用題）",
      "btn_label": "查看本文答案與觀察重點",
      "answer_box": "從主日信息歸納的參考答案（若為開放式生命分享題，此欄位可留空字串 \"\"）",
      "guide": "給小組長的牧養帶領延伸與禱告引導（約 80-130 字，可用 <strong> 強調）"
    }}
  ]
}}

【原始小組教材文字】
{item['raw_text']}
"""

    parts = [{"text": prompt}]
    if item.get("pdf_bytes"):
        parts.append({
            "inlineData": {
                "mimeType": "application/pdf",
                "data": base64.b64encode(item["pdf_bytes"]).decode("ascii")
            }
        })

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.25
        }
    }

    models = discover_gemini_models(api_key)
    if not models:
        raise RuntimeError("找不到可用的 Gemini 模型")

    last_err = None
    for model in models[:6]:
        try:
            resp = requests.post(
                f"{GEMINI_API_ROOT}/{model.lstrip('/')}:generateContent",
                headers={"x-goog-api-key": api_key},
                json=payload,
                timeout=(15, 75)
            )
            if not resp.ok:
                last_err = f"HTTP {resp.status_code}"
                continue
            raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            cleaned = re.sub(r"^```json\s*|\s*```$", "", raw_text)
            parsed = json.loads(cleaned)
            if parsed.get("title") and parsed.get("paragraphs"):
                print(f"✅ [{item['date']}] Gemini 生成成功（模型：{model}）")
                return parsed
        except Exception as e:
            last_err = str(e)
            continue

    raise RuntimeError(f"Gemini 生成失敗：{last_err}")


def sync_firestore(active_items: list):
    """寫入新教材並自動刪除官網已下架的過期教材"""
    if not active_items:
        print("⚠️ 本次未抓到任何有效教材，為避免誤刪資料庫，略過同步。")
        return

    collection = db.collection("sg_discussions")
    existing_docs = {doc.id: doc.to_dict() for doc in collection.stream()}
    active_dates = {item["date"] for item in active_items}

    for item in active_items:
        date_id = item["date"]
        content_hash = hashlib.sha256((item["raw_text"] + str(len(item.get("pdf_bytes") or b""))).encode("utf-8")).hexdigest()[:16]
        old_doc = existing_docs.get(date_id)

        if old_doc and old_doc.get("content_hash") == content_hash and old_doc.get("title"):
            print(f"⏭️ [{date_id}] 內容無變動，保留現有資料：{old_doc.get('title')}")
            continue

        generated = generate_sg_content_with_gemini(item)
        doc_payload = {
            "date": date_id,
            "content_hash": content_hash,
            "source_url": item["source_url"],
            "updated_at": firestore.SERVER_TIMESTAMP,
            **generated
        }
        collection.document(date_id).set(doc_payload)
        print(f"💾 已寫入 Firestore: sg_discussions/{date_id} ({generated.get('title')})")

    # 刪除官網已不存在的過期日期
    expired_dates = set(existing_docs.keys()) - active_dates
    for exp_date in sorted(expired_dates):
        collection.document(exp_date).delete()
        print(f"🗑️ 已刪除過期教材: sg_discussions/{exp_date}")


def main():
    print("🚀 開始執行江子翠行道會小組教材自動抓取與同步...")
    items = fetch_cell_group_items()
    sync_firestore(items)
    print("🎉 小組教材同步作業完成！")


if __name__ == "__main__":
    main()
