export class ToeicQuizAdvancedMode {
    constructor(dataManager, uiManager) {
        this.dm = dataManager;
        this.ui = uiManager;
        this.container = document.getElementById('toeic-vocab-quiz-container');
        this.vocabContainer = document.getElementById('toeic-vocab-part-container');
    }

    start(words) {
        this.vocabContainer.classList.add('hidden');
        this.container.classList.remove('hidden');
        
        // Initialize SRS State
        // streak: number of consecutive correct answers
        // status: 'learning', 'review', 'mastered'
        this.queue = words.map(w => ({
            ...w,
            streak: 0,
            wrongCount: 0,
            askedCount: 0
        }));
        
        // Shuffle queue initially
        this.queue.sort(() => Math.random() - 0.5);
        this.originalCount = this.queue.length;
        
        this.sessionStats = {
            correct: 0,
            wrong: 0,
            startTime: Date.now()
        };

        this._nextQuestion();
    }

    _nextQuestion() {
        // Filter out mastered words (e.g., streak >= 1 for quick session, or >=2 for thorough)
        const activeWords = this.queue.filter(w => w.streak < 1);
        
        if (activeWords.length === 0) {
            this._showSummary();
            return;
        }

        // Pick the first word in the active queue
        this.currentWord = activeWords[0];
        
        // Decide question type based on streak and random chance
        // 0: MCQ Translation, 1: MCQ Blank, 2: Typing Blank
        const qTypes = ['mcq_trans', 'mcq_blank', 'typing_blank'];
        let type = qTypes[Math.floor(Math.random() * qTypes.length)];
        
        // If it's a long phrasal verb/collocation, maybe prefer typing
        if (this.currentWord.word.includes(' ')) {
            type = Math.random() > 0.5 ? 'typing_blank' : 'mcq_blank';
        }

        this.currentType = type;
        this._renderQuestionLayout();
    }
    
    _generateDistractors(correctWord, count = 3) {
        // Find words of the same type if possible
        const sameType = this.dm.words.filter(w => w.type === correctWord.type && w.id !== correctWord.id);
        const pool = sameType.length >= count ? sameType : this.dm.words.filter(w => w.id !== correctWord.id);
        
        // Shuffle pool
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }
    
    _blankOutWord(text, word, placeholder = '_______') {
        if (!text) return placeholder;
        let cleanWord = word.replace(/\(.*?\)/g, '').trim();
        if (cleanWord.length < 2) return placeholder;
        
        try {
            // Case insensitive match for the exact word
            let regex = new RegExp(`\\b${cleanWord}\\b`, 'gi');
            let res = text.replace(regex, placeholder);
            if (res !== text) return res;
            
            // Try matching common suffixes
            regex = new RegExp(`\\b${cleanWord}(?:s|es|d|ed|ing|ly)\\b`, 'gi');
            res = text.replace(regex, placeholder);
            if (res !== text) return res;
        } catch (e) {
            // regex error fallback
        }
        
        // Fallback string replacement
        const lowerText = text.toLowerCase();
        const lowerWord = cleanWord.toLowerCase();
        const idx = lowerText.indexOf(lowerWord);
        if (idx !== -1) {
            return text.substring(0, idx) + placeholder + text.substring(idx + lowerWord.length);
        }
        
        return placeholder;
    }

    _renderQuestionLayout() {
        const masteredCount = this.queue.filter(w => w.streak >= 1).length;
        const progressPct = (masteredCount / this.originalCount) * 100;

        let contentHtml = '';
        
        if (this.currentType === 'mcq_trans') {
            contentHtml = this._getMCQTransHtml();
        } else if (this.currentType === 'mcq_blank') {
            contentHtml = this._getMCQBlankHtml();
        } else {
            contentHtml = this._getTypingBlankHtml();
        }

        this.container.innerHTML = `
            <div class="quiz-header">
                <button class="btn-icon" id="btn-quit-vocab-quiz" title="Thoát">
                    <i class="ph ph-x"></i>
                </button>
                <div class="quiz-progress" style="flex:1; background: var(--surface2); height: 8px; border-radius: 4px; overflow:hidden;">
                    <div class="quiz-progress-fill" style="width: ${progressPct}%; background: var(--green); height: 100%; transition: width 0.3s;"></div>
                </div>
                <div class="quiz-score" style="font-weight:bold; color:var(--text2);">${masteredCount}/${this.originalCount}</div>
            </div>

            <div class="quiz-body fade-in" style="max-width: 600px; margin: 0 auto;">
                ${contentHtml}
                
                <div id="adv-feedback-area" class="hidden" style="margin-top: 24px; padding: 20px; border-radius: 12px; background: var(--surface2); border: 1px solid var(--border);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div id="adv-feedback-content">
                            <h3 id="adv-feedback-title" style="margin-bottom: 8px; font-size:20px;"></h3>
                            <div style="font-size:18px; font-weight:bold; color:var(--primary); margin-bottom: 4px;">
                                ${this.currentWord.word} <span style="font-weight:normal; color:var(--text3); font-size:15px;">${this.currentWord.ipa || ''}</span>
                            </div>
                            <div style="color:var(--text2); margin-bottom: 12px;">${this.currentWord.meaning}</div>
                            <div style="font-style:italic; color:var(--text); font-size: 15px;">"${this.currentWord.example || ''}"</div>
                        </div>
                        <button class="btn-icon" id="adv-btn-speak" style="color:var(--blue);"><i class="ph-fill ph-speaker-high"></i></button>
                    </div>
                    <button class="btn btn-primary btn-full" id="adv-btn-next" style="margin-top: 20px;">Tiếp tục (Enter)</button>
                </div>
            </div>
        `;
        
        this._attachEvents();
    }

