"""
Script Python để scrape toàn bộ 23 list từ Study4 bằng cách fetch HTML trực tiếp
sử dụng cookie session (không cần Playwright/login).

Chạy TRONG khi đang đăng nhập Study4 trên trình duyệt:
  1. F12 → Application/Storage → Cookies → study4.com
  2. Copy giá trị của cookie 'sessionid' và 'csrftoken'
  3. Điền vào SESSION_ID và CSRF_TOKEN bên dưới
  4. Chạy: python scripts/fetch_all_lists.py
"""
import json, re, time, sys
from pathlib import Path
from html.parser import HTMLParser

# ══════════════════════════════════════════════
#  ĐIỀN SESSION COOKIE VÀO ĐÂY
#  (Lấy từ F12 → Application → Cookies → study4.com)
# ══════════════════════════════════════════════
SESSION_ID = ""   # <-- paste sessionid ở đây
CSRF_TOKEN = ""   # <-- paste csrftoken ở đây

OUT_FILE = Path(__file__).parent.parent / "data" / "words.json"

# List IDs: Study4 Complete TOEIC units 186 = lists 45101-45123 (23 lists)
LIST_BASE   = 45101
LIST_COUNT  = 23

try:
    import requests
except ImportError:
    print("Cài requests: pip install requests")
    sys.exit(1)

try:
    from bs4 import BeautifulSoup
    USE_BS4 = True
except ImportError:
    USE_BS4 = False
    print("Khuyên dùng: pip install beautifulsoup4")


def parse_list_page(html: str, topic: str) -> list:
    """Trích xuất từ vựng từ HTML trang Study4 flashcard list."""
    words = []
    
    if USE_BS4:
        soup = BeautifulSoup(html, 'html.parser')
        items = soup.select('.termlist-item')
        
        for i, item in enumerate(items):
            h2 = item.select_one('h2')
            if not h2: continue
            
            # Lấy từ: clone h2, xóa span
            word_text = h2.get_text(separator=' ').strip()
            # Xóa IPA và type khỏi word text
            for span in h2.find_all('span'):
                word_text = word_text.replace(span.get_text(), '').strip()
            word_text = re.sub(r'\s+', ' ', word_text).strip()
            if not word_text or not re.match(r'^[a-zA-Z]', word_text): continue
            
            # IPA
            ipa  = ''
            wtype = ''
            for span in h2.find_all('span'):
                t = span.get_text().strip()
                if re.match(r'^/.*/$', t): ipa   = t
                elif re.match(r'^\(.*\)$', t): wtype = t[1:-1]
            
            # Nghĩa
            vi, en = '', ''
            prewrap = item.select_one('.prewrap')
            if prewrap:
                lines = [l.strip() for l in prewrap.get_text('\n').split('\n') if l.strip()]
                for line in lines:
                    if line.startswith('='): en = line[1:].strip()
                    elif not vi: vi = line
            
            # Ví dụ
            ex, tr = '', ''
            ex_li = item.select('.termlist-item-examples li')
            if ex_li:
                # Xóa audio buttons
                li_clone = ex_li[0]
                for el in li_clone.select('.jq-audio-player, .jq-audio-btn, button'):
                    el.decompose()
                ex_text = li_clone.get_text().strip()
                m = re.match(r'^(.+?)\s*\(=Dịch:\s*(.+?)\)\s*$', ex_text, re.DOTALL)
                if m:
                    ex = re.sub(r'\[|\]', '', m.group(1)).strip()
                    tr = m.group(2).strip()
                else:
                    ex = re.sub(r'\[|\]', '', ex_text).strip()
            
            words.append({
                'id':          f'w{len(words)+1}',
                'word':        word_text,
                'ipa':         ipa,
                'type':        wtype,
                'meaning':     vi or en,
                'example':     ex,
                'translation': tr,
                'topic':       topic
            })
    else:
        # Fallback: regex parsing
        # Tìm các .termlist-item bằng regex
        items = re.findall(r'class="termlist-item[^"]*".*?</(?:li|div|article)>', html, re.DOTALL)
        for i, item in enumerate(items):
            # Tìm từ trong h2
            h2_m = re.search(r'<h2[^>]*>(.*?)</h2>', item, re.DOTALL)
            if not h2_m: continue
            h2_text = re.sub(r'<[^>]+>', ' ', h2_m.group(1)).strip()
            word = re.sub(r'/[^/]+/|\([^)]+\)|\s+', ' ', h2_text).strip().split()[0]
            if not re.match(r'^[a-zA-Z]', word): continue
            
            # IPA
            ipa_m = re.search(r'(/[^/]{2,30}/)', item)
            ipa   = ipa_m.group(1) if ipa_m else ''
            
            # Meaning
            pw_m  = re.search(r'class="prewrap[^"]*">(.*?)</(?:p|div)', item, re.DOTALL)
            vi    = re.sub(r'<[^>]+>', '', pw_m.group(1)).strip().split('\n')[0] if pw_m else ''
            
            words.append({
                'id': f'w{i+1}', 'word': word, 'ipa': ipa,
                'type': '', 'meaning': vi, 'example': '',
                'translation': '', 'topic': topic
            })
    
    return words


