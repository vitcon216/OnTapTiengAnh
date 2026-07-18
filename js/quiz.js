/**
 * quiz.js — Multiple-choice, Fill-blank, Listening, Spaced-Rep, Wrong-words modes
 */
export class QuizMode {
    constructor(dm, ui) {
        this.dm        = dm;
        this.ui        = ui;
        this.questions = [];
        this.idx       = 0;
        this.hearts    = 3;
        this.type      = '';
        this.answered  = false;
    }

    init() {
        document.querySelectorAll('.quiz-card-option[data-type]').forEach(card => {
            card.addEventListener('click', () => this._startQuiz(card.dataset.type));
        });
        document.getElementById('quiz-exit').addEventListener('click', () => this._exitQuiz());
    }

    /* ── Public: start from other modules ── */
    startSpacedRep() { this._startQuiz('spaced-rep'); }
    startWrongWords() { this._startQuiz('wrong-words'); }
    startDailyNew() { this._startQuiz('daily-new'); }
    startQuickReviewMixed() { this._startQuiz('quick-review-mixed'); }
    startCustomReview(words) { this._startQuiz('custom-list', words); }

    /* ── Quiz lifecycle ─────────────────────── */
    _startQuiz(type, customPool = null) {
        if (type === 'custom-list') {
            if (!customPool || customPool.length === 0) {
                this.ui.toast('Không có từ nào cần ôn tập!', 'info');
                return;
            }
            this.questions = this.ui.shuffle([...customPool]).slice(0, 50);
            this.hearts = 3;
            this.type = 'multiple-choice';
            this.idx = 0;
            this.answered = false;
        } else if (type === 'daily-new') {
            const dailyPool = this.dm.getDailyNewWords();
            if (dailyPool.length === 0) {
                this.ui.toast('Bạn đã học hết tất cả từ vựng rồi!', 'info');
                return;
            }
            this.questions = dailyPool;
            this.hearts = 999;
        } else {
            const learnedPool = this.dm.learnedWords;
            if (learnedPool.length < 4) {
                this.ui.toast('Cần học ít nhất 4 từ mới trước khi ôn tập!', 'error');
                return;
            }

            let pool;
            if (type === 'spaced-rep')  pool = this.dm.dueWords;
            else if (type === 'wrong-words') pool = this.dm.wrongWords.slice(0, 20);
            else                        pool = this.ui.shuffle([...learnedPool]);

            if (pool.length === 0) {
                this.ui.toast('Không có từ nào cần ôn tập!', 'info');
                return;
            }
            this.questions = this.ui.shuffle(pool);
            this.hearts    = 3;
        }

        this.idx       = 0;
        this.type      = (type === 'spaced-rep' || type === 'wrong-words' || type === 'custom-list') ? 'multiple-choice' : type;
        this.answered  = false;

        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        document.getElementById('view-quiz').classList.remove('hidden');
        document.getElementById('quiz-menu').classList.add('hidden');
        document.getElementById('quiz-active').classList.remove('hidden');
        
        this.ui.updateHearts(this.hearts);
        this._renderQuestion();
    }

    _renderQuestion() {
        if (this.idx >= this.questions.length) { this._finish(); return; }
        if (this.hearts <= 0)                  { this._finish(true); return; }

        this.answered = false;
        this.ui.updateQuizProgress(this.idx, this.questions.length);

        const w = this.questions[this.idx];
        const body = document.getElementById('quiz-body');
        body.innerHTML = '';

        if (this.type === 'daily-new') {
            const modes = ['flashcard', 'multiple-choice', 'listening'];
            const randomMode = modes[Math.floor(Math.random() * modes.length)];
            
            if (randomMode === 'flashcard') this._renderFlashcard(w, body);
            else if (randomMode === 'multiple-choice') this._renderMC(w, body);
            else if (randomMode === 'listening') this._renderListen(w, body);
        } else if (this.type === 'quick-review-mixed') {
            this._renderMC(w, body);
        } else {
            if (this.type === 'multiple-choice') this._renderMC(w, body);
            else if (this.type === 'fill-blank') this._renderFill(w, body);
            else if (this.type === 'listening')  this._renderListen(w, body);
        }
    }

