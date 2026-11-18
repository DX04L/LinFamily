import os
import re
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
import requests
from bs4 import BeautifulSoup
from pypinyin import pinyin, Style
import firebase_admin
from firebase_admin import credentials, firestore

# 1. 初始化台灣時間今日日期
TW_TZ = timezone(timedelta(hours=8))
TODAY_STR = datetime.now(TW_TZ).strftime("%Y-%m-%d")

# 2. 初始化 Firebase Admin
cred_dict = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
if not firebase_admin._apps:
    cred = credentials.Certificate(cred_dict)
    firebase_admin.initialize_app(cred)
db = firestore.client()

# 66 卷聖經標準名稱對照表：(全名/常見別名) -> (信望愛簡稱, 英文標準書卷名)
BOOK_MAP = {
    "創世記": ("創", "Genesis"), "創": ("創", "Genesis"),
    "出埃及記": ("出", "Exodus"), "出": ("出", "Exodus"),
    "利未記": ("利", "Leviticus"), "利": ("利", "Leviticus"),
    "民數記": ("民", "Numbers"), "民": ("民", "Numbers"),
    "申命記": ("申", "Deuteronomy"), "申": ("申", "Deuteronomy"),
    "約書亞記": ("書", "Joshua"), "書": ("書", "Joshua"),
    "士師記": ("士", "Judges"), "士": ("士", "Judges"),
    "路得記": ("得", "Ruth"), "得": ("得", "Ruth"),
    "撒母耳記上": ("撒上", "1 Samuel"), "撒上": ("撒上", "1 Samuel"),
    "撒母耳記下": ("撒下", "2 Samuel"), "撒下": ("撒下", "2 Samuel"),
    "列王紀上": ("王上", "1 Kings"), "王上": ("王上", "1 Kings"),
    "列王紀下": ("王下", "2 Kings"), "王下": ("王下", "2 Kings"),
    "歷代志上": ("代上", "1 Chronicles"), "代上": ("代上", "1 Chronicles"),
    "歷代志下": ("代下", "2 Chronicles"), "代下": ("代下", "2 Chronicles"),
    "以斯拉記": ("拉", "Ezra"), "拉": ("拉", "Ezra"),
    "尼希米記": ("尼", "Nehemiah"), "尼": ("尼", "Nehemiah"),
    "以斯帖記": ("斯", "Esther"), "斯": ("斯", "Esther"),
    "約伯記": ("伯", "Job"), "伯": ("伯", "Job"),
    "詩篇": ("詩", "Psalm"), "詩": ("詩", "Psalm"),
    "箴言": ("箴", "Proverbs"), "箴": ("箴", "Proverbs"),
    "傳道書": ("傳", "Ecclesiastes"), "傳": ("傳", "Ecclesiastes"),
    "雅歌": ("歌", "Song of Solomon"), "歌": ("歌", "Song of Solomon"),
    "以賽亞書": ("賽", "Isaiah"), "賽": ("賽", "Isaiah"),
    "耶利米書": ("耶", "Jeremiah"), "耶": ("耶", "Jeremiah"),
    "耶利米哀歌": ("哀", "Lamentations"), "哀": ("哀", "Lamentations"),
    "以西結書": ("結", "Ezekiel"), "結": ("結", "Ezekiel"),
    "但以理書": ("但", "Daniel"), "但": ("但", "Daniel"),
    "何西阿書": ("何", "Hosea"), "何": ("何", "Hosea"),
    "約珥書": ("珥", "Joel"), "珥": ("珥", "Joel"),
    "阿摩司書": ("摩", "Amos"), "摩": ("摩", "Amos"),
    "俄巴底亞書": ("俄", "Obadiah"), "俄": ("俄", "Obadiah"),
    "約拿書": ("拿", "Jonah"), "拿": ("拿", "Jonah"),
    "彌迦書": ("彌", "Micah"), "彌": ("彌", "Micah"),
    "那鴻書": ("鴻", "Nahum"), "鴻": ("鴻", "Nahum"),
    "哈巴谷書": ("哈", "Habakkuk"), "哈": ("哈", "Habakkuk"),
    "西番雅書": ("番", "Zephaniah"), "番": ("番", "Zephaniah"),
    "哈該書": ("該", "Haggai"), "該": ("該", "Haggai"),
    "撒迦利亞書": ("亞", "Zechariah"), "亞": ("亞", "Zechariah"),
    "瑪拉基書": ("瑪", "Malachi"), "瑪": ("瑪", "Malachi"),
    "馬太福音": ("太", "Matthew"), "太": ("太", "Matthew"),
    "馬可福音": ("可", "Mark"), "可": ("可", "Mark"),
    "路加福音": ("路", "Luke"), "路": ("路", "Luke"),
    "約翰福音": ("約", "John"), "約": ("約", "John"),
    "使徒行傳": ("徒", "Acts"), "徒": ("徒", "Acts"),
    "羅馬書": ("羅", "Romans"), "羅": ("羅", "Romans"),
    "哥林多前書": ("林前", "1 Corinthians"), "林前": ("林前", "1 Corinthians"),
    "哥林多後書": ("林後", "2 Corinthians"), "林後": ("林後", "2 Corinthians"),
    "加拉太書": ("加", "Galatians"), "加": ("加", "Galatians"),
    "以弗所書": ("弗", "Ephesians"), "弗": ("弗", "Ephesians"),
    "腓立比書": ("腓", "Philippians"), "腓": ("腓", "Philippians"),
    "歌羅西書": ("西", "Colossians"), "西": ("西", "Colossians"),
    "帖撒羅尼迦前書": ("帖前", "1 Thessalonians"), "帖前": ("帖前", "1 Thessalonians"),
    "帖撒羅尼迦後書": ("帖後", "2 Thessalonians"), "帖後": ("帖後", "2 Thessalonians"),
    "提摩太前書": ("提前", "1 Timothy"), "提前": ("提前", "1 Timothy"),
    "提摩太後書": ("提後", "2 Timothy"), "提後": ("提後", "2 Timothy"),
    "提多書": ("多", "Titus"), "多": ("多", "Titus"),
    "腓利門書": ("門", "Philemon"), "門": ("門", "Philemon"),
    "希伯來書": ("來", "Hebrews"), "來": ("來", "Hebrews"),
    "雅各書": ("雅", "James"), "雅": ("雅", "James"),
    "彼得前書": ("彼前", "1 Peter"), "彼前": ("彼前", "1 Peter"),
    "彼得後書": ("彼後", "2 Peter"), "彼後": ("彼後", "2 Peter"),
    "約翰一書": ("約一", "1 John"), "約一": ("約一", "1 John"),
    "約翰二書": ("約二", "2 John"), "約二": ("約二", "2 John"),
    "約翰三書": ("約三", "3 John"), "約三": ("約三", "3 John"),
    "猶大書": ("猶", "Jude"), "猶": ("猶", "Jude"),
    "啟示錄": ("啟", "Revelation"), "啟": ("啟", "Revelation")
}

