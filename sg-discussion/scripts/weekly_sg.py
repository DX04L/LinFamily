import os
import sys
import re
import json
import hashlib
import io
import unicodedata
import zipfile
from xml.etree import ElementTree
from datetime import datetime, timezone, timedelta
from urllib.parse import unquote, urljoin, urlsplit
import requests
from bs4 import BeautifulSoup

SOURCE_URL = "https://www.changelife.org.tw/serviceCellGroup.php"
GEMINI_API_ROOT = "https://generativelanguage.googleapis.com/v1beta"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7"
}


def discover_gemini_models(api_key: str) -> list:
    resp = requests.get(f"{GEMINI_API_ROOT}/models", headers={"x-goog-api-key": api_key}, timeout=20)
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
        return (s != "models/gemini-2.5-flash", is_flash, is_lite, -ver, s)

    candidates.sort(key=priority)
    return candidates


def normalize_title(value):
    value = unicodedata.normalize("NFKC", value)
    return "".join(re.findall(r"[^\W_]+", value)).casefold()


def read_docx(content):
    namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        root = ElementTree.fromstring(archive.read("word/document.xml"))
    paragraphs = [
        "".join(node.text or "" for node in para.iter(namespace + "t")).strip()
        for para in root.iter(namespace + "p")
    ]
    return "\n".join(para for para in paragraphs if para)


def fetch_cell_group_items(now=None):
    now = now or datetime.now(timezone(timedelta(hours=8)))
    resp = requests.get(SOURCE_URL, headers=HEADERS, timeout=25)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.content, "html.parser", from_encoding="utf-8")

    downloads = []
    for table in soup.select("table.download"):
        heading = table.parent.select_one(".title")
        if not heading:
            continue
        cells = table.select("tr td")
        if len(cells) < 4:
            continue
        # 下載表最後一列依序為家庭／社青原版、解答版、學青原版、解答版。
        original, answer = (cell.find("a", href=True) for cell in cells[-4:-2])
        downloads.append((normalize_title(heading.get_text(strip=True)), original, answer))

    items = []
    for row in soup.select("table[data-sheets-root] tr"):
        cells = row.find_all("td", recursive=False)
        if len(cells) != 4:
            continue
        start, separator, end, title = (cell.get_text(" ", strip=True) for cell in cells)
        if separator not in {"-", "–", "—", "~", "～"} or not re.fullmatch(r"\d{1,2}/\d{1,2}", start):
            continue
        month, day = map(int, start.split("/"))
        if month != now.month or "小組暫停" in title:
            continue
        if not re.fullmatch(r"\d{1,2}/\d{1,2}", end):
            raise ValueError(f"{start} 教材的結束日期無法辨識")
        start_date = datetime(now.year, month, day).date()
        em, ed = map(int, end.split("/"))
        end_date = datetime(now.year + (em < month), em, ed).date()
        is_inductive = "歸納法查經" in title
        title_key = normalize_title(title)
        if is_inductive:
            topic = re.sub(r"^歸納法查經\s*【[^】]+】\s*", "", title)
            matches = [original for key, original, _ in downloads
                       if key.startswith(f"{month}月") and key.endswith(normalize_title(topic))]
        else:
            matches = [answer for key, _, answer in downloads if key == title_key]
        if len(matches) != 1 or not matches[0]:
            print(f"⚠️ {start_date} 找不到唯一的{'原版' if is_inductive else '解答版'}：{title}")
            continue
        source_url = urljoin(SOURCE_URL, matches[0]["href"])
        parsed = urlsplit(source_url)
        filename = unquote(parsed.path.rsplit("/", 1)[-1])
        if parsed.scheme != "https" or parsed.hostname != urlsplit(SOURCE_URL).hostname:
            raise ValueError(f"{start_date} 教材連結不在官網")
        if not is_inductive and not filename.startswith(f"{start_date:%y%m%d}-{end_date:%m%d}"):
            raise ValueError(f"{start_date} 與解答版檔名日期不符：{filename}")
        response = requests.get(source_url, headers=HEADERS, timeout=25)
        response.raise_for_status()
        raw_text = read_docx(response.content)
        if not raw_text:
            raise ValueError(f"{start_date} 教材內容為空")
        items.append({
            "date": start_date.isoformat(),
            "date_range": f"{start_date:%Y/%m/%d} — {end_date:%m/%d}",
            "title": title,
            "source_url": source_url,
            "raw_text": raw_text,
            "inductive": is_inductive,
        })
    return items


