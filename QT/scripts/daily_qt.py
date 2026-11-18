import os
import re
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
import requests
from bs4 import BeautifulSoup
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

# 66 卷聖經標準名稱對照表
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

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7"
}

# 3. 配合 BpmfGenSenRounded 注音字體：輸出純文字並為聖經破音字加上 Unicode 變體選擇器 (IVS)
def to_zhuyin_ruby(text: str) -> str:
    if not text:
        return ""
    # 源泉圓體注音版 IVS 破音字對應（\uE01E1 為第二讀音，\uE01E2 為第三讀音）
    ivs_rules = [
    ("耶和華", "耶和\U000E01E2華"),  # 「和」讀作 ㄏㄜˋ
    ("阿們", "阿\U000E01E1們"),      # 「阿」讀作 ㄚ
    ("什麼", "什\U000E01E1麼"),      # 「什」讀作 ㄕㄣˊ
    ("為甚麼", "為什\U000E01E1麼"),
    ]
    out = text
    for src, dst in ivs_rules:
        out = out.replace(src, dst)
    return out

def parse_reference_from_text(text: str):
    # 過濾掉 Duranno 網站頁首固定的標語金句（阿摩司書 8:11）
    cleaned = re.sub(r"阿摩司書\s*8\s*[:：]\s*11", "", text)

    books_sorted = sorted(BOOK_MAP.keys(), key=len, reverse=True)
    books_pattern = "|".join(re.escape(b) for b in books_sorted)
    pattern = rf"({books_pattern})\s*(\d+)\s*(?:[:：]|章\s*)\s*(\d+(?:\s*[-–~]\s*\d+)?)"
    matches = list(re.finditer(pattern, cleaned))
    if not matches:
        return None

    chosen = next((m for m in matches if "-" in m.group(3) or "–" in m.group(3) or "~" in m.group(3)), matches[0])

    book_raw = chosen.group(1)
    chap = int(chosen.group(2))
    sec = re.sub(r"\s+", "", chosen.group(3)).replace("–", "-").replace("~", "-")
    chineses, eng_book = BOOK_MAP[book_raw]
    full_book = next((k for k, v in BOOK_MAP.items() if v[0] == chineses and len(k) > len(chineses)), book_raw)
    return {
        "reference": f"{full_book} {chap}:{sec}",
        "eng_reference": f"{eng_book} {chap}:{sec}",
        "chineses": chineses,
        "chap": chap,
        "sec": sec
    }

