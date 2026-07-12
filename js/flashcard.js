/**
 * flashcard.js — Flashcard mode with 3D flip, SR integration
 */
export class FlashcardMode {
    constructor(dm, ui) {
        this.dm    = dm;
        this.ui    = ui;
        this.queue = [];
        this.idx   = 0;
        this.flipped = false;
    }

    /* ── Bindings called once from app.js ── */
    init() {
        // Setup buttons
        document.getElementById('fc-start-review').addEventListener('click', () => {
            this._start(this.dm.dueWords);
        });
        document.getElementById('fc-start-all').addEventListener('click', () => {
            this._start(this.ui.shuffle([...this.dm.words]));
        });
        document.getElementById('fc-start-fav').addEventListener('click', () => {
            if (this.dm.favoriteWords.length === 0) {
                this.ui.toast('Bạn chưa có từ yêu thích!', 'info');
                return;
            }
            this._start(this.ui.shuffle([...this.dm.favoriteWords]));
        });

        // Close session
        document.getElementById('fc-close').addEventListener('click', () => this._close());

        // Card flip
        document.getElementById('flashcard').addEventListener('click', () => this._flip());

        // Answer buttons
        document.getElementById('fc-forgot').addEventListener('click', () => this._answer(false));
        document.getElementById('fc-knew').addEventListener('click',   () => this._answer(true));

        // TTS
        document.getElementById('fc-tts-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.queue[this.idx]) this.ui.speak(this.queue[this.idx].word);
        });

        // Update due count badge
        this._updateDueCount();
    }

    _updateDueCount() {
        document.getElementById('fc-review-count').textContent = this.dm.dueWords.length;
    }

    _start(words) {
        if (words.length === 0) {
            this.ui.toast('Không có từ nào để ôn!', 'info');
            return;
        }
        this.queue = words.slice(0, 30); // cap at 30 per session
        this.idx   = 0;
        this.flipped = false;

        document.getElementById('fc-setup').classList.add('hidden');
        document.getElementById('fc-session').classList.remove('hidden');

        this._render();
    }

    _render() {
        if (this.idx >= this.queue.length) { this._finish(); return; }
        const w = this.queue[this.idx];

        // Reset flip
        this.flipped = false;
        document.getElementById('flashcard').classList.remove('flipped');

        // Populate front
        document.getElementById('fc-word').textContent  = w.word;
        document.getElementById('fc-ipa').textContent   = w.ipa    || '';
        document.getElementById('fc-type').textContent  = w.type   || '';

        // Populate back
        document.getElementById('fc-meaning').textContent     = w.meaning;
        document.getElementById('fc-example').textContent     = w.example     || '';
        document.getElementById('fc-translation').textContent = w.translation || '';

        this.ui.updateFcCounter(this.idx + 1, this.queue.length);

        // Auto speak (only on first word, subsequent words are spoken in _answer to bypass iOS restrictions)
        if (this.idx === 0) {
            this.ui.speak(w.word);
        }
    }

    _flip() {
        this.flipped = !this.flipped;
        document.getElementById('flashcard').classList.toggle('flipped', this.flipped);
    }

    _answer(isCorrect) {
        const w = this.queue[this.idx];
        if (!w) return;
        this.dm.recordAnswer(w.id, isCorrect);

        // Phát âm từ tiếp theo ngay lập tức để không bị iOS chặn (vì phải nằm trong stack của click event)
        const nextW = this.queue[this.idx + 1];
        if (nextW) this.ui.speak(nextW.word);

        // Animate card out
        const card = document.getElementById('flashcard');
        card.style.transition = 'opacity 0.2s, transform 0.2s';
        card.style.opacity    = '0';
        card.style.transform  = `translateX(${isCorrect ? 60 : -60}px)`;

        setTimeout(() => {
            card.style.transition = '';
            card.style.opacity    = '1';
            card.style.transform  = '';
            this.idx++;
            this._render();
        }, 220);
    }

    _finish() {
        document.getElementById('fc-session').classList.add('hidden');
        document.getElementById('fc-setup').classList.remove('hidden');
        this._updateDueCount();
        this.ui.toast('🎉 Hoàn thành phiên Flashcard!', 'success');
        document.dispatchEvent(new Event('stats-updated'));
    }

    _close() {
        document.getElementById('fc-session').classList.add('hidden');
        document.getElementById('fc-setup').classList.remove('hidden');
        this._updateDueCount();
    }

    /* Keyboard handler — called by app.js */
    handleKey(key) {
        if (document.getElementById('fc-session').classList.contains('hidden')) return false;
        if (key === ' ') { this._flip(); return true; }
        if (key === 'ArrowLeft')  { this._answer(false); return true; }
        if (key === 'ArrowRight') { this._answer(true);  return true; }
        if (key.toLowerCase() === 'l') {
            if (this.queue[this.idx]) this.ui.speak(this.queue[this.idx].word);
            return true;
        }
        return false;
    }
}
