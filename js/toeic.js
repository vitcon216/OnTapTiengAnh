export class ToeicMode {
    constructor(dm, ui) {
        this.dm = dm;
        this.ui = ui;
        this.questions = [];
        this.currentIdx = 0;
        this.difficulty = 'easy'; // easy: 5, medium: 10, hard: 20
        this.score = 0;
        this.startTime = 0;
        this.timerInterval = null;
        this.wrongWords = new Set();
        this.isReviewingWrong = false;
        
        // Templates for Part 6 & 7
        this.part7Templates = [
            {
                type: 'Email',
                content: `To: All Employees\nFrom: Management\nDate: October 12\nSubject: Important Update\n\nDear Team,\n\nWe would like to inform you about the recent changes in our policy. As you know, the role of a {w1} is crucial to our success. Starting next month, we will require everyone to use the new {w2} system. \n\nPlease make sure to read the guidelines carefully. If you encounter any {w3}, contact the IT support immediately.\n\nBest regards,\nManagement`,
                questions: (w1, w2, w3) => [
                    {
                        q: "What is the main purpose of this email?",
                        options: ["To announce a policy change", "To invite employees to a party", "To complain about a product", "To introduce a new manager"],
                        ans: "To announce a policy change"
                    },
                    {
                        q: `In the email, what does the word "${w1.word}" most likely mean?`,
                        options: [w1.meaning, ...this.ui.pickDistractors(w1, this.dm.words, 3).map(w => w.meaning)],
                        ans: w1.meaning,
                        targetWord: w1
                    },
                    {
                        q: `According to the email, what should employees do if they encounter a "${w3.word}"?`,
                        options: ["Contact IT support", "Ignore it", "Ask the manager", "Read the guidelines again"],
                        ans: "Contact IT support",
                        targetWord: w3
                    }
                ]
            },
            {
                type: 'Notice',
                content: `NOTICE TO ALL PASSENGERS\n\nAttention all passengers waiting for flight 45B to London. The {w1} will be delayed by approximately two hours due to severe weather conditions. \n\nWe apologize for the inconvenience. Please remain in the {w2} area until further announcements are made. A complimentary {w3} will be provided at the service desk.\n\nThank you for your patience.`,
                questions: (w1, w2, w3) => [
                    {
                        q: "Where would this notice most likely be seen?",
                        options: ["At an airport", "In a hospital", "At a train station", "In a restaurant"],
                        ans: "At an airport"
                    },
                    {
                        q: `What is being provided at the service desk?`,
                        options: [`A ${w3.word}`, `A new ticket`, `A refund`, `A ${w1.word}`],
                        ans: `A ${w3.word}`,
                        targetWord: w3
                    },
                    {
                        q: `What is the meaning of "${w2.word}" in this notice?`,
                        options: [w2.meaning, ...this.ui.pickDistractors(w2, this.dm.words, 3).map(w => w.meaning)],
                        ans: w2.meaning,
                        targetWord: w2
                    }
                ]
            }
        ];
    }

    init() {
        // Events will be bound from app.js
        document.getElementById('toeic-exit').addEventListener('click', () => this.exit());
        document.getElementById('toeic-generate-btn').addEventListener('click', () => {
            this.generateTest(document.getElementById('toeic-difficulty').value);
        });
        document.getElementById('toeic-review-wrong-btn').addEventListener('click', () => {
            this.reviewWrong();
        });
        document.getElementById('toeic-practice-again-btn').addEventListener('click', () => {
            document.getElementById('toeic-result').classList.add('hidden');
            document.getElementById('toeic-setup').classList.remove('hidden');
        });
    }

    start() {
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        document.getElementById('view-toeic').classList.remove('hidden');
        document.getElementById('toeic-setup').classList.remove('hidden');
        document.getElementById('toeic-active').classList.add('hidden');
        document.getElementById('toeic-result').classList.add('hidden');
    }

    generateTest(difficulty = 'easy', pool = null) {
        this.difficulty = difficulty;
        this.isReviewingWrong = false;
        
        let words = pool;
        if (!words) {
            words = [...this.dm.learnedWords, ...this.dm.dueWords];
            // Unique words
            words = [...new Map(words.map(item => [item.id, item])).values()];
        }
        
        if (words.length < 10) {
            this.ui.toast('Bạn cần học ít nhất 10 từ để tạo đề TOEIC!', 'error');
            return;
        }

        let numQ = 5;
        if (difficulty === 'medium') numQ = 10;
        if (difficulty === 'hard') numQ = 20;
        if (pool) numQ = pool.length; // Review mode

        this.questions = [];
        this.wrongWords.clear();
        this.score = 0;
        this.currentIdx = 0;
        
        // Randomly pick mix of Part 5, 6, 7
        const shuffledWords = this.ui.shuffle([...words]);
        let wordIdx = 0;

        while (this.questions.length < numQ && wordIdx < shuffledWords.length) {
            const r = Math.random();
            if (r < 0.5) {
                // Part 5
                const w = shuffledWords[wordIdx++];
                if (w && w.example) {
                    const p5Q = this._createPart5(w);
                    if (p5Q) this.questions.push(p5Q);
                }
            } else if (r < 0.75) {
                // Part 6 (Group of 3 questions)
                if (wordIdx + 3 <= shuffledWords.length) {
                    const w1 = shuffledWords[wordIdx++];
                    const w2 = shuffledWords[wordIdx++];
                    const w3 = shuffledWords[wordIdx++];
                    if (w1.example && w2.example && w3.example) {
                        const p6Qs = this._createPart6([w1, w2, w3]);
                        this.questions.push(...p6Qs);
                    }
                }
            } else {
                // Part 7 (Group of 3 questions)
                if (wordIdx + 3 <= shuffledWords.length) {
                    const w1 = shuffledWords[wordIdx++];
                    const w2 = shuffledWords[wordIdx++];
                    const w3 = shuffledWords[wordIdx++];
                    const p7Qs = this._createPart7(w1, w2, w3);
                    this.questions.push(...p7Qs);
                }
            }
        }
        
        // Trim to exact length if exceeded due to grouped questions
        this.questions = this.questions.slice(0, numQ);
        
        if (this.questions.length === 0) {
            this.ui.toast('Không đủ dữ liệu câu ví dụ để tạo bài!', 'error');
            return;
        }

        this._startSession();
    }
    
    reviewWrong() {
        if (this.wrongWords.size === 0) return;
        const words = Array.from(this.wrongWords);
        this.generateTest('custom', words);
        this.isReviewingWrong = true;
    }

    _blankOutWord(text, word, placeholder) {
        // 1. Exact match
        let regex = new RegExp(`\\b${word}\\b`, 'gi');
        let res = text.replace(regex, placeholder);
        if (res !== text) return res;
        
        // 2. Simple suffixes (s, es, d, ed, ing, ly)
        regex = new RegExp(`\\b${word}(?:s|es|d|ed|ing|ly)\\b`, 'gi');
        res = text.replace(regex, placeholder);
        if (res !== text) return res;
        
        // 3. Remove last letter (e.g. make -> making, apply -> applied)
        if (word.length > 3) {
            const base1 = word.slice(0, -1);
            regex = new RegExp(`\\b${base1}(?:ing|ed|ies|ied|y|ily|ion|ation|ment)\\b`, 'gi');
            res = text.replace(regex, placeholder);
            if (res !== text) return res;
        }
        
        // 4. Remove last two letters
        if (word.length > 4) {
            const base2 = word.slice(0, -2);
            regex = new RegExp(`\\b${base2}[a-z]{1,4}\\b`, 'gi');
            res = text.replace(regex, placeholder);
            if (res !== text) return res;
        }
        
        // 5. Fallback case-insensitive search (might match inside other words, but better than nothing)
        if (word.length > 3) {
            regex = new RegExp(word, 'gi');
            res = text.replace(regex, placeholder);
            if (res !== text) return res;
        }

        return null;
    }

    _createPart5(w) {
        // Blank out the word in the example
        const text = this._blankOutWord(w.example, w.word, '_______');
        if (!text) return null; // Cannot find word in sentence
        
        const distractors = this.ui.pickDistractors(w, this.dm.words, 3);
        const options = this.ui.shuffle([w, ...distractors]);
        
        return {
            part: 5,
            targetWord: w,
            text: text,
            options: options,
            ansId: w.id
        };
    }

    _createPart6(words) {
        // Combine 3 examples into a paragraph
        let textHtml = '';
        const qs = [];
        words.forEach((w, i) => {
            let blanked = this._blankOutWord(w.example, w.word, `<span class="toeic-blank">(${i+1})</span>`);
            if (!blanked) blanked = w.example + ` <span class="toeic-blank">(${i+1})</span>`; // ultimate fallback
            textHtml += blanked + ' ';
            
            const distractors = this.ui.pickDistractors(w, this.dm.words, 3);
            const options = this.ui.shuffle([w, ...distractors]);
            
            qs.push({
                part: 6,
                targetWord: w,
                textHtml: textHtml, // Provide partial context
                options: options,
                ansId: w.id,
                blankNum: i + 1,
                isSubQuestion: i > 0
            });
        });
        // Attach full paragraph to all questions in this group
        qs.forEach(q => q.fullTextHtml = textHtml);
        return qs;
    }

    _createPart7(w1, w2, w3) {
        const tpl = this.part7Templates[Math.floor(Math.random() * this.part7Templates.length)];
        let content = tpl.content.replace('{w1}', `<strong>${w1.word}</strong>`)
                                 .replace('{w2}', `<strong>${w2.word}</strong>`)
                                 .replace('{w3}', `<strong>${w3.word}</strong>`);
        
        const qData = tpl.questions(w1, w2, w3);
        const qs = [];
        
        qData.forEach((q, i) => {
            const shuffledOptions = this.ui.shuffle([...q.options]);
            qs.push({
                part: 7,
                passageType: tpl.type,
                passage: content,
                questionText: q.q,
                optionsText: shuffledOptions,
                ansText: q.ans,
                targetWord: q.targetWord,
                isSubQuestion: i > 0
            });
        });
        
        return qs;
    }

    _startSession() {
        document.getElementById('toeic-setup').classList.add('hidden');
        document.getElementById('toeic-result').classList.add('hidden');
        document.getElementById('toeic-active').classList.remove('hidden');
        
        this.startTime = Date.now();
        this._startTimer();
        this._renderQuestion();
    }

    _startTimer() {
        clearInterval(this.timerInterval);
        const el = document.getElementById('toeic-timer');
        this.timerInterval = setInterval(() => {
            const s = Math.floor((Date.now() - this.startTime) / 1000);
            const m = Math.floor(s / 60);
            const sec = s % 60;
            el.textContent = `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        }, 1000);
    }

    _renderQuestion() {
        if (this.currentIdx >= this.questions.length) {
            this._finish();
            return;
        }

        const q = this.questions[this.currentIdx];
        const body = document.getElementById('toeic-body');
        const progress = document.getElementById('toeic-progress');
        progress.style.width = `${(this.currentIdx / this.questions.length) * 100}%`;
        document.getElementById('toeic-counter').textContent = `${this.currentIdx + 1} / ${this.questions.length}`;
        
        body.innerHTML = '';
        
        const wrap = document.createElement('div');
        wrap.className = 'toeic-q-wrap fade-in';
        
        if (q.part === 5) {
            wrap.innerHTML = `
                <div class="toeic-part-label">Part 5: Incomplete Sentences</div>
                <div class="toeic-q-text">${q.text}</div>
                <div class="options-list" id="toeic-options"></div>
            `;
            body.appendChild(wrap);
            this._renderOptionsPart56(q.options, q.ansId, q.targetWord);
        } 
        else if (q.part === 6) {
            wrap.innerHTML = `
                <div class="toeic-part-label">Part 6: Text Completion</div>
                <div class="toeic-passage">${q.fullTextHtml}</div>
                <div class="toeic-q-text" style="margin-top:20px;">Question for blank (${q.blankNum}):</div>
                <div class="options-list" id="toeic-options"></div>
            `;
            body.appendChild(wrap);
            this._renderOptionsPart56(q.options, q.ansId, q.targetWord);
        }
        else if (q.part === 7) {
            wrap.innerHTML = `
                <div class="toeic-part-label">Part 7: Reading Comprehension (${q.passageType})</div>
                <div class="toeic-passage">${q.passage.replace(/\n/g, '<br>')}</div>
                <div class="toeic-q-text" style="margin-top:20px;">${q.questionText}</div>
                <div class="options-list" id="toeic-options"></div>
            `;
            body.appendChild(wrap);
            this._renderOptionsPart7(q.optionsText, q.ansText, q.targetWord);
        }
    }

    _renderOptionsPart56(options, correctId, targetWord) {
        const ol = document.getElementById('toeic-options');
        options.forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerHTML = `<span class="opt-key">${i + 1}</span>${opt.word}`;
            btn.addEventListener('click', (e) => this._checkAnswer(opt.id === correctId, btn, targetWord));
            ol.appendChild(btn);
        });
    }

    _renderOptionsPart7(optionsText, correctAns, targetWord) {
        const ol = document.getElementById('toeic-options');
        optionsText.forEach((optText, i) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerHTML = `<span class="opt-key">${i + 1}</span>${optText}`;
            btn.addEventListener('click', (e) => this._checkAnswer(optText === correctAns, btn, targetWord));
            ol.appendChild(btn);
        });
    }

    _checkAnswer(isCorrect, btn, targetWord) {
        if (this.answered) return;
        this.answered = true;
        
        document.querySelectorAll('#toeic-options .option-btn').forEach(b => {
            b.disabled = true;
        });
        
        if (isCorrect) {
            btn.classList.add('correct');
            this.score++;
            this.ui.showResult(true);
            if (targetWord && !this.isReviewingWrong) {
                this.dm.recordAnswer(targetWord.id, true);
            }
        } else {
            btn.classList.add('wrong');
            this.ui.showResult(false);
            if (targetWord) {
                this.wrongWords.add(targetWord);
                if (!this.isReviewingWrong) {
                    this.dm.recordAnswer(targetWord.id, false);
                }
            }
        }

        // Show Explanation
        if (targetWord) {
            const expl = document.createElement('div');
            expl.className = 'toeic-explanation fade-in';
            expl.innerHTML = `
                <strong>Giải thích:</strong> Từ cần chú ý là <strong style="color:var(--primary)">${targetWord.word}</strong> (${targetWord.type || ''})<br>
                <em>Nghĩa:</em> ${targetWord.meaning}<br>
                ${targetWord.translation ? `<em>Dịch:</em> ${targetWord.translation}` : ''}
            `;
            document.getElementById('toeic-body').appendChild(expl);
        }

        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-primary btn-full';
        nextBtn.style.marginTop = '16px';
        nextBtn.textContent = 'Tiếp tục (Enter)';
        nextBtn.onclick = () => {
            this.answered = false;
            this.currentIdx++;
            this._renderQuestion();
        };
        document.getElementById('toeic-body').appendChild(nextBtn);
        nextBtn.focus();
    }

    _finish() {
        clearInterval(this.timerInterval);
        document.getElementById('toeic-active').classList.add('hidden');
        document.getElementById('toeic-result').classList.remove('hidden');
        
        const accuracy = Math.round((this.score / this.questions.length) * 100);
        document.getElementById('toeic-res-score').textContent = `${this.score} / ${this.questions.length}`;
        document.getElementById('toeic-res-accuracy').textContent = `${accuracy}%`;
        document.getElementById('toeic-res-time').textContent = document.getElementById('toeic-timer').textContent;
        
        const xpEarned = this.score * 5;
        document.getElementById('toeic-res-xp').textContent = `+${xpEarned} XP`;
        this.dm.addXP(xpEarned);
        
        const reviewBtn = document.getElementById('toeic-review-wrong-btn');
        if (this.wrongWords.size > 0) {
            reviewBtn.style.display = 'block';
            reviewBtn.textContent = `Ôn lại ${this.wrongWords.size} câu sai`;
        } else {
            reviewBtn.style.display = 'none';
        }
        
        document.dispatchEvent(new Event('stats-updated'));
    }
    
    exit() {
        clearInterval(this.timerInterval);
        this.ui.navigate('dashboard');
    }
}