    _getMCQTransHtml() {
        const distractors = this._generateDistractors(this.currentWord, 3);
        const options = [...distractors, this.currentWord].sort(() => Math.random() - 0.5);
        this.currentOptions = options;

        let optsHtml = options.map((opt, i) => `
            <button class="option-btn adv-mcq-btn" data-id="${opt.word}">
                <span class="opt-key">${i + 1}</span>
                <span style="font-size: 18px;">${opt.word}</span>
            </button>
        `).join('');

        return `
            <div class="quiz-question-label">Chọn từ vựng đúng:</div>
            <div class="quiz-question" style="text-align:center; color:var(--primary); margin: 20px 0; font-size: 24px;">
                "${this.currentWord.meaning}"
            </div>
            <div class="options-list">
                ${optsHtml}
            </div>
        `;
    }

    _getMCQBlankHtml() {
        const rich = null;
        
        let sentence = "";
        let meaningHtml = "";
        let options = [];
        
        if (rich && rich.mcq) {
            sentence = rich.mcq.sentence;
            meaningHtml = `Nghĩa câu: ${rich.mcq.translation}`;
            const distractors = (rich.mcq.distractors || []).map(d => ({id: 'wrong_'+d, word: d}));
            options = [...distractors.slice(0,3), this.currentWord].sort(() => Math.random() - 0.5);
            this.currentExplanation = rich.mcq.explanation;
        } else {
            sentence = this._blankOutWord(this.currentWord.example, this.currentWord.word);
            meaningHtml = `Nghĩa: ${this.currentWord.meaning}`;
            const distractors = this._generateDistractors(this.currentWord, 3);
            options = [...distractors, this.currentWord].sort(() => Math.random() - 0.5);
            this.currentExplanation = null;
        }
        
        this.currentOptions = options;

        let optsHtml = options.map((opt, i) => `
            <button class="option-btn adv-mcq-btn" data-id="${opt.word}">
                <span class="opt-key">${i + 1}</span>
                <span style="font-size: 18px;">${opt.word}</span>
            </button>
        `).join('');

        return `
            <div class="quiz-question-label">Điền vào chỗ trống (Ngữ cảnh TOEIC):</div>
            <div class="quiz-question" style="margin: 20px 0; font-size: 20px; line-height: 1.5;">
                ${sentence}
            </div>
            <div style="font-size:14px; color:var(--text3); margin-bottom:16px;">${meaningHtml}</div>
            <div class="options-list">
                ${optsHtml}
            </div>
        `;
    }

    _getTypingBlankHtml() {
        const rich = null;
        
        let sentence = "";
        let meaningHtml = "";
        
        if (rich && rich.typing) {
            sentence = rich.typing.sentence;
            meaningHtml = `Nghĩa câu: ${rich.typing.translation}`;
            this.currentExplanation = null;
        } else {
            sentence = this._blankOutWord(this.currentWord.example, this.currentWord.word);
            meaningHtml = `Nghĩa: ${this.currentWord.meaning}`;
            this.currentExplanation = null;
        }
        
        return `
            <div class="quiz-question-label">Gõ từ tiếng Anh để hoàn thành câu:</div>
            <div class="quiz-question" style="margin: 20px 0; font-size: 20px; line-height: 1.5;">
                ${sentence}
            </div>
            <div style="font-size:14px; color:var(--text3); margin-bottom:16px;">${meaningHtml}</div>
            <div class="fill-input-wrap">
                <input type="text" id="adv-fill-input" class="fill-input" placeholder="Nhập từ vựng..." autocomplete="off">
            </div>
            <div style="display:flex; gap:10px; margin-top:20px;">
                <button class="btn btn-outline" id="adv-btn-hint" style="flex:1">Gợi ý</button>
                <button class="btn btn-primary" id="adv-btn-submit" style="flex:2">Kiểm tra</button>
            </div>
        `;
    }