# 3. 台灣標準注音轉換函式
def to_zhuyin_ruby(text: str) -> str:
    if not text:
        return ""
    result = []
    custom_map = {"阿": "ㄚ", "們": "˙ㄇㄣ", "耶": "ㄧㄝ", "和": "ㄏㄜˊ"}
    for char in text:
        if "\u4e00" <= char <= "\u9fff":
            bopo = custom_map.get(char) or pinyin(char, style=Style.BOPOMOFO, heteronym=False)[0][0]
            bopo_clean = re.sub(r"[^ㄅ-ㄩˊˇˋ˙]", "", bopo)
            if bopo_clean:
                result.append(f"<ruby>{char}<rt>{bopo_clean}</rt></ruby>")
            else:
                result.append(char)
        else:
            result.append(char)
    return "".join(result)

# 4. 正規表示式自動解析經文出處 (免 AI)
def parse_reference_from_text(text: str):
    # 依書卷名稱長度由長到短排序，避免「約翰福音」被「約」先誤抓
    books_sorted = sorted(BOOK_MAP.keys(), key=len, reverse=True)
    books_pattern = "|".join(re.escape(b) for b in books_sorted)
    pattern = rf"({books_pattern})\s*(\d+)\s*[:：]\s*(\d+(?:\s*[-–~]\s*\d+)?)"
    m = re.search(pattern, text)
    if not m:
        raise ValueError(f"無法從網頁文字解析出經文座標，前 200 字：{text[:200]}")
    book_raw = m.group(1)
    chap = int(m.group(2))
    sec = re.sub(r"\s+", "", m.group(3)).replace("–", "-").replace("~", "-")
    chineses, eng_book = BOOK_MAP[book_raw]
    # 取得標準繁體全名
    full_book = next((k for k, v in BOOK_MAP.items() if v[0] == chineses and len(k) > len(chineses)), book_raw)
    return {
        "reference": f"{full_book} {chap}:{sec}",
        "eng_reference": f"{eng_book} {chap}:{sec}",
        "chineses": chineses,
        "chap": chap,
        "sec": sec
    }