    /* ── Flashcard (Daily New) ──────────────────────────── */
    _renderFlashcard(w, body) {
        body.innerHTML = `
            <div class="fc-card" style="margin-bottom: 24px; text-align: center; padding: 32px 16px; border: 2px solid var(--border); border-radius: 16px;">
                <h2 style="font-size: 2em; margin-bottom: 8px; color: var(--primary);">${w.word}</h2>
                <p style="font-size: 1.2em; color: var(--text2); margin-bottom: 16px;">${w.ipa || ''}</p>
                <p style="font-size: 1.2em; font-weight: bold; margin-bottom: 16px;">${w.meaning}</p>
                ${w.example ? `<p style="font-style: italic; color: var(--text2); margin-bottom: 8px;">"${w.example}"</p>` : ''}
                ${w.translation ? `<p style="color: var(--text3);">${w.translation}</p>` : ''}
            </div>
            <button class="btn btn-primary btn-full" id="fc-understood-btn">Đã hiểu (Enter)</button>
        `;
        
        this.ui.speak(w.word);

        const btn = body.querySelector('#fc-understood-btn');
        btn.focus();
        btn.addEventListener('click', (e) => {
            if (this.answered) return;
            this.answered = true;
            
            const fillSubmit = document.getElementById('fill-submit');
            if (fillSubmit) fillSubmit.style.display = 'none';
            btn.style.display = 'none';

            this._handleResult(true, e);
        });
    }

