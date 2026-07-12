/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  STUDY4 VOCABULARY EXTRACTOR — Console Script        ║
 * ║  Dán vào Console tại trang Study4 (đã đăng nhập)    ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Cách dùng:
 *  1. Mở trang https://study4.com/flashcards/lists/45123/
 *     (hoặc bất kỳ list nào trong khóa TOEIC)
 *  2. Ấn F12 → chọn tab Console
 *  3. Paste toàn bộ đoạn code này → Enter
 *  4. Chờ vài giây, file words.json sẽ tự download
 *  5. Copy file đó vào thư mục data/ của dự án EngVocab
 */

(async function STUDY4_EXTRACTOR() {
    const log  = (m) => console.log(`%c✅ [Study4] ${m}`, 'color:#58CC02;font-weight:bold;font-size:13px');
    const info = (m) => console.log(`%cℹ️  [Study4] ${m}`, 'color:#1CB0F6;font-size:12px');
    const warn = (m) => console.warn(`⚠️  [Study4] ${m}`);
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    const allWords = [];
    const seenKeys = new Set();
    let   wId      = 1;

    // ── Lấy danh sách tất cả List URLs ───────────────────
    async function getAllListUrls() {
        info('Đang tìm tất cả list URLs trong khóa học...');
        
        // Thử fetch trang khóa học để lấy danh sách list
        const courseUrls = [
            'https://study4.com/courses/28/complete-toeic/',
            'https://study4.com/flashcards/?course=28',
            'https://study4.com/courses/28/complete-toeic/flashcards/',
        ];
        
        const foundUrls = new Set();
        // Luôn thêm list đang mở hiện tại
        if (window.location.href.includes('/flashcards/lists/')) {
            foundUrls.add(window.location.href.split('?')[0]);
        }
        
        for (const url of courseUrls) {
            try {
                const resp = await fetch(url, { credentials: 'include' });
                if (!resp.ok) continue;
                const text = await resp.text();
                // Tìm tất cả /flashcards/lists/xxxxx/ trong HTML
                const matches = text.match(/\/flashcards\/lists\/\d+\//g) || [];
                matches.forEach(m => foundUrls.add('https://study4.com' + m));
            } catch(e) {}
        }
        
        // Tìm từ trang hiện tại
        document.querySelectorAll('a[href]').forEach(a => {
            if (a.href.includes('/flashcards/lists/')) {
                foundUrls.add(a.href.split('?')[0]);
            }
        });
        
        const urls = [...foundUrls];
        info(`Tìm được ${urls.length} list URLs: ${urls.map(u => u.split('/').slice(-2,-1)[0]).join(', ')}`);
        return urls;
    }

    // ── Cuộn trang để load lazy content ──────────────────
    async function scrollFull(doc = document) {
        for (let i = 0; i < 20; i++) {
            window.scrollTo(0, document.body.scrollHeight);
            await sleep(300);
        }
        window.scrollTo(0, 0);
        await sleep(500);
    }

    // ── Extract từ một DOM document ─────────────────────
    function extractWords(doc, topicName) {
        const items = doc.querySelectorAll('.termlist-item');
        const words = [];
        
        items.forEach((item, idx) => {
            // ── Lấy từ tiếng Anh ──
            const h2 = item.querySelector('h2');
            if (!h2) return;
            
            // Clone h2, xóa span để lấy text node chính
            const h2Clone = h2.cloneNode(true);
            h2Clone.querySelectorAll('span, button, i, a').forEach(el => el.remove());
            const wordText = h2Clone.textContent.trim().replace(/\s+/g, ' ');
            if (!wordText || !/^[a-zA-Z]/.test(wordText)) return;

            // ── Lấy IPA và loại từ từ span ──
            let ipa  = '';
            let type = '';
            h2.querySelectorAll('span').forEach(span => {
                const t = span.textContent.trim();
                if (/^\/.*\/$/.test(t)) ipa  = t;
                else if (/^\(.*\)$/.test(t)) type = t.slice(1, -1);
            });

            // ── Lấy nghĩa tiếng Việt + định nghĩa tiếng Anh ──
            let meaningVi = '';
            let meaningEn = '';
            const prewrap = item.querySelector('.prewrap');
            if (prewrap) {
                const lines = prewrap.innerText.split('\n').map(l => l.trim()).filter(Boolean);
                lines.forEach(line => {
                    if (line.startsWith('=')) meaningEn = line.slice(1).trim();
                    else if (!meaningVi)       meaningVi = line;
                });
            }

            // ── Lấy ví dụ ──
            let example     = '';
            let translation = '';
            const exLis = item.querySelectorAll('.termlist-item-examples li');
            if (exLis.length > 0) {
                // Lấy ví dụ đầu tiên
                const liClone = exLis[0].cloneNode(true);
                liClone.querySelectorAll('.jq-audio-player, .jq-audio-btn').forEach(e => e.remove());
                const exText  = liClone.innerText.trim();
                // Format: "English sentence (=Dịch: Vietnamese)"
                const match   = exText.match(/^(.+?)\s*\(=Dịch:\s*(.+?)\)\s*$/s);
                if (match) {
                    example     = match[1].replace(/\[|\]/g, '').trim();
                    translation = match[2].trim();
                } else {
                    example = exText.replace(/\[|\]/g, '').trim();
                }
            }

            // ── Dedup ──
            const key = wordText.toLowerCase();
            if (seenKeys.has(key)) return;
            seenKeys.add(key);

            words.push({
                id:          `w${wId++}`,
                word:        wordText,
                ipa:         ipa,
                type:        type,
                meaning:     meaningVi || meaningEn,
                example:     example,
                translation: translation,
                topic:       topicName || 'TOEIC'
            });
        });

        return words;
    }

    // ── Scrape một list qua fetch ────────────────────────
    async function scrapeListUrl(url) {
        const listId = url.match(/\/lists\/(\d+)\//)?.[1] || url;
        info(`Scraping list ${listId}: ${url}`);
        
        try {
            const resp = await fetch(url, { credentials: 'include' });
            if (!resp.ok) { warn(`HTTP ${resp.status} - ${url}`); return []; }
            const html = await resp.text();
            
            const parser = new DOMParser();
            const doc    = parser.parseFromString(html, 'text/html');
            
            // Tìm tên chủ đề từ tiêu đề trang
            const title = doc.querySelector('title')?.textContent || '';
            const topic = title.replace('| STUDY4','').replace('Flashcards:','').trim();
            
            const words = extractWords(doc, topic || `List ${listId}`);
            info(`  List ${listId}: ${words.length} từ`);
            
            // Tìm thêm list URLs từ trang này
            const newUrls = new Set();
            doc.querySelectorAll('a[href]').forEach(a => {
                if (a.getAttribute('href')?.includes('/flashcards/lists/')) {
                    newUrls.add('https://study4.com' + a.getAttribute('href').split('?')[0]);
                }
            });
            return { words, newUrls: [...newUrls] };
        } catch(err) {
            warn(`Lỗi scrape ${url}: ${err.message}`);
            return { words: [], newUrls: [] };
        }
    }

    // ══════════════ MAIN ══════════════
    log('Bắt đầu trích xuất từ vựng Study4 Complete TOEIC...');

    // 1. Scrape trang đang mở (đã đăng nhập, đã load)
    info('Bước 1: Cuộn trang hiện tại để load hết...');
    await scrollFull();
    
    const currentTitle = document.querySelector('title')?.textContent || '';
    const currentTopic = currentTitle.replace('| STUDY4','').replace('Flashcards:','').trim();
    const currentWords = extractWords(document, currentTopic);
    allWords.push(...currentWords);
    log(`Trang hiện tại: ${currentWords.length} từ (${currentTopic})`);

    // 2. Tìm tất cả list URLs
    info('Bước 2: Tìm tất cả list URLs...');
    let listUrls = await getAllListUrls();
    
    // Bỏ URL hiện tại (đã scrape rồi)
    listUrls = listUrls.filter(u => !u.includes(window.location.href.split('?')[0]));
    
    // 3. Scrape từng list
    info(`Bước 3: Scrape ${listUrls.length} list còn lại...`);
    const visitedUrls = new Set([window.location.href]);
    
    for (let i = 0; i < listUrls.length; i++) {
        const url = listUrls[i];
        if (visitedUrls.has(url)) continue;
        visitedUrls.add(url);
        
        const result = await scrapeListUrl(url);
        if (result.words) allWords.push(...result.words);
        
        // Thêm list URLs mới tìm được
        if (result.newUrls) {
            result.newUrls.forEach(u => {
                if (!visitedUrls.has(u) && !listUrls.includes(u)) {
                    listUrls.push(u);
                }
            });
        }
        
        await sleep(600); // Polite delay
    }

    // ── KẾT QUẢ ─────────────────────────────────────────
    log('══════════════════════════════════════');
    log(`HOÀN THÀNH: ${allWords.length} từ vựng từ ${visitedUrls.size} list`);
    
    if (allWords.length === 0) {
        warn('Không lấy được từ nào! Có thể cần refresh trang và thử lại.');
        return;
    }
    
    // Preview
    console.table(allWords.slice(0, 5));

    // ── DOWNLOAD ─────────────────────────────────────────
    const jsonStr = JSON.stringify(allWords, null, 2);
    const blob    = new Blob([jsonStr], { type: 'application/json' });
    const dlUrl   = URL.createObjectURL(blob);
    const a       = Object.assign(document.createElement('a'), {
        href:     dlUrl,
        download: 'words.json'
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(dlUrl), 1000);
    
    log(`✅ words.json (${allWords.length} từ) đã tải về!`);
    log('📂 Copy file đó vào thư mục:  e:\\Ôn từ vựng tiếng anh\\data\\words.json');
    log('🔄 Sau đó refresh http://localhost:8080 để cập nhật!');

    return allWords;
})();
