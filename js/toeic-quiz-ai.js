export class ToeicQuizAiMode {
    constructor(dm, ui) {
        this.dm = dm;
        this.ui = ui;
        
        // Cache DOM elements
        this.viewAiContext = document.getElementById('view-ai-context');
        this.setupContainer = document.getElementById('ai-context-setup');
        this.loadingContainer = document.getElementById('ai-context-loading');
        this.workspaceContainer = document.getElementById('ai-context-workspace');
        this.summaryContainer = document.getElementById('ai-context-summary');
        
        this.modeCards = document.querySelectorAll('#ai-mode-selection .quiz-card-option');
        this.btnStart = document.getElementById('btn-start-ai-context');
        this.btnQuitSetup = document.getElementById('btn-quit-ai-setup');
        
        this.passageContent = document.getElementById('ai-context-passage-content');
        this.quizContent = document.getElementById('ai-context-quiz-content');
        this.qProgress = document.getElementById('ai-context-q-progress');
        
        this.btnQuit = document.getElementById('btn-ai-context-quit');
        this.btnReadAloud = document.getElementById('btn-ai-context-read-aloud');
        this.btnTranslate = document.getElementById('btn-ai-context-translate');
        
        this.sourceView = null; // To remember where to go back to (e.g., 'toeic-vocab-part' or 'quiz')
        this.words = [];
        this.targetWords = [];
        this.selectedMode = null;
        this.aiData = null;
        this.currentQIndex = 0;
        this.stats = { correct: 0, incorrect: 0, startTime: 0, wrongWords: {}, answers: [] };
        
        this._bindEvents();
    }

    _bindEvents() {
        this.modeCards.forEach(card => {
            card.addEventListener('click', () => {
                this.modeCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedMode = card.dataset.aiMode;
                this.btnStart.disabled = false;
            });
        });

        this.btnStart.addEventListener('click', () => {
            this._startGeneration();
        });

        this.btnQuitSetup.addEventListener('click', () => {
            this.ui.navigate(this.sourceView);
        });

        this.btnQuit.addEventListener('click', () => {
            if (confirm('Bạn có chắc muốn thoát bài học này không?')) {
                this.ui.navigate(this.sourceView);
            }
        });

        this.btnTranslate.addEventListener('click', () => {
            const viElements = this.passageContent.querySelectorAll('.ai-vi-text');
            viElements.forEach(el => el.classList.toggle('hidden'));
        });

        this.btnReadAloud.addEventListener('click', () => {
            if (!this.aiData || !this.aiData.content_en) return;
            const textToRead = this.aiData.content_en.replace(/<[^>]*>?/gm, ''); // Strip HTML
            this.ui.speak(textToRead);
        });
    }

    start(words, sourceView) {
        if (!words || words.length === 0) {
            this.ui.toast('Không có từ vựng nào để ôn tập.', 'error');
            return;
        }
        
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            this.ui.toast('Vui lòng vào Cài đặt để thêm Gemini API Key trước!', 'error');
            return;
        }

        this.words = words;
        this.sourceView = sourceView || 'quiz';
        
        // Reset state
        this.selectedMode = null;
        this.modeCards.forEach(c => c.classList.remove('selected'));
        this.btnStart.disabled = true;
        
        // Show setup view
        this.ui.navigate('ai-context');
        this.setupContainer.classList.remove('hidden');
        this.loadingContainer.classList.add('hidden');
        this.workspaceContainer.classList.add('hidden');
        this.summaryContainer.classList.add('hidden');
    }

    async _startGeneration() {
        if (!this.selectedMode) return;
        
        this.setupContainer.classList.add('hidden');
        this.loadingContainer.classList.remove('hidden');

        // Pick 5-10 words
        const numWords = Math.min(Math.floor(Math.random() * 6) + 5, this.words.length); // 5 to 10
        this.targetWords = [...this.words].sort(() => Math.random() - 0.5).slice(0, numWords);

        const wordListStr = this.targetWords.map(w => w.word).join(', ');

        const prompt = this._buildPrompt(this.selectedMode, wordListStr);
        
        try {
            const data = await this._callGemini(prompt);
            this.aiData = JSON.parse(data);
            this.loadingContainer.classList.add('hidden');
            this._initWorkspace();
        } catch (e) {
            console.error(e);
            this.loadingContainer.innerHTML = `<h3 style="color:var(--danger)">Lỗi tạo bài: ${e.message}</h3>
                <button class="btn btn-outline" style="margin-top:20px" onclick="document.getElementById('btn-quit-ai-setup').click()">Quay lại</button>`;
        }
    }

    _buildPrompt(mode, wordsList) {
        const baseInstructions = `
You are an expert TOEIC English teacher. Generate a ${mode} reading passage and a quiz using EXACTLY these vocabulary words: [${wordsList}].
The content must be natural, TOEIC-style (Office, Business, Email, Daily life), and engaging.
Return ONLY a valid JSON object with the exact following schema. Do not use Markdown formatting (\`\`\`json).

Schema:
{
    "title": "Title of the passage (e.g. Email Subject or Story Title)",
    "content_en": "The English passage (100-200 words). Enclose the target vocabulary words in <b>word</b> tags to highlight them.",
    "content_vi": "The Vietnamese translation of the entire passage.",
    "questions": [
        {
            "type": "mcq", // or "fill_in_blank"
            "question": "The question text (in English or Vietnamese)",
            "options": ["A", "B", "C", "D"], // Only if mcq
            "correct_answer": "A", // The correct option exactly as written in options, or the missing word if fill_in_blank
            "explanation": "Vietnamese explanation of why this is correct."
        }
    ],
    "vocabulary_review": [
        {
            "word": "target word",
            "context_meaning": "Meaning of the word in this specific context (Vietnamese)",
            "example": "A short English example sentence using this word."
        }
    ]
}

Ensure there are exactly 5 questions testing reading comprehension, vocabulary meaning, or inference based on the passage.
`;
        return baseInstructions;
    }

    async _callGemini(prompt) {
        const apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) throw new Error('Missing API Key');

        this.ui.toast('Đang kết nối tới AI...', 'info');
        const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const listData = await listResponse.json();
        if (listData.error) throw new Error(listData.error.message);

        const models = listData.models || [];
        const DEPRECATED = ['gemini-2.5', 'gemini-1.0'];
        const supported = models.filter(m =>
            m.supportedGenerationMethods &&
            m.supportedGenerationMethods.includes('generateContent') &&
            !DEPRECATED.some(d => m.name.includes(d))
        );

        const prioritized = [
            ...supported.filter(m => m.name.includes('gemini-1.5-flash')),
            ...supported.filter(m => m.name.includes('gemini-2.0-flash')),
            ...supported.filter(m => m.name.includes('flash') && !m.name.includes('1.5') && !m.name.includes('2.0')),
            ...supported.filter(m => !m.name.includes('flash'))
        ];

        if (prioritized.length === 0) throw new Error('No supported models found.');

        let lastError = null;
        for (const targetModel of prioritized) {
            const modelName = targetModel.name;
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.7 }
                    })
                });

                const data = await response.json();
                if (data.error) {
                    lastError = data.error.message;
                    continue;
                }

                let text = data.candidates[0].content.parts[0].text;
                text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
                return text;
            } catch (err) {
                lastError = err.message;
                if (err.message.includes('fetch')) break;
            }
        }
        
        throw new Error(lastError || "Unknown API Error");
    }

    _initWorkspace() {
        this.workspaceContainer.classList.remove('hidden');
        this.stats = { correct: 0, incorrect: 0, startTime: Date.now(), wrongWords: {}, answers: [] };
        this.currentQIndex = 0;

        // Render Passage
        let passageHtml = `
            <h2 style="color:var(--primary); margin-bottom:15px;">${this.aiData.title}</h2>
            <div style="margin-bottom:20px; white-space: pre-wrap;">
                ${this.aiData.content_en.replace(/<b>/g, '<b style="color:var(--primary); background:rgba(99,102,241,0.1); padding:2px 4px; border-radius:4px;">')}
            </div>
            <div class="ai-vi-text hidden" style="border-top:1px dashed var(--border); padding-top:15px; color:var(--text2); font-style:italic; white-space: pre-wrap;">
                ${this.aiData.content_vi}
            </div>
            
            <h3 style="margin-top:30px; margin-bottom:15px; font-size:16px;">Từ vựng trong bài</h3>
            <div style="display:flex; flex-direction:column; gap:10px;">
                ${this.aiData.vocabulary_review.map(v => `
                    <div style="background:var(--surface1); padding:10px; border-radius:8px; font-size:14px;">
                        <b style="color:var(--primary)">${v.word}</b>: ${v.context_meaning}
                        <br><span style="color:var(--text3)">Ví dụ: ${v.example}</span>
                    </div>
                `).join('')}
            </div>
        `;
        this.passageContent.innerHTML = passageHtml;

        this._renderQuestion();
    }

    _renderQuestion() {
        if (this.currentQIndex >= this.aiData.questions.length) {
            this._showSummary();
            return;
        }

        const q = this.aiData.questions[this.currentQIndex];
        this.qProgress.textContent = `${this.currentQIndex + 1}/${this.aiData.questions.length}`;

        let html = `
            <div style="font-size:16px; font-weight:600; margin-bottom:20px; color:var(--text1)">
                Câu ${this.currentQIndex + 1}: ${q.question}
            </div>
        `;

        if (q.type === 'mcq' && q.options && q.options.length > 0) {
            html += `<div style="display:flex; flex-direction:column; gap:10px;">`;
            q.options.forEach((opt, i) => {
                const cleanOpt = opt.replace(/^[A-D][\.\)]\s*/i, '');
                html += `<button class="btn btn-outline ai-opt-btn" data-val="${cleanOpt}" style="text-align:left; padding:12px; height:auto; line-height:1.4; white-space: normal;">${String.fromCharCode(65+i)}. ${cleanOpt}</button>`;
            });
            html += `</div>`;
        } else {
            html += `
                <input type="text" class="input" id="ai-q-input" placeholder="Nhập câu trả lời..." style="width:100%; margin-bottom:15px;">
                <button class="btn btn-primary" id="ai-q-submit" style="width:100%;">Kiểm tra</button>
            `;
        }

        html += `
            <div id="ai-q-feedback" class="hidden" style="margin-top:20px; padding:15px; border-radius:8px;"></div>
            <button class="btn btn-primary hidden" id="ai-q-next" style="width:100%; margin-top:15px;">Tiếp tục <i class="ph-bold ph-arrow-right"></i></button>
        `;

        this.quizContent.innerHTML = html;
        this._bindQuestionEvents(q);
    }

    _bindQuestionEvents(q) {
        const handleAnswer = (userAns, selectedBtn = null) => {
            const isCorrect = userAns.toLowerCase().trim() === q.correct_answer.toLowerCase().trim();
            const nextBtn = document.getElementById('ai-q-next');
            
            nextBtn.classList.remove('hidden');
            
            // Just highlight as selected (blue/primary), don't reveal right/wrong yet
            if (selectedBtn) {
                selectedBtn.style.background = 'rgba(28,176,246,0.1)';
                selectedBtn.style.borderColor = 'var(--primary)';
                selectedBtn.style.color = 'var(--primary)';
            }
            
            // Record answer for summary
            this.stats.answers.push({
                question: q.question,
                userAnswer: userAns,
                correctAnswer: q.correct_answer,
                isCorrect: isCorrect,
                explanation: q.explanation
            });
            
            if (isCorrect) {
                this.stats.correct++;
                this.ui.playSound('click'); // Just a neutral click sound
            } else {
                this.stats.incorrect++;
                this.ui.playSound('click'); // Neutral
                
                // Weak word tracking is now deferred to _showSummary to ensure correct context parsing
                // so we do nothing here for words.
            }

            // Disable inputs
            document.querySelectorAll('.ai-opt-btn').forEach(b => b.disabled = true);
            const inp = document.getElementById('ai-q-input');
            if (inp) inp.disabled = true;
            const sub = document.getElementById('ai-q-submit');
            if (sub) sub.disabled = true;
            
            nextBtn.focus();
        };

        if (q.type === 'mcq' && q.options && q.options.length > 0) {
            document.querySelectorAll('.ai-opt-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (btn.disabled) return;
                    handleAnswer(btn.dataset.val, btn);
                });
            });
        } else {
            const inp = document.getElementById('ai-q-input');
            const sub = document.getElementById('ai-q-submit');
            inp.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') handleAnswer(inp.value);
            });
            sub.addEventListener('click', () => handleAnswer(inp.value));
            inp.focus();
        }

        document.getElementById('ai-q-next').addEventListener('click', () => {
            this.currentQIndex++;
            this._renderQuestion();
        });
    }

    _showSummary() {
        this.workspaceContainer.classList.add('hidden');
        this.summaryContainer.classList.remove('hidden');

        const total = this.aiData.questions.length;
        const accuracy = total > 0 ? Math.round((this.stats.correct / total) * 100) : 0;
        const timeSecs = Math.round((Date.now() - this.stats.startTime) / 1000);
        const mins = Math.floor(timeSecs / 60);
        const secs = timeSecs % 60;
        
        let weakWordsArr = [];
        let strongWordsArr = [];
        
        if (accuracy < 50) {
            // They did poorly, words they didn't get correct are weak
            this.targetWords.forEach(tw => {
                const twStr = tw.word.toLowerCase();
                // Check if user answered any question right that contained this word
                const isGotRight = this.stats.answers.some(ans => ans.isCorrect && (ans.question.toLowerCase().includes(twStr) || ans.correctAnswer.toLowerCase().includes(twStr) || ans.explanation.toLowerCase().includes(twStr)));
                
                if (isGotRight) {
                    strongWordsArr.push(tw);
                } else {
                    weakWordsArr.push(tw);
                    this.stats.wrongWords[tw.word] = tw; // for spaced rep update
                }
            });
        } else {
            // They did well, words they didn't get wrong are strong
            this.targetWords.forEach(tw => {
                const twStr = tw.word.toLowerCase();
                const isGotWrong = this.stats.answers.some(ans => !ans.isCorrect && (ans.question.toLowerCase().includes(twStr) || ans.correctAnswer.toLowerCase().includes(twStr) || ans.explanation.toLowerCase().includes(twStr)));
                
                if (isGotWrong) {
                    weakWordsArr.push(tw);
                    this.stats.wrongWords[tw.word] = tw; // for spaced rep update
                } else {
                    strongWordsArr.push(tw);
                }
            });
        }
        
        // Update spaced repetition for target words
        this.targetWords.forEach(tw => {
            const isWrong = !!this.stats.wrongWords[tw.word];
            this.dm.recordAnswer(tw.id, !isWrong);
        });

        const userLevel = Math.floor(this.dm.stats.xp / 100) + 1;

        let answersReviewHtml = this.stats.answers.map((ans, i) => `
            <div style="background:var(--bg1); padding:15px; border-radius:12px; margin-bottom:15px; text-align:left; border-left: 4px solid ${ans.isCorrect ? '#10B981' : '#EF4444'}">
                <div style="font-weight:bold; margin-bottom:10px; color:var(--text1)">Câu ${i+1}: ${ans.question}</div>
                <div style="font-size:14px; margin-bottom:5px;">
                    <span style="color:var(--text2)">Bạn chọn:</span> 
                    <span style="color:${ans.isCorrect ? '#10B981' : '#EF4444'}; font-weight:bold;">${ans.userAnswer}</span>
                </div>
                ${!ans.isCorrect ? `
                <div style="font-size:14px; margin-bottom:5px;">
                    <span style="color:var(--text2)">Đáp án đúng:</span> 
                    <span style="color:#10B981; font-weight:bold;">${ans.correctAnswer}</span>
                </div>
                ` : ''}
                <div style="font-size:14px; color:var(--text3); margin-top:10px; padding-top:10px; border-top:1px dashed var(--border);">
                    <i class="ph-fill ph-info"></i> ${ans.explanation}
                </div>
            </div>
        `).join('');

        this.summaryContainer.innerHTML = `
            <h2 style="font-size:32px; margin-bottom:10px; color:var(--primary);">Hoàn thành xuất sắc! 🎉</h2>
            <p style="color:var(--text2); margin-bottom:30px;">Bạn đã hoàn thành bài học ngữ cảnh AI.</p>
            
            <div style="display:flex; justify-content:center; flex-wrap:wrap; gap:15px; margin-bottom:30px;">
                <div style="background:var(--surface1); padding:15px; border-radius:12px; flex:1; min-width:100px;">
                    <div style="font-size:20px; font-weight:bold; color:var(--success);">${accuracy}%</div>
                    <div style="font-size:11px; color:var(--text3);">Độ chính xác</div>
                </div>
                <div style="background:var(--surface1); padding:15px; border-radius:12px; flex:1; min-width:100px;">
                    <div style="font-size:20px; font-weight:bold; color:var(--primary);">+${this.stats.correct * 10}</div>
                    <div style="font-size:11px; color:var(--text3);">XP Nhận được</div>
                </div>
                <div style="background:var(--surface1); padding:15px; border-radius:12px; flex:1; min-width:100px;">
                    <div style="font-size:20px; font-weight:bold; color:var(--orange);">${mins}p ${secs}s</div>
                    <div style="font-size:11px; color:var(--text3);">Thời gian</div>
                </div>
                <div style="background:var(--surface1); padding:15px; border-radius:12px; flex:1; min-width:100px;">
                    <div style="font-size:20px; font-weight:bold; color:#8B5CF6;">${userLevel}</div>
                    <div style="font-size:11px; color:var(--text3);">Cấp độ</div>
                </div>
                <div style="background:var(--surface1); padding:15px; border-radius:12px; flex:1; min-width:100px;">
                    <div style="font-size:20px; font-weight:bold; color:var(--yellow);">${this.dm.stats.streak} 🔥</div>
                    <div style="font-size:11px; color:var(--text3);">Chuỗi ngày</div>
                </div>
            </div>

            <div style="display:flex; gap:20px; margin-bottom:30px; flex-wrap:wrap;">
                <div style="flex:1; min-width:200px; text-align:left; background:rgba(239, 68, 68, 0.05); padding:20px; border-radius:12px; border:1px solid rgba(239, 68, 68, 0.2);">
                    <h3 style="color:#EF4444; margin-bottom:10px; font-size:16px;">Từ còn yếu (${weakWordsArr.length}):</h3>
                    ${weakWordsArr.length > 0 ? `
                        <div style="display:flex; flex-wrap:wrap; gap:8px;">
                            ${weakWordsArr.map(w => `<span class="tag" style="background:var(--bg1)">${w.word}</span>`).join('')}
                        </div>
                    ` : '<div style="color:var(--text3); font-size:14px;">Không có từ nào</div>'}
                </div>
                
                <div style="flex:1; min-width:200px; text-align:left; background:rgba(16, 185, 129, 0.05); padding:20px; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.2);">
                    <h3 style="color:#10B981; margin-bottom:10px; font-size:16px;">Từ đã thành thạo (${strongWordsArr.length}):</h3>
                    ${strongWordsArr.length > 0 ? `
                        <div style="display:flex; flex-wrap:wrap; gap:8px;">
                            ${strongWordsArr.map(w => `<span class="tag" style="background:var(--bg1)">${w.word}</span>`).join('')}
                        </div>
                    ` : '<div style="color:var(--text3); font-size:14px;">Không có từ nào</div>'}
                </div>
            </div>
            
            <div style="margin-bottom:30px;">
                <h3 style="color:var(--text1); font-size:20px; margin-bottom:15px; text-align:left;">Chi tiết đáp án:</h3>
                ${answersReviewHtml}
            </div>

            <div style="display:flex; justify-content:center; gap:15px;">
                <button class="btn btn-outline" id="btn-summary-quit">Quay lại</button>
                <button class="btn btn-primary" id="btn-summary-again">Gợi ý bài tiếp theo <i class="ph-bold ph-arrow-right"></i></button>
            </div>
        `;

        document.getElementById('btn-summary-quit').addEventListener('click', () => {
            this.ui.navigate(this.sourceView);
        });
        
        document.getElementById('btn-summary-again').addEventListener('click', () => {
            this.setupContainer.classList.remove('hidden');
            this.summaryContainer.classList.add('hidden');
            // Randomly select another mode to make it interesting
            const modes = Array.from(this.modeCards);
            const randomMode = modes[Math.floor(Math.random() * modes.length)];
            randomMode.click();
            this._startGeneration();
        });
        
        this.dm.addXP(this.stats.correct * 10);
    }
}