    /* ── Multiple Choice ─────────────────────── */
    _renderMC(w, body) {
        const distractors = this.ui.pickDistractors(w, this.dm.words, 3);
        const options     = this.ui.shuffle([w, ...distractors]);

        body.innerHTML = `
            <p class="quiz-question-label">Từ nào có nghĩa:</p>
            <p class="quiz-question">"${w.meaning}"</p>
            <div class="options-list" id="options"></div>
        `;
        const ol = body.querySelector('#options');
        options.forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerHTML = `<span class="opt-key">${i + 1}</span>${opt.word}`;
            btn.dataset.id = opt.id;
            btn.addEventListener('click', (e) => this._checkMC(w.id, btn, e));
            ol.appendChild(btn);
        });
    }

    _checkMC(correctId, btn, e) {
        if (this.answered) return;
        this.answered = true;
        const isCorrect = btn.dataset.id === correctId;
        
        // Phát âm từ vừa chọn
        const selectedWordObj = this.dm.words.find(w => w.id === btn.dataset.id);
        if (selectedWordObj) {
            this.ui.speak(selectedWordObj.word);
        }

        document.querySelectorAll('.option-btn').forEach(b => {
            b.disabled = true;
            if (b.dataset.id === correctId) b.classList.add('correct');
            else if (b === btn && !isCorrect) b.classList.add('wrong');
        });

        this._handleResult(isCorrect, e);
    }

    /* ── Fill Blank ──────────────────────────── */
    _renderFill(w, body) {
        const blank = (w.example || '').replace(new RegExp(`\\b${w.word}\\b`, 'gi'), '_______');
        body.innerHTML = `
            <p class="quiz-question-label">Điền từ vào chỗ trống:</p>
            <p class="quiz-question">${blank || `Nghĩa: "${w.meaning}"`}</p>
            ${w.translation ? `<p style="font-size:13px;color:var(--text3);margin-bottom:12px">${w.translation}</p>` : ''}
            <div class="fill-input-wrap">
                <input type="text" id="fill-input" class="fill-input" placeholder="Gõ từ tiếng Anh..." autocomplete="off" autocorrect="off" spellcheck="false">
                <button class="btn btn-primary btn-full" id="fill-submit">Kiểm tra (Enter)</button>
            </div>
        `;

        const input   = body.querySelector('#fill-input');
        const submit  = body.querySelector('#fill-submit');
        const checkFn = (e) => {
            if (e && e.type === 'keydown') {
                e.preventDefault();
                e.stopPropagation();
            }
            if (this.answered) return;
            this.answered = true;
            const val       = input.value.trim().toLowerCase();
            const isCorrect = val === w.word.toLowerCase();
            input.classList.add(isCorrect ? 'correct' : 'wrong');
            
            this.ui.speak(w.word);
            
            const hint = document.createElement('div');
            hint.style.cssText = "margin-top: 12px; font-weight: bold; color: var(--primary); text-align: center;";
            hint.innerHTML = `(${w.word}) <span style="font-weight:normal; color:var(--text2)">- ${w.meaning}</span>`;
            
            const wrap = body.querySelector('.fill-input-wrap');
            wrap.appendChild(hint);
            
            this._handleResult(isCorrect, e);
        };
        submit.addEventListener('click', checkFn);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkFn(e); });
        setTimeout(() => input.focus(), 100);
    }

    /* ── Listening ───────────────────────────── */
    _renderListen(w, body) {
        const distractors = this.ui.pickDistractors(w, this.dm.words, 3);
        const options     = this.ui.shuffle([w, ...distractors]);

        body.innerHTML = `
            <p class="quiz-question-label">Nghe và chọn từ đúng:</p>
            <div class="listen-btn-wrap">
                <button class="btn-listen-big" id="listen-btn"><i class="ph-fill ph-speaker-high"></i></button>
                <p style="font-size:13px;color:var(--text3);margin-top:8px">Nhấn để nghe lại</p>
            </div>
            <div class="options-list" id="options"></div>
        `;

        body.querySelector('#listen-btn').addEventListener('click', () => this.ui.speak(w.word));

        const ol = body.querySelector('#options');
        options.forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerHTML = `<span class="opt-key">${i + 1}</span>${opt.word}`;
            btn.dataset.id = opt.id;
            btn.addEventListener('click', (e) => this._checkMC(w.id, btn, e));
            ol.appendChild(btn);
        });

        // Auto speak
        this.ui.speak(w.word);
    }

    /* ── Handle result ───────────────────────── */
    _handleResult(isCorrect, e) {
        const w = this.questions[this.idx];
        this.dm.recordAnswer(w.id, isCorrect);

        if (isCorrect) {
            this.ui.showResult(true, e);
        } else {
            this.hearts--;
            this.ui.updateHearts(this.hearts);
            document.getElementById('quiz-body').classList.add('anim-shake');
            setTimeout(() => document.getElementById('quiz-body').classList.remove('anim-shake'), 500);
            this.ui.showResult(false, e);
        }

        // Show meanings for all options so the user can review them
        document.querySelectorAll('.option-btn').forEach(b => {
            const wordId = b.dataset.id;
            const wordObj = this.dm.words.find(x => x.id === wordId);
            if (wordObj && !b.querySelector('.opt-meaning')) {
                const span = document.createElement('span');
                span.className = 'opt-meaning';
                span.style.cssText = 'font-size:0.9em; opacity:0.8; margin-left:6px; font-weight:normal;';
                span.textContent = `- ${wordObj.meaning}`;
                b.appendChild(span);
            }
        });

        // Hide fill-blank submit button if it exists
        const fillSubmit = document.getElementById('fill-submit');
        if (fillSubmit) fillSubmit.style.display = 'none';

        // Add Next button instead of timeout
        const body = document.getElementById('quiz-body');
        const nextWrap = document.createElement('div');
        nextWrap.style.marginTop = '24px';
        nextWrap.innerHTML = `<button class="btn btn-primary btn-full" id="quiz-next-btn">Tiếp tục (Enter)</button>`;
        body.appendChild(nextWrap);
        
        document.getElementById('quiz-next-btn').addEventListener('click', () => {
            this.idx++;
            this._renderQuestion();
        });
    }

    /* ── Finish ──────────────────────────────── */
    _finish(failed = false) {
        this._exitQuiz();
        if (failed) {
            this.ui.toast('Hết mạng! Cố gắng hơn lần sau nhé.', 'error');
        } else {
            this.ui.toast('🎉 Hoàn thành bài ôn tập!', 'success');
        }
        document.dispatchEvent(new Event('stats-updated'));
    }

    _exitQuiz() {
        document.getElementById('quiz-active').classList.add('hidden');
        document.getElementById('quiz-menu').classList.remove('hidden');
    }

    /* ── Keyboard ────────────────────────────── */
    handleKey(key) {
        if (document.getElementById('quiz-active').classList.contains('hidden')) return false;

        // Number keys for MC / Listening
        if (['1','2','3','4'].includes(key)) {
            const btns = document.querySelectorAll('.option-btn:not(:disabled)');
            const idx  = parseInt(key) - 1;
            if (btns[idx]) { btns[idx].click(); return true; }
        }
        // Enter for next or fill-blank or flashcard
        if (key === 'Enter') {
            const nextBtn = document.getElementById('quiz-next-btn');
            if (nextBtn) { nextBtn.click(); return true; }
            
            const btn = document.getElementById('fill-submit');
            if (btn && btn.style.display !== 'none') { btn.click(); return true; }

            const fcBtn = document.getElementById('fc-understood-btn');
            if (fcBtn && fcBtn.style.display !== 'none') { fcBtn.click(); return true; }
        }
        return false;
    }
}