def main():
    if not SESSION_ID:
        print("❌ Chưa điền SESSION_ID!")
        print("   F12 → Application → Cookies → study4.com → copy 'sessionid'")
        sys.exit(1)
    
    cookies = {
        'sessionid': SESSION_ID,
        'csrftoken': CSRF_TOKEN,
    }
    headers = {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        'Referer':         'https://study4.com/',
    }
    
    session = requests.Session()
    session.cookies.update(cookies)
    session.headers.update(headers)
    
    all_words = []
    seen      = set()
    global_id = 1
    
    print("=" * 55)
    print("  STUDY4 Complete TOEIC — Scraper toàn bộ 23 lists")
    print("=" * 55)
    
    for i in range(LIST_COUNT):
        list_id = LIST_BASE + i
        url     = f"https://study4.com/flashcards/lists/{list_id}/"
        
        try:
            resp = session.get(url, timeout=15)
            if resp.status_code == 403:
                print(f"  List {list_id}: 403 Forbidden — sessionid hết hạn?")
                break
            elif resp.status_code != 200:
                print(f"  List {list_id}: HTTP {resp.status_code}")
                continue
            
            # Lấy tên list từ title
            title_m = re.search(r'<title>(.*?)</title>', resp.text)
            title   = title_m.group(1) if title_m else f'List {i+1}'
            topic   = title.replace('| STUDY4', '').replace('Flashcards:', '').strip()
            
            words = parse_list_page(resp.text, topic)
            
            # Dedup
            new_words = []
            for w in words:
                key = w['word'].lower()
                if key not in seen:
                    seen.add(key)
                    w['id'] = f'w{global_id}'
                    global_id += 1
                    new_words.append(w)
            
            all_words.extend(new_words)
            print(f"  [{i+1:02d}/23] List {list_id} ({topic[:30]}): {len(new_words)} từ | Tổng: {len(all_words)}")
            time.sleep(0.5)
            
        except Exception as e:
            print(f"  List {list_id}: Lỗi — {e}")
    
    print(f"\n{'='*55}")
    print(f"  TỔNG KẾT: {len(all_words)} từ vựng từ 23 lists")
    print(f"{'='*55}")
    
    if all_words:
        OUT_FILE.write_text(json.dumps(all_words, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f"\n✅ Đã lưu → {OUT_FILE}")
        print(f"   Preview 3 từ đầu:")
        for w in all_words[:3]:
            print(f"   • {w['word']} ({w['ipa']}) — {w['meaning']}")
    else:
        print("\n❌ Không lấy được từ nào!")


if __name__ == '__main__':
    main()
