import os
import re
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
import requests
from bs4 import BeautifulSoup
from openai import OpenAI
from pypinyin import pinyin, Style
import firebase_admin
from firebase_admin import credentials, firestore

# 1. 初始化台灣時間今日日期
TW_TZ = timezone(timedelta(hours=8))
TODAY_STR = datetime.now(TW_TZ).strftime("%Y-%m-%d")

# 2. 初始化 AI 客戶端 (預設連線 Google Gemini Flash 免費層級，預留一鍵切換 Claude/GPT)
client = OpenAI(
    api_key=os.environ["LLM_API_KEY"],
    base_url=os.environ.get("LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
)
MODEL_NAME = os.environ.get("LLM_MODEL", "gemini-2.0-flash")

# 3. 初始化 Firebase Admin
cred_dict = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
if not firebase_admin._apps:
    cred = credentials.Certificate(cred_dict)
    firebase_admin.initialize_app(cred)
db = firestore.client()

# 4. 台灣標準注音轉換函式 (產出符合 index.html rubyMarkup 規範的標籤)
def to_zhuyin_ruby(text: str) -> str:
    if not text:
        return ""
    result = []
    # 常見宗教與破音字微調對照
    custom_map = {"阿": "ㄚ", "們": "˙ㄇㄣ", "耶": "ㄧㄝ", "和": "ㄏㄜˊ"}
    for char in text:
        if "\u4e00" <= char <= "\u9fff":
            if char in custom_map:
                bopo = custom_map[char]
            else:
                bopo = pinyin(char, style=Style.BOPOMOFO, heteronym=False)[0][0]
            # 確保只保留標準注音符號字元 (ㄅ-ㄩˊˇˋ˙)
            bopo_clean = re.sub(r"[^ㄅ-ㄩˊˇˋ˙]", "", bopo)
            if bopo_clean:
                result.append(f"<ruby>{char}<rt>{bopo_clean}</rt></ruby>")
            else:
                result.append(char)
        else:
            result.append(char)
    return "".join(result)

# 5. 步驟 A：抓取今日靈修進度（優先 Duranno，備用 CGN YouTube）
def fetch_daily_source():
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    
    # 優先來源：台灣《活潑的生命》官網
    try:
        resp = requests.get("https://www.duranno.tw/livinglife/index.php/daily", headers=headers, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        page_text = soup.get_text(" ", strip=True)
        return {
            "source_name": "活潑的生命",
            "video_url": "",
            "raw_text": page_text[:1500]
        }
    except Exception as e:
        print(f"主來源 Duranno 抓取失敗 ({e})，切換至備用 YouTube 頻道...")

    # 備用來源：CGNChinese_活潑的生命 YouTube 頻道
    yt_handle_url = "https://www.youtube.com/@CGNChinese_%E6%B4%BB%E6%BD%91%E7%9A%84%E7%94%9F%E5%91%BD"
    html = requests.get(yt_handle_url, headers=headers, timeout=15).text
    match = re.search(r'"channelId":"(UC[\w-]+)"', html)
    if not match:
        raise RuntimeError("無法取得備用 YouTube 頻道 ID")
    channel_id = match.group(1)
    
    rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    rss_xml = requests.get(rss_url, headers=headers, timeout=15).text
    root = ET.fromstring(rss_xml)
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    latest_entry = root.find("atom:entry", ns)
    title = latest_entry.find("atom:title", ns).text
    link = latest_entry.find("atom:link", ns).attrib["href"]
    return {
        "source_name": "活潑的生命 (YouTube)",
        "video_url": link,
        "raw_text": title
    }

# 6. 步驟 B：用 AI 萃取標準經文座標 & 呼叫信望愛 API 取得一字不差的和合本經文
def get_scripture_data(raw_text: str):
    extract_prompt = f"""
    請從以下文字中萃取出今日聖經經文出處。
    必須回傳純 JSON，格式如下：
    {{"reference": "詩篇 23:1-6", "chineses": "詩", "chap": 23, "sec": "1-6"}}
    注意：chineses 必須是台灣和合本標準單字或雙字簡稱（如：創、出、詩、賽、太、約、羅、啟）。
    文字內容：{raw_text}
    """
    res = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[{"role": "user", "content": extract_prompt}],
        response_format={"type": "json_object"}
    )
    ref_info = json.loads(res.choices[0].message.content)
    
    # 呼叫信望愛聖經 API (和合本 unv)
    fhl_url = "https://bible.fhl.net/json/qb.php"
    params = {
        "chineses": ref_info["chineses"],
        "chap": ref_info["chap"],
        "sec": ref_info["sec"],
        "version": "unv",
        "gb": 0
    }
    bible_resp = requests.get(fhl_url, params=params, timeout=15).json()
    records = bible_resp.get("record", [])
    verses = [{"verse": r["sec"], "text": r["bible_text"].strip()} for r in records]
    
    # 抓取前後各 1 節作為前後文背景
    context_before = ""
    context_after = ""
    if verses:
        first_v = verses[0]["verse"]
        last_v = verses[-1]["verse"]
        if first_v > 1:
            b_resp = requests.get(fhl_url, params={**params, "sec": str(first_v - 1)}, timeout=10).json()
            if b_resp.get("record"):
                r = b_resp["record"][0]
                context_before = f"{ref_info['chineses']} {ref_info['chap']}:{r['sec']}　{r['bible_text'].strip()}"
        a_resp = requests.get(fhl_url, params={**params, "sec": str(last_v + 1)}, timeout=10).json()
        if a_resp.get("record"):
            r = a_resp["record"][0]
            context_after = f"{ref_info['chineses']} {ref_info['chap']}:{r['sec']}　{r['bible_text'].strip()}"

    return {
        "reference": ref_info["reference"],
        "verses": verses,
        "context_before": context_before,
        "context_after": context_after
    }

# 7. 步驟 C：生成成人精簡神學與兒童白話聖經故事
def generate_devotional_content(scripture: dict):
    verses_str = "\n".join([f"{v['verse']}. {v['text']}" for v in scripture["verses"]])
    system_prompt = """
    你是一位精通聖經原文字義、歷史文化背景，且受過正統大公教會神學訓練的基督教靈修編輯，同時也是一位擅長對8歲小女孩說故事的兒童主日學老師。
    請嚴格遵守以下原則：
    1. 【神學準則】僅採用大公教會（使徒信經、尼西亞信經）及正統福音派普遍接受的結論；若經文涉及宗派爭議（如預定論、洗禮、方言恩賜、末世細節），必須用一句話客觀並陳各派共識，不偏頗、不長篇大論。
    2. 【文字精簡】成人版所有說明務必精煉、直指核心，避免八股說教。
    3. 【兒童版】針對8歲小女孩設計，用溫暖、生動、有畫面感的純繁體中文（不要自己加注音，後端程式會自動轉換）解釋經文，並創作一篇獨立的「今日聖經故事」，將神學重點融入故事中。
    4. 【嚴格 JSON 輸出】必須回傳純 JSON，結構完全符合以下鍵值：
    {
      "adult_content": {
        "book_background": "全書背景精簡說明（80~110字）",
        "daily_context": "當日經文歷史與文化背景（100~130字）",
        "theology_points": [
          {
            "title": "神學議題標題（6~12字）",
            "summary": "大公教會正統共識精簡結論（80~110字）",
            "deep_dive_prompt": "給使用者複製貼上給 AI 深入討論的完整第一人稱提問句（約60~80字）"
          }
        ]
      },
      "kids_plain_explanation": "給8歲孩子看的今日經文白話解釋（約60~90字，純中文）",
      "kids_story_title": "今日聖經故事標題（6~12字，純中文）",
      "kids_bible_story": "生動有趣的今日聖經故事，把經文情節與神學道理講給8歲小女孩聽（約180~250字，純中文）",
      "kids_prayer": "簡短溫暖的今日小禱告（約35~50字，純中文）"
    }
    """
    user_prompt = f"今日經文出處：{scripture['reference']}\n經文內容：\n{verses_str}"
    
    res = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        response_format={"type": "json_object"}
    )
    return json.loads(res.choices[0].message.content)

def main():
    print(f"開始執行 {TODAY_STR} 每日 QT 自動化任務...")
    source = fetch_daily_source()
    scripture = get_scripture_data(source["raw_text"])
    ai_data = generate_devotional_content(scripture)
    
    doc_data = {
        "date": TODAY_STR,
        "source_channel": source["source_name"],
        "video_url": source["video_url"],
        "scripture": scripture,
        "adult_content": ai_data["adult_content"],
        "kids_content": {
            "plain_explanation_ruby": to_zhuyin_ruby(ai_data["kids_plain_explanation"]),
            "bible_story_title": ai_data["kids_story_title"],
            "bible_story_title_ruby": to_zhuyin_ruby(ai_data["kids_story_title"]),
            "bible_story_ruby": to_zhuyin_ruby(ai_data["kids_bible_story"]),
            "prayer_ruby": to_zhuyin_ruby(ai_data["kids_prayer"])
        }
    }
    
    db.collection("devotionals").document(TODAY_STR).set(doc_data)
    print(f"成功寫入 Firestore: devotionals/{TODAY_STR} ({scripture['reference']})")

if __name__ == "__main__":
    main()