def fetch_duranno():
    try:
        resp = requests.get("https://www.duranno.tw/livinglife/index.php/daily", headers=HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        extra_attrs = " ".join(
            el.get("title", "") + " " + el.get("alt", "") + " " + el.get("content", "")
            for el in soup.find_all(["a", "img", "meta", "div", "span"])
        )
        combined = soup.get_text(" ", strip=True) + " " + extra_attrs
        ref = parse_reference_from_text(combined)
        return ref, None if ref else "Duranno 頁面未解析出經文範圍"
    except Exception as e:
        return None, f"Duranno 連線失敗 ({e})"

def fetch_youtube():
    # 多組頻道 URL 備援，避免單一 handle 頁面改版抓不到 channelId
    urls = [
        "https://www.youtube.com/@CGNChinese_%E6%B4%BB%E6%BD%91%E7%9A%84%E7%94%9F%E5%91%BD/videos",
        "https://www.youtube.com/@CGNChinese/videos"
    ]
    channel_id = None
    for u in urls:
        try:
            html = requests.get(u, headers=HEADERS, timeout=15).text
            m = re.search(r'"channelId":"(UC[\w-]{22})"', html) or re.search(r'channel_id=(UC[\w-]{22})', html)
            if m:
                channel_id = m.group(1)
                break
        except Exception:
            continue

    if not channel_id:
        return None, "", "YouTube 無法取得頻道 ID"

    try:
        rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
        rss_xml = requests.get(rss_url, headers=HEADERS, timeout=15).text
        root = ET.fromstring(rss_xml)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        entries = root.findall("atom:entry", ns)
        if not entries:
            return None, "", "YouTube RSS 無影片紀錄"

        # 優先找標題含今天日期（如 11/18 或 11月18日）或最新一集含經文座標的影片
        month = int(TODAY_STR[5:7])
        day = int(TODAY_STR[8:10])
        date_hints = [f"{month}/{day}", f"{month:02d}/{day:02d}", f"{month}月{day}日", f"{month:02d}{day:02d}"]

        chosen_entry = None
        for entry in entries[:6]:
            t = entry.find("atom:title", ns).text or ""
            if any(h in t for h in date_hints) and parse_reference_from_text(t):
                chosen_entry = entry
                break
        if not chosen_entry:
            for entry in entries[:5]:
                t = entry.find("atom:title", ns).text or ""
                if parse_reference_from_text(t):
                    chosen_entry = entry
                    break

        if not chosen_entry:
            latest_t = entries[0].find("atom:title", ns).text
            return None, "", f"YouTube 最新影片標題無法解析經文：{latest_t}"

        title = chosen_entry.find("atom:title", ns).text
        link = chosen_entry.find("atom:link", ns).attrib["href"]
        return parse_reference_from_text(title), link, None
    except Exception as e:
        return None, "", f"YouTube RSS 讀取失敗 ({e})"

def fetch_and_verify_sources():
    dur_ref, dur_err = fetch_duranno()
    yt_ref, yt_link, yt_err = fetch_youtube()

    print(f"[比對報告] Duranno: {dur_ref['reference'] if dur_ref else dur_err}")
    print(f"[比對報告] YouTube: {yt_ref['reference'] if yt_ref else yt_err}")

    if not dur_ref and not yt_ref:
        raise RuntimeError(f"雙來源皆抓取失敗！Duranno: {dur_err} | YouTube: {yt_err}")

    warning_msg = ""
    if dur_ref and yt_ref:
        if dur_ref["reference"] == yt_ref["reference"]:
            print(f"✅ 雙來源比對完全一致：{dur_ref['reference']}")
            chosen_ref = dur_ref
            source_name = "活潑的生命（官網 & YouTube 驗證一致）"
        else:
            warning_msg = f"⚠️ 經文來源比對不一致：Duranno 官網為「{dur_ref['reference']}」，YouTube 頻道為「{yt_ref['reference']}」，請留意核對。"
            print(f"::warning::{warning_msg}")
            chosen_ref = dur_ref
            source_name = "活潑的生命（來源存在差異）"
    elif dur_ref:
        warning_msg = f"⚠️ 僅抓到 Duranno 官網進度（YouTube 狀態：{yt_err}），未完成交叉比對。"
        print(f"::warning::{warning_msg}")
        chosen_ref = dur_ref
        source_name = "活潑的生命 (Duranno)"
    else:
        warning_msg = f"⚠️ 僅抓到 YouTube 頻道進度（Duranno 狀態：{dur_err}），未完成交叉比對。"
        print(f"::warning::{warning_msg}")
        chosen_ref = yt_ref
        source_name = "活潑的生命 (YouTube)"

    return {
        "source_name": source_name,
        "video_url": yt_link,
        "ref_info": chosen_ref,
        "mismatch_warning": warning_msg
    }

def fetch_english_verses(eng_reference: str, version: str) -> dict:
    headers = {
        **HEADERS,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
    }
    url = "https://www.biblegateway.com/passage/"
    try:
        resp = requests.get(url, params={"search": eng_reference, "version": version}, headers=headers, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        passage = soup.select_one(".passage-text")
        if passage:
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
                    for cls in span.get("class", []):
                        m = re.match(r"^[A-Za-z0-9]+-\d+-(\d+)$", cls)
                        if m:
                            current_v = int(m.group(1))
                            break
                txt = " ".join(span.get_text(" ", strip=True).split())
                if current_v and txt:
                    verse_map[current_v] = (verse_map.get(current_v, "") + " " + txt).strip()
            if verse_map:
                print(f"成功從 BibleGateway 抓取 {version} ({len(verse_map)} 節)")
                return verse_map
    except Exception as e:
        print(f"BibleGateway {version} 抓取失敗 ({e})")

    try:
        api_url = f"https://bible-api.com/{requests.utils.quote(eng_reference)}"
        r = requests.get(api_url, timeout=12).json()
        fallback_map = {}
        for v in r.get("verses", []):
            fallback_map[int(v["verse"])] = " ".join(v["text"].split())
        if fallback_map:
            print(f"已使用備援 API 補上英文經文 ({len(fallback_map)} 節)")
            return fallback_map
    except Exception as e:
        print(f"備援英文 API 失敗 ({e})")
    return {}

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
    print(f"開始執行 {TODAY_STR} 每日 QT 雙來源比對與經文排版...")
    source = fetch_and_verify_sources()
    ref_info = source["ref_info"]

    scripture = get_scripture_data(ref_info)

    doc_data = {
        "date": TODAY_STR,
        "source_channel": source["source_name"],
        "video_url": source["video_url"],
        "mismatch_warning": source["mismatch_warning"],
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
