/**
 * app.js — Main entry point. Wires all modules together.
 */
import { DataManager  } from './data.js';
import { UIManager    } from './ui.js';
import { FlashcardMode} from './flashcard.js';
import { QuizMode     } from './quiz.js';

class App {
    constructor() {
        this.dm = new DataManager();
        this.ui = new UIManager(this.dm);
        this.fc = new FlashcardMode(this.dm, this.ui);
        this.qz = new QuizMode(this.dm, this.ui);
    }

    async start() {
        // ── 1. Theme & Mobile sidebar ──
        this.ui.initTheme();
        this.ui.initMobileSidebar();

        // ── 2. Load data ──
        try {
            await this.dm.init();
        } catch (err) {
            console.warn('[EngVocab] Could not fetch words.json:', err.message);
            this.ui.toast('⚠️ Cần chạy trên Local Server. Xem file start-server.bat', 'error');
            // Still boot the UI with empty data
        }

        // ── 3. Bootstrap modes ──
        this.fc.init();
        this.qz.init();

        // ── 4. Navigation ──
        document.querySelectorAll('.nav-item').forEach(li => {
            li.addEventListener('click', () => {
                const view = li.dataset.view;
                this.ui.navigate(view);
                this._onViewEnter(view);
            });
        });

        // ── 5. Dashboard quick-actions ──
        document.getElementById('btn-quick-review').addEventListener('click', () => {
            this.ui.navigate('quiz');
            this.qz.startQuickReviewMixed();
        });
        document.getElementById('btn-challenge').addEventListener('click', () => {
            this.ui.navigate('quiz');
            this._onViewEnter('quiz');
        });
        document.getElementById('btn-learn-new').addEventListener('click', () => {
            this.ui.navigate('quiz');
            this.qz.startDailyNew();
        });

        // Mode cards on dashboard
        document.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', () => {
                const mode = card.dataset.mode;
                if (mode === 'flashcards')  { this.ui.navigate('flashcards'); this._onViewEnter('flashcards'); }
                if (mode === 'quiz-mc')     { this.ui.navigate('quiz');      this._startQuizType('multiple-choice'); }
                if (mode === 'quiz-fill')   { this.ui.navigate('quiz');      this._startQuizType('fill-blank'); }
                if (mode === 'quiz-listen') { this.ui.navigate('quiz');      this._startQuizType('listening'); }
                if (mode === 'spaced-rep')  { this.ui.navigate('quiz');      this.qz.startSpacedRep(); }
                if (mode === 'quiz-wrong')  { this.ui.navigate('quiz');      this.qz.startWrongWords(); }
            });
        });

        // ── 6. Word list ──
        this._initWordList();

        // ── 7. Modal ──
        document.getElementById('modal-close-btn').addEventListener('click', () => this.ui.closeWordModal());
        document.getElementById('word-modal-backdrop').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.ui.closeWordModal();
        });

        // ── 8. Settings ──
        this._initSettings();

        // ── 9. Global keyboard shortcuts ──
        this._initKeyboard();

        // ── 10. Stats update event ──
        document.addEventListener('stats-updated', () => {
            this._refreshStats();
        });

        // ── 10.5. Quiz List Modal ──
        this._initQuizListModal();

        // ── 11. Initial render ──
        this._onViewEnter('dashboard');
        this._refreshStats();
    }

    _initQuizListModal() {
        const btn = document.getElementById('quiz-by-list-btn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const sel = document.getElementById('quiz-list-select');
            const topics = this.dm.getTopics();
            sel.innerHTML = '';
            topics.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t;
                opt.textContent = t;
                sel.appendChild(opt);
            });
            document.getElementById('quiz-list-modal-backdrop').classList.remove('hidden');
        });

        document.getElementById('quiz-list-modal-close').addEventListener('click', () => {
            document.getElementById('quiz-list-modal-backdrop').classList.add('hidden');
        });

        document.getElementById('quiz-list-modal-backdrop').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) document.getElementById('quiz-list-modal-backdrop').classList.add('hidden');
        });

        document.getElementById('quiz-list-start-btn').addEventListener('click', () => {
            const topic = document.getElementById('quiz-list-select').value;
            if (!topic) return;
            document.getElementById('quiz-list-modal-backdrop').classList.add('hidden');
            const words = this.dm.words.filter(w => w.topic === topic);
            this.qz.startCustomReview(words);
        });
    }

    /* ── View enter hook ─────────────────────── */
    _onViewEnter(view) {
        if (view === 'dashboard') {
            this.ui.updateDashboard();
            this.ui.updateHeader();
        }
        if (view === 'wordlist') {
            this._populateTopics();
            this._filterAndRender();
        }
        if (view === 'stats') {
            this.ui.updateStatsPage();
        }
    }

    _refreshStats() {
        this.ui.updateDashboard();
        this.ui.updateHeader();
        if (this.ui.currentView() === 'stats') this.ui.updateStatsPage();
    }

    /* ── Word list ───────────────────────────── */
    _initWordList() {
        document.getElementById('search-input').addEventListener('input', () => this._filterAndRender());
        document.getElementById('filter-topic').addEventListener('change', () => this._filterAndRender());
        document.getElementById('filter-status').addEventListener('change', () => this._filterAndRender());
        document.getElementById('btn-shuffle').addEventListener('click', () => {
            this._shuffled = true;
            this._filterAndRender();
        });
        document.getElementById('btn-review-list').addEventListener('click', () => {
            if (!this._currentFilteredWords || this._currentFilteredWords.length === 0) {
                this.ui.toast('Danh sách hiện tại không có từ nào!', 'error');
                return;
            }
            this.ui.navigate('quiz');
            this.qz.startCustomReview(this._currentFilteredWords);
        });
    }

    _populateTopics() {
        const sel    = document.getElementById('filter-topic');
        const curr   = sel.value;
        const topics = this.dm.getTopics();
        sel.innerHTML = '<option value="">Tất cả chủ đề</option>';
        topics.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            sel.appendChild(opt);
        });
        sel.value = curr;
    }

    _filterAndRender() {
        const search = document.getElementById('search-input').value.trim().toLowerCase();
        const topic  = document.getElementById('filter-topic').value;
        const status = document.getElementById('filter-status').value;

        let words = [...this.dm.words];

        if (search) words = words.filter(w =>
            w.word.toLowerCase().includes(search) ||
            w.meaning.toLowerCase().includes(search) ||
            (w.example || '').toLowerCase().includes(search)
        );
        if (topic)  words = words.filter(w => w.topic === topic);
        if (status === 'learned')   words = words.filter(w => this.dm.progress[w.id]?.level > 0);
        if (status === 'unlearned') words = words.filter(w => !this.dm.progress[w.id]?.level);
        if (status === 'favorite')  words = words.filter(w => this.dm.progress[w.id]?.isFavorite);

        if (this._shuffled) { words = this.ui.shuffle(words); this._shuffled = false; }
        this._currentFilteredWords = words; // Save for custom review

        this.ui.renderWordList(words, {
            onFavorite: (id) => { this.dm.toggleFavorite(id); this._filterAndRender(); },
            onClick:    (w)  => this.ui.openWordModal(w, this.dm.progress[w.id]),
            onSpeak:    (word) => this.ui.speak(word),
        });
    }

    /* ── Start quiz type directly ────────────── */
    _startQuizType(type) {
        // Programmatically trigger the quiz start
        this.qz.type = type;
        // Find the matching card and simulate click, or call internal
        const card = document.querySelector(`.quiz-card-option[data-type="${type}"]`);
        if (card) card.click();
    }

    /* ── Settings ────────────────────────────── */
    _initSettings() {
        // Import words JSON
        document.getElementById('import-words-file').addEventListener('change', (e) => {
            this._readJSON(e.target.files[0], (data) => {
                if (!Array.isArray(data)) { this.ui.toast('File không hợp lệ (cần mảng JSON)', 'error'); return; }
                this.dm.loadWordsFromJSON(data);
                this._populateTopics();
                this._filterAndRender();
                this._refreshStats();
                this.ui.toast(`Đã tải ${data.length} từ thành công!`, 'success');
            });
        });

        // Export words
        document.getElementById('export-words-btn').addEventListener('click', () => {
            this.dm.exportWords();
            this.ui.toast('Đã xuất danh sách từ!', 'success');
        });

        // Export progress
        document.getElementById('export-progress-btn').addEventListener('click', () => {
            this.dm.exportProgress();
            this.ui.toast('Đã xuất tiến độ học!', 'success');
        });

        // Import progress
        document.getElementById('import-progress-file').addEventListener('change', (e) => {
            this._readJSON(e.target.files[0], (data) => {
                if (this.dm.importProgress(data)) {
                    this._refreshStats();
                    this.ui.toast('Khôi phục tiến độ thành công!', 'success');
                } else {
                    this.ui.toast('File tiến độ không hợp lệ!', 'error');
                }
            });
        });

        // Reset
        document.getElementById('reset-btn').addEventListener('click', () => {
            if (!confirm('Xóa toàn bộ tiến độ? Không thể hoàn tác!')) return;
            this.dm.resetAll();
            this._refreshStats();
            this._filterAndRender();
            this.ui.toast('Đã xóa toàn bộ tiến độ.', 'info');
        });
    }

    _readJSON(file, cb) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try { cb(JSON.parse(ev.target.result)); }
            catch { this.ui.toast('Lỗi: file JSON không hợp lệ!', 'error'); }
        };
        reader.readAsText(file);
    }

    /* ── Global keyboard shortcuts ───────────── */
    _initKeyboard() {
        document.addEventListener('keydown', (e) => {
            // Ignore if focus is on input/textarea
            if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) {
                // Still allow Enter for quiz fill input
                if (e.key === 'Enter') this.qz.handleKey('Enter');
                return;
            }

            const k = e.key;

            // Theme toggle
            if (k.toLowerCase() === 'd') { this.ui.toggleTheme(); return; }

            // Flashcard keys
            if (this.fc.handleKey(k)) return;

            // Quiz keys
            if (this.qz.handleKey(k)) return;
        });
    }
}

// ── Boot ──
window.addEventListener('DOMContentLoaded', async () => {
    const app = new App();
    await app.start();
    // Expose for debugging
    window.__app = app;
});