    _attachEvents() {
        document.getElementById('btn-quit-vocab-quiz').onclick = () => {
            this.container.classList.add('hidden');
            this.vocabContainer.classList.remove('hidden');
        };

        if (this.currentType === 'mcq_trans' || this.currentType === 'mcq_blank') {
            const btns = this.container.querySelectorAll('.adv-mcq-btn');
            btns.forEach(btn => {
                btn.onclick = () => this._handleAnswer(btn.dataset.id === this.currentWord.word, btn);
            });
            
            // Keyboard shortcuts
            this._keydownHandler = (e) => {
                if (this._isShowingFeedback) {
                    if (e.key === 'Enter') document.getElementById('adv-btn-next').click();
                    return;
                }
                const num = parseInt(e.key);
                if (num >= 1 && num <= 4) {
                    const b = btns[num - 1];
                    if (b && !b.disabled) {
                        this._handleAnswer(b.dataset.id === this.currentWord.word, b);
                    }
                }
            };
            document.addEventListener('keydown', this._keydownHandler);
        } else {
            const input = document.getElementById('adv-fill-input');
            const submit = document.getElementById('adv-btn-submit');
            const hint = document.getElementById('adv-btn-hint');
            
            input.focus();
            
            submit.onclick = () => {
                const val = input.value.trim().toLowerCase();
                if (!val) return;
                const cleanWord = this.currentWord.word.replace(/\(.*?\)/g, '').trim().toLowerCase();
                this._handleAnswer(val === cleanWord, input);
            };
            
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') submit.click();
            });
            
            hint.onclick = () => {
                const cleanWord = this.currentWord.word.replace(/\(.*?\)/g, '').trim();
                input.value = cleanWord.charAt(0) + '...';
                input.focus();
            };
            
