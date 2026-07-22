export class ToeicVocabPartMode {
    constructor(dataManager, uiManager, advancedQuiz, aiQuiz) {
        this.dm = dataManager;
        this.ui = uiManager;
        this.advancedQuiz = advancedQuiz;
        this.aiQuiz = aiQuiz;
        this.container = document.getElementById('toeic-vocab-part-container');
        this.quizContainer = document.getElementById('toeic-vocab-quiz-container');
        this.parts = [
            { id: 'Listening', title: 'Listening (Part 1-4)', desc: 'Từ vựng luyện nghe' },
            { id: 'Reading', title: 'Reading (Part 5-7)', desc: 'Từ vựng đọc hiểu' },
            { id: 'General', title: 'Từ vựng Chung', desc: 'Từ vựng phổ quát' }
        ];
        this.currentQuizWords = [];
        this.currentQuizIndex = 0;
        this.score = 0;
    }

    start() {
        this._renderPartsList();
        
        // Handle back button on the toolbar
        document.getElementById('btn-back-home-toeic-vocab').onclick = () => {
            this.ui.navigate('dashboard');
        };
    }

    _renderPartsList() {
        this.container.classList.remove('hidden');
        this.quizContainer.classList.add('hidden');
        
        this.container.innerHTML = `<div class="toeic-parts-grid"></div>`;
        const grid = this.container.querySelector('.toeic-parts-grid');
        
        const wordsByPart = {
            'Listening': [],
            'Reading': [],
            'General': []
        };
        
        if (this.dm.words) {
            this.dm.words.forEach(w => {
                if (w.topic && w.topic.startsWith('Moon.vn | ')) {
                    const partStr = w.topic.replace('Moon.vn | ', '').trim();
                    if (wordsByPart[partStr]) {
                        wordsByPart[partStr].push(w);
                    } else if (wordsByPart['General']) {
                        wordsByPart['General'].push(w);
                    }
                }
            });
        }

        this.parts.forEach(p => {
            const count = wordsByPart[p.id].length;
            const card = document.createElement('div');
            card.className = 'toeic-part-card';
            card.innerHTML = `
                <div class="part-card-title">${p.title}</div>
                <div class="part-card-desc">${p.desc}</div>
                <div class="part-card-count">${count} từ vựng</div>
            `;
            card.onclick = () => {
                if (count > 0) {
                    this._renderVocabListForPart(p, wordsByPart[p.id]);
                } else {
                    app.ui.showToast('Chưa có từ vựng nào cho phần này.', 'warning');
                }
            };
            grid.appendChild(card);
        });
    }

    _renderVocabListForPart(partInfo, words) {
        this.container.innerHTML = `
            <div class="toeic-part-header" style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <button class="btn-back-parts" id="btn-back-parts-vocab" title="Quay lại">
                        <i class="ph ph-arrow-left"></i>
                    </button>
                    <h3 style="font-size: 20px; color: var(--text);">${partInfo.title}</h3>
                </div>
                <div style="display:flex; gap: 8px;">
                    <button class="btn btn-outline" id="btn-practice-fill" style="background:var(--surface); color:var(--text); border-color:var(--border);">
                        <i class="ph-fill ph-pencil-simple"></i> Điền từ
                    </button>
                    <button class="btn btn-primary" id="btn-practice-ai" style="background:linear-gradient(135deg, #8B5CF6, #4F46E5); color:#fff; border:none; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);">
                        <i class="ph-fill ph-magic-wand"></i> Ngữ cảnh AI
                    </button>
                </div>
            </div>
            <div class="word-list" id="part-vocab-list"></div>
        `;
        
        document.getElementById('btn-back-parts-vocab').onclick = () => this._renderPartsList();
        
        document.getElementById('btn-practice-fill').onclick = () => {
            this.advancedQuiz.start(words);
        };
        
        document.getElementById('btn-practice-ai').onclick = () => {
            if (this.aiQuiz) {
                this.aiQuiz.start(words, 'toeic');
            } else {
                app.ui.showToast('Module AI chưa được khởi tạo.', 'error');
            }
        };
        
        const listContainer = document.getElementById('part-vocab-list');
        
        words.forEach(word => {
            const el = document.createElement('div');
            el.className = 'word-item';
            el.innerHTML = `
                <div class="word-main">
                    <span class="word-text">${word.word}</span>
                    ${word.ipa ? `<span class="word-ipa">${word.ipa}</span>` : ''}
                    ${word.type ? `<span class="word-type">(${word.type})</span>` : ''}
                </div>
                <div class="word-meaning">${word.meaning}</div>
                <div class="word-actions">
                    <button class="btn-icon btn-tts" data-word="${word.word}" title="Nghe phát âm">
                        <i class="ph ph-speaker-high"></i>
                    </button>
                </div>
            `;
            const ttsBtn = el.querySelector('.btn-tts');
            if (ttsBtn) {
                ttsBtn.onclick = (e) => {
                    e.stopPropagation();
                    // Some words might have brackets like "look (at / in)"
                    let cleanWord = word.word.replace(/\(.*?\)/g, '').trim();
                    this.ui.speak(cleanWord);
                };
            }
            listContainer.appendChild(el);
        });
    }
}