def generate_sg_content_with_gemini(item: dict) -> dict:
    """呼叫 Gemini API 將原始小組教材轉化為結構化互動填空、背景註釋與討論引導"""
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("缺少 GEMINI_API_KEY 環境變數")

    instructions = (
        "這是歸納法查經：paragraphs 只放原版所列經文，逐節忠實保留原文，勿加填空。"
        "原版討論題逐題保留在 questions，維持原順序。所有題目都要填寫 answer_box 與 guide。"
        "觀察與解釋務必引用本週經文中的節號，不超出本週經文範圍，採福音派普遍接受的讀法。"
        "經文未明說之處不得當作定論。應用題只提供參考方向，不設定唯一答案。"
        if item["inductive"] else
        "以官網家庭／社青解答版為準，忠實保留信息與討論題，所有題目提供參考答案或應用方向與帶領引導。"
    )
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
      "answer_box": "依據經文或信息的參考答案，開放題也必須提供參考方向",
      "guide": "給小組長的牧養帶領延伸與禱告引導（約 80-130 字，可用 <strong> 強調）"
    }}
  ]
}}

【本週特別規則（優先於範例描述）】
{instructions}

【原始小組教材文字】
{item['raw_text']}
"""

    parts = [{"text": prompt}]
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
        payload["generationConfig"].pop("thinkingConfig", None)
        if "gemini-3" in model and "flash" in model:
            payload["generationConfig"]["thinkingConfig"] = {"thinkingLevel": "low"}
        elif "gemini-2.5-flash" in model:
            payload["generationConfig"]["thinkingConfig"] = {"thinkingBudget": 0}
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
            questions = parsed.get("questions")
            if (parsed.get("title") and parsed.get("paragraphs") and questions
                and all(all(str(q.get(key) or "").strip() for key in
                            ("question", "answer_box", "guide")) for q in questions)):
                print(f"✅ [{item['date']}] Gemini 生成成功（模型：{model}）")
                return parsed
            last_err = f"{model} 生成結果缺少必要欄位"
        except Exception as e:
            last_err = str(e)
            continue

    raise RuntimeError(f"Gemini 生成失敗：{last_err}")


def sync_firestore(items):
    from firebase_admin import credentials, firestore, initialize_app

    if not items:
        raise RuntimeError("本月未抓到可匯入的教材")
    initialize_app(credentials.Certificate(json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])))
    db = firestore.client()
    collection = db.collection("sg_discussions")
    batch = db.batch()
    count = 0
    for item in items:
        ref = collection.document(item["date"])
        content_hash = hashlib.sha256(json.dumps(item, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]
        if (ref.get().to_dict() or {}).get("content_hash") == content_hash:
            continue
        generated = generate_sg_content_with_gemini(item)
        batch.set(ref, {
            **generated,
            "date": item["date"],
            "date_range": item["date_range"],
            "title": item["title"],
            "content_hash": content_hash,
            "source_url": item["source_url"],
            "updated_at": firestore.SERVER_TIMESTAMP,
        })
        count += 1
    if count:
        batch.commit()
    print(f"核對 {len(items)} 週，寫入 {count} 週。")


def main():
    items = fetch_cell_group_items()
    for item in items:
        print(f"{item['date_range']} {item['title']} {'原版' if item['inductive'] else '解答版'}")
    if "--check-sources" not in sys.argv:
        sync_firestore(items)


if __name__ == "__main__":
    main()