            this._keydownHandler = (e) => {
                if (this._isShowingFeedback && e.key === 'Enter') {
                    document.getElementById('adv-btn-next').click();
                }
            };
            document.addEventListener('keydown', this._keydownHandler);
        }
    }

    _handleAnswer(isCorrect, targetEl) {
        if (this._isShowingFeedback) return;
        this._isShowingFeedback = true;
        this.currentWord.askedCount++;

        if (isCorrect) {
            this.currentWord.streak++;
            this.sessionStats.correct++;
            if (this.ui.playSound) this.ui.playSound('correct');
            this.ui.showResult(true);
            if (targetEl) targetEl.classList.add('correct');
        } else {
            this.currentWord.streak = 0;
            this.currentWord.wrongCount++;
            this.sessionStats.wrong++;
            if (this.ui.playSound) this.ui.playSound('wrong');
            this.ui.showResult(false);
            if (targetEl) targetEl.classList.add('wrong');
            
            // Push to end of queue so it gets asked again
            this.queue = this.queue.filter(w => w.word !== this.currentWord.word);
            this.queue.push(this.currentWord);
        }
        
        if (this.currentType === 'mcq_trans' || this.currentType === 'mcq_blank') {
            this.container.querySelectorAll('.adv-mcq-btn').forEach(b => {
                b.disabled = true;
                if (b.dataset.id === this.currentWord.word && !isCorrect) b.classList.add('correct');
            });
        } else {
            if (targetEl) targetEl.disabled = true;
            document.getElementById('adv-btn-submit').disabled = true;
            document.getElementById('adv-btn-hint').disabled = true;
        }

        // Show detailed feedback
        const fbArea = document.getElementById('adv-feedback-area');
        const fbTitle = document.getElementById('adv-feedback-title');
        fbArea.classList.remove('hidden');
        
        if (isCorrect) {
            fbArea.style.borderColor = 'var(--green)';
            fbTitle.innerHTML = `<span style="color:var(--green)"><i class="ph-fill ph-check-circle"></i> Chính xác!</span>`;
        } else {
            fbArea.style.borderColor = 'var(--red)';
            fbTitle.innerHTML = `<span style="color:var(--red)"><i class="ph-fill ph-x-circle"></i> Chưa đúng!</span>`;
        }
        
        let explanationHtml = '';
        if (this.currentExplanation) {
            explanationHtml = `<div style="margin-top: 12px; padding: 12px; background: rgba(28, 176, 246, 0.1); border-left: 4px solid var(--blue); border-radius: 4px; font-size: 14px; color: var(--text);">
                <strong>Giải thích:</strong> ${this.currentExplanation}
            </div>`;
        }
        
        const contentDiv = document.getElementById('adv-feedback-content');
        contentDiv.innerHTML = `
            <h3 id="adv-feedback-title" style="margin-bottom: 8px; font-size:20px;">${fbTitle.innerHTML}</h3>
            <div style="font-size:18px; font-weight:bold; color:var(--primary); margin-bottom: 4px;">
                ${this.currentWord.word} <span style="font-weight:normal; color:var(--text3); font-size:15px;">${this.currentWord.ipa || ''}</span>
            </div>
            <div style="color:var(--text2); margin-bottom: 8px;">${this.currentWord.meaning}</div>
            <div style="font-style:italic; color:var(--text); font-size: 15px;">"${this.currentWord.example || ''}"</div>
            ${explanationHtml}
        `;
        
        document.getElementById('adv-btn-speak').onclick = () => {
            this.ui.speak(this.currentWord.word);
        };
        
        // Auto-play audio on answer
        setTimeout(() => this.ui.speak(this.currentWord.word), 300);

        const nextBtn = document.getElementById('adv-btn-next');
        nextBtn.focus();
        nextBtn.onclick = () => {
            this._isShowingFeedback = false;
            document.removeEventListener('keydown', this._keydownHandler);
            
            // If correct, remove from front of queue if we didn't re-push it
            if (isCorrect) {
                this.queue = this.queue.filter(w => w.word !== this.currentWord.word);
                // If not mastered yet, push to end to review later
                if (this.currentWord.streak < 1) {
                    this.queue.push(this.currentWord);
                }
            }
            
            this._nextQuestion();
        };
    }

    _showSummary() {
        const timeTaken = Math.round((Date.now() - this.sessionStats.startTime) / 1000);
        const mins = Math.floor(timeTaken / 60);
        const secs = timeTaken % 60;
        const timeStr = `${mins > 0 ? mins + 'm ' : ''}${secs}s`;
        
        const accuracy = Math.round((this.sessionStats.correct / (this.sessionStats.correct + this.sessionStats.wrong)) * 100) || 0;
        
        const weakWords = this.queue.filter(w => w.wrongCount > 0).sort((a,b) => b.wrongCount - a.wrongCount);
        
        let weakHtml = '';
        if (weakWords.length > 0) {
            weakHtml = `
                <h3 style="margin: 24px 0 12px; font-size: 18px;">Từ vựng cần ôn lại:</h3>
                <div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center; max-height:200px; overflow-y:auto; padding: 10px; background:var(--surface2); border-radius:8px;">
                    ${weakWords.map(w => `<div class="word-badge" style="background:var(--red-light); color:var(--red); border-color:var(--red);">
                        ${w.word} <span style="font-size:12px; opacity:0.8">(${w.wrongCount} lỗi)</span>
                    </div>`).join('')}
                </div>
            `;
        }

        this.container.innerHTML = `
            <div class="quiz-result fade-in" style="text-align:center; padding: 40px 20px; max-width:600px; margin:0 auto;">
                <img src="images/success.png" alt="Success" style="width:120px; margin-bottom:20px; filter: drop-shadow(0 10px 15px rgba(0,0,0,0.2));" onerror="this.style.display='none'">
                <h2 style="font-size: 28px; margin-bottom: 10px; color: var(--text);">Tuyệt vời! Bạn đã hoàn thành bài học.</h2>
                
                <div class="stats-row" style="margin-top:24px; display:grid; grid-template-columns: repeat(3, 1fr); gap:16px;">
                    <div class="stat-card" style="padding:16px;">
                        <p class="stat-value" style="color:var(--blue); font-size:24px;">${this.originalCount}</p>
                        <p class="stat-label">Từ đã ôn</p>
                    </div>
                    <div class="stat-card" style="padding:16px;">
                        <p class="stat-value" style="color:var(--green); font-size:24px;">${accuracy}%</p>
                        <p class="stat-label">Tỷ lệ đúng</p>
                    </div>
                    <div class="stat-card" style="padding:16px;">
                        <p class="stat-value" style="color:var(--orange); font-size:24px;">${timeStr}</p>
                        <p class="stat-label">Thời gian</p>
                    </div>
                </div>

                ${weakHtml}

                <div style="display:flex; gap:15px; justify-content:center; margin-top:30px;">
                    <button class="btn btn-outline" id="adv-btn-back">Về danh sách</button>
                    ${weakWords.length > 0 ? `<button class="btn btn-danger" id="adv-btn-review-weak">Ôn lại từ sai</button>` : ''}
                </div>
            </div>
        `;

        document.getElementById('adv-btn-back').onclick = () => {
            this.container.classList.add('hidden');
            this.vocabContainer.classList.remove('hidden');
        };

        const btnReview = document.getElementById('adv-btn-review-weak');
        if (btnReview) {
            btnReview.onclick = () => {
                this.start(weakWords);
            };
        }
    }
}