# 5. 抓取今日靈修進度（優先 Duranno，備用 CGN YouTube）
def fetch_daily_source():
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    try:
        resp = requests.get("https://www.duranno.tw/livinglife/index.php/daily", headers=headers, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        page_text = soup.get_text(" ", strip=True)
        ref_info = parse_reference_from_text(page_text)
        return {"source_name": "活潑的生命", "video_url": "", "ref_info": ref_info}
    except Exception as e:
        print(f"主來源 Duranno 抓取失敗 ({e})，切換至備用 YouTube 頻道...")

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
    ref_info = parse_reference_from_text(title)
    return {"source_name": "活潑的生命 (YouTube)", "video_url": link, "ref_info": ref_info}

# 6. 從 BibleGateway 抓取英文經文 (NIV 或 NIrV)
def fetch_english_verses(eng_reference: str, version: str) -> dict:
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    url = "https://www.biblegateway.com/passage/"
    try:
        resp = requests.get(url, params={"search": eng_reference, "version": version}, headers=headers, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        passage = soup.select_one(".passage-text")
        if not passage:
            return {}
        # 移除標題、註腳與交叉引用
        for trash in passage.select("h1, h2, h3, h4, .footnotes, .crossrefs, .chapternum, .footnote, .crossreference"):
            trash.decompose()

        verse_map = {}
        current_v = None
        for span in passage.select("span.text"):
            v_num_el = span.select_one("sup.versenum")
            if v_num_el:
                num_str = re.sub(r"\D", "", v_num_el.get_text())
                if num_str:
                    current_v = int(num_str)
                v_num_el.decompose()
            else:
                # 第1節有時沒有 versenum 標籤，從 class 找 (例如 Gen-1-1)
                for cls in span.get("class", []):
                    m = re.match(r"^[A-Za-z0-9]+-\d+-(\d+)$", cls)
                    if m:
                        current_v = int(m.group(1))
                        break
            txt = " ".join(span.get_text(" ", strip=True).split())
            if current_v and txt:
                verse_map[current_v] = (verse_map.get(current_v, "") + " " + txt).strip()
        return verse_map
    except Exception as e:
        print(f"抓取英文 {version} 失敗 ({e})")
        return {}

# 7. 組合中英文經文 (和合本 + 成人NIV + 兒童注音 + 兒童NIrV)
def get_scripture_data(ref_info: dict):
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

    niv_map = fetch_english_verses(ref_info["eng_reference"], "NIV")
    nirv_map = fetch_english_verses(ref_info["eng_reference"], "NIRV")

    verses = []
    for r in records:
        v_num = r["sec"]
        zh_text = r["bible_text"].strip()
        verses.append({
            "verse": v_num,
            "text": zh_text,
            "ruby": to_zhuyin_ruby(zh_text),
            "niv": niv_map.get(v_num, ""),
            "nirv": nirv_map.get(v_num, "")
        })

    # 前後各 1 節
    context_before = ""
    context_after = ""
    if verses:
        first_v = verses[0]["verse"]
        last_v = verses[-1]["verse"]
        if first_v > 1:
            b_resp = requests.get(fhl_url, params={**params, "sec": str(first_v - 1)}, timeout=10).json()
            if b_resp.get("record"):
                r = b_resp["record"][0]
                context_before = f"{ref_info['chineses']} {ref_info['chap']}:{r['sec']} {r['bible_text'].strip()}"
        a_resp = requests.get(fhl_url, params={**params, "sec": str(last_v + 1)}, timeout=10).json()
        if a_resp.get("record"):
            r = a_resp["record"][0]
            context_after = f"{ref_info['chineses']} {ref_info['chap']}:{r['sec']} {r['bible_text'].strip()}"

    return {
        "reference": ref_info["reference"],
        "eng_reference": ref_info["eng_reference"],
        "verses": verses,
        "context_before": context_before,
        "context_after": context_after
    }

def main():
    print(f"開始執行 {TODAY_STR} 每日 QT 經文抓取與注音排版...")
    source = fetch_daily_source()
    ref_info = source["ref_info"]
    print(f"成功解析今日進度：{ref_info['reference']} ({ref_info['eng_reference']})")

    scripture = get_scripture_data(ref_info)

    # 組合無 AI 階段的預設神學探討提問與兒童注音經文
    doc_data = {
        "date": TODAY_STR,
        "source_channel": source["source_name"],
        "video_url": source["video_url"],
        "scripture": scripture,
        "adult_content": {
            "book_background": f"今日靈修進度為《{ref_info['reference']}》（{ref_info['eng_reference']}）。點擊下方按鈕可隨時與 AI 深入探討本段經文的歷史背景與神學意義。",
            "daily_context": "建議先完整閱讀上方和合本與 NIV 英文經文，並展開「查看前後文背景經文」掌握上下文脈絡。",
            "theology_points": [
                {
                    "title": f"{ref_info['reference']} 歷史與神學背景",
                    "summary": "點擊下方按鈕，將自動複製本段經文專屬的神學探討提問，帶您前往 AI 深入研讀。",
                    "deep_dive_prompt": f"我正在研讀聖經《{ref_info['reference']}》（{ref_info['eng_reference']}）。請為我精簡說明這卷書的寫作背景、本段經文的古近東／歷史文化脈絡，以及大公教會正統信仰的核心神學重點。"
                }
            ]
        },
        "kids_content": {
            "plain_explanation_ruby": to_zhuyin_ruby(f"今天我們一起來讀《{ref_info['reference']}》，看看上帝在聖經裡對我們說了什麼話！"),
            "bible_story_title": f"{ref_info['reference']} · 每日經文",
            "bible_story_title_ruby": to_zhuyin_ruby(ref_info["reference"]),
            "bible_story_ruby": "",
            "prayer_ruby": to_zhuyin_ruby("親愛的天父，謝謝你賜給我們寶貴的聖經。求你幫助我明白你的話語，每天喜樂地跟隨你。奉主耶穌的名禱告，阿們。")
        }
    }

    db.collection("devotionals").document(TODAY_STR).set(doc_data)
    print(f"成功寫入 Firestore: devotionals/{TODAY_STR} ({scripture['reference']})")

if __name__ == "__main__":
    main()
