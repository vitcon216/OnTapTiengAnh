/**
 * ui.js — Navigation, Theme, Toast, TTS, Confetti, Modal, Achievements
 */

const ACHIEVEMENTS = [
    { id: 'first_word',    icon: '🌱', name: 'Khởi đầu',      desc: 'Học từ đầu tiên',         check: (dm) => dm.learnedWords.length >= 1 },
    { id: 'ten_words',     icon: '📚', name: 'Chăm chỉ',      desc: 'Học 10 từ',               check: (dm) => dm.learnedWords.length >= 10 },
    { id: 'fifty_words',   icon: '🎯', name: 'Nỗ lực',        desc: 'Học 50 từ',               check: (dm) => dm.learnedWords.length >= 50 },
    { id: 'all_words',     icon: '🏆', name: 'Chinh phục',    desc: 'Học hết tất cả từ',       check: (dm) => dm.completionRate === 100 },
    { id: 'streak_3',      icon: '🔥', name: 'Học đều đặn',   desc: '3 ngày liên tiếp',        check: (dm) => dm.stats.streak >= 3 },
    { id: 'streak_7',      icon: '⚡', name: 'Tia sét',       desc: '7 ngày liên tiếp',        check: (dm) => dm.stats.streak >= 7 },
    { id: 'perfect_quiz',  icon: '💯', name: 'Hoàn hảo',      desc: 'Quiz không mắc lỗi',      check: (dm) => dm.accuracyRate >= 90 && (dm.stats.totalCorrect + dm.stats.totalWrong) >= 10 },
    { id: 'night_owl',     icon: '🦉', name: 'Cú đêm',        desc: 'Học sau 22:00',           check: () => new Date().getHours() >= 22 },
];

export class UIManager {
    constructor(dataManager) {
        this.dm     = dataManager;
        this.synth  = window.speechSynthesis;
        this._currentView = 'dashboard';
        this._unlockedAchievements = new Set(
            JSON.parse(localStorage.getItem('engvocab_achievements') || '[]')
        );
        
        // Audio elements & mobile unlock policy
        this.ttsAudio = new Audio();
        this._audioUnlocked = false;
        
        const unlock = () => {
            if (this._audioUnlocked) return;
            // Unlock HTML Audio by playing a silent sound
            this.ttsAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
            this.ttsAudio.volume = 0;
            this.ttsAudio.play().then(() => {
                this.ttsAudio.pause();
                this.ttsAudio.volume = 1;
            }).catch(() => {});
            
            // Unlock Web Speech API
            const utt = new SpeechSynthesisUtterance('');
            utt.volume = 0;
            this.synth.speak(utt);
            
            this._audioUnlocked = true;
            document.removeEventListener('touchstart', unlock);
            document.removeEventListener('click', unlock);
        };
        
        document.addEventListener('touchstart', unlock);
        document.addEventListener('click', unlock);
    }

    /* ── Navigation ──────────────────────────── */
    navigate(viewId) {
        // Hide current
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        // Show new
        const el = document.getElementById(`view-${viewId}`);
        if (el) {
            el.classList.remove('hidden');
            el.classList.add('active');
        }
        // Update nav
        document.querySelectorAll('.nav-item').forEach(li => {
            li.classList.toggle('active', li.dataset.view === viewId);
        });
        // Update title
        const titles = {
            dashboard: 'Trang chủ',
            wordlist:  'Từ vựng',
            flashcards:'Flashcard',
            quiz:      'Ôn tập',
            stats:     'Thống kê',
            settings:  'Cài đặt',
        };
        document.getElementById('page-title').textContent = titles[viewId] || '';
        this._currentView = viewId;

        // Close mobile sidebar
        this.closeSidebar();
    }

    currentView() { return this._currentView; }

    /* ── Theme ───────────────────────────────── */
    initTheme() {
        const saved = localStorage.getItem('engvocab_theme') || 'light';
        this.setTheme(saved);
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
    }

    setTheme(mode) {
        document.documentElement.setAttribute('data-theme', mode);
        localStorage.setItem('engvocab_theme', mode);
        const icon = document.getElementById('theme-icon');
        icon.className = mode === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
    }

    toggleTheme() {
        const curr = document.documentElement.getAttribute('data-theme');
        this.setTheme(curr === 'dark' ? 'light' : 'dark');
    }

    /* ── Mobile sidebar ──────────────────────── */
    initMobileSidebar() {
        const btn     = document.getElementById('mobile-menu-btn');
        const overlay = document.getElementById('sidebar-overlay');
        const sidebar = document.getElementById('sidebar');
        btn.addEventListener('click', () => sidebar.classList.toggle('open'));
        overlay.addEventListener('click', () => this.closeSidebar());
    }

    closeSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.toggle('open',
            document.getElementById('sidebar').classList.contains('open'));
    }

    /* ── TTS ─────────────────────────────────── */
    speak(text, rate = 1) {
        if (!text) return;
        
        // Sử dụng Google TTS API để đồng bộ giọng đọc trên mọi thiết bị (kể cả iPhone)
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-US&client=tw-ob&q=${encodeURIComponent(text)}`;
        this.ttsAudio.src = url;
        this.ttsAudio.playbackRate = rate;
        this.ttsAudio.volume = 1;
        
        this.ttsAudio.play().catch(err => {
            console.warn("Lỗi tải âm thanh từ mạng, quay về dùng giọng mặc định của máy:", err);
            // Dự phòng: Nếu mất mạng, dùng lại giọng có sẵn trên máy
            this.synth.cancel();
            const utt  = new SpeechSynthesisUtterance(text);
            utt.lang   = 'en-US';
            utt.rate   = rate;
            utt.pitch  = 1;
            this.synth.speak(utt);
        });
    }

    /* ── Toast ───────────────────────────────── */
    toast(msg, type = 'info') {
        const c    = document.getElementById('toast-container');
        const div  = document.createElement('div');
        div.className = `toast ${type}`;
        const icons = { success: 'ph-check-circle', error: 'ph-x-circle', info: 'ph-info' };
        div.innerHTML = `<i class="ph ${icons[type] || icons.info}"></i><span>${msg}</span>`;
        c.appendChild(div);
        setTimeout(() => {
            div.classList.add('fadeout');
            setTimeout(() => div.remove(), 350);
        }, 3000);
    }

    /* ── Confetti ────────────────────────────── */
    confetti(x, y) {
        const colors = ['#58CC02', '#1CB0F6', '#FFC800', '#FF4B4B', '#8B5CF6'];
        for (let i = 0; i < 16; i++) {
            const el = document.createElement('div');
            el.className = 'confetti-particle';
            el.style.left       = `${x + (Math.random() - 0.5) * 80}px`;
            el.style.top        = `${y}px`;
            el.style.background = colors[Math.floor(Math.random() * colors.length)];
            el.style.animationDelay = `${Math.random() * 0.3}s`;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 1200);
        }
    }

    /* ── Result overlay ──────────────────────── */
    showResult(isCorrect, e) {
        const id  = isCorrect ? 'result-correct' : 'result-wrong';
        const el  = document.getElementById(id);
        el.classList.remove('hidden');
        if (isCorrect && e) this.confetti(e.clientX, e.clientY);
        setTimeout(() => el.classList.add('hidden'), 1100);
    }

    /* ── Header stats ────────────────────────── */
    updateHeader() {
        const dm = this.dm;
        document.getElementById('sidebar-streak').textContent = dm.stats.streak || 0;
        const today = new Date().toDateString();
        const xp    = dm.stats.lastXPDate === today ? (dm.stats.dailyXP || 0) : 0;
        document.getElementById('topbar-xp').textContent = `${xp} XP`;
    }

    /* ── Dashboard update ────────────────────── */
    updateDashboard() {
        const dm    = this.dm;
        const pct   = dm.completionRate;
        const stats = {
            learned: dm.learnedWords.length,
            total:   dm.totalWords,
            review:  dm.dueWords.length,
            streak:  dm.stats.streak || 0,
        };

        document.getElementById('stat-learned').textContent = stats.learned;
        document.getElementById('stat-total').textContent   = stats.total;
        document.getElementById('stat-review').textContent  = stats.review;
        document.getElementById('stat-streak').textContent  = stats.streak;

        document.getElementById('overall-progress').style.width = `${pct}%`;
        document.getElementById('progress-pct').textContent     = `${pct}%`;
    }

    /* ── Stats page update ───────────────────── */
    updateStatsPage() {
        const dm  = this.dm;
        const pct = dm.completionRate;
        const c   = dm.stats.totalCorrect || 0;
        const w   = dm.stats.totalWrong   || 0;
        const tot = c + w;

        document.getElementById('st-pct').textContent    = `${pct}%`;
        document.getElementById('st-progress').style.width = `${pct}%`;
        document.getElementById('st-streak').textContent = `${dm.stats.streak || 0} 🔥`;
        document.getElementById('st-rate').textContent   = `${dm.accuracyRate}%`;
        document.getElementById('correct-count').textContent = c;
        document.getElementById('wrong-count').textContent   = w;

        const cPct = tot ? Math.round((c / tot) * 100) : 50;
        const wPct = 100 - cPct;
        document.getElementById('cw-correct').style.width = `${cPct}%`;
        document.getElementById('cw-wrong').style.width   = `${wPct}%`;

        this._renderAchievements();
    }

    /* ── Achievements ────────────────────────── */
    _renderAchievements() {
        const container = document.getElementById('achievements-container');
        container.innerHTML = '';
        ACHIEVEMENTS.forEach(a => {
            const unlocked = a.check(this.dm);
            if (unlocked && !this._unlockedAchievements.has(a.id)) {
                this._unlockedAchievements.add(a.id);
                localStorage.setItem('engvocab_achievements', JSON.stringify([...this._unlockedAchievements]));
                this.toast(`🏅 Huy hiệu mới: ${a.name}!`, 'success');
            }
            const div = document.createElement('div');
            div.className = `achievement-item ${unlocked ? 'unlocked' : 'locked'}`;
            div.innerHTML = `<div class="achievement-icon">${a.icon}</div><p class="achievement-name">${a.name}</p><p style="font-size:11px;color:var(--text3);margin-top:2px">${a.desc}</p>`;
            div.title = a.desc;
            container.appendChild(div);
        });
    }

    /* ── Word modal ──────────────────────────── */
    openWordModal(word, progress) {
        document.getElementById('modal-word').textContent        = word.word;
        document.getElementById('modal-ipa').textContent         = word.ipa || '';
        document.getElementById('modal-type').textContent        = word.type || '';
        document.getElementById('modal-topic').textContent       = word.topic || '';
        document.getElementById('modal-meaning').textContent     = word.meaning;
        document.getElementById('modal-example').textContent     = word.example || '';
        document.getElementById('modal-translation').textContent = word.translation || '';

        document.getElementById('modal-tts').onclick = () => this.speak(word.word);
        document.getElementById('word-modal-backdrop').classList.remove('hidden');
    }

    closeWordModal() {
        document.getElementById('word-modal-backdrop').classList.add('hidden');
    }

    /* ── Word list render ────────────────────── */
    renderWordList(words, { onFavorite, onClick, onSpeak }) {
        const container = document.getElementById('word-list-container');
        const count     = document.getElementById('word-count-label');
        count.textContent = `Hiển thị ${words.length} từ`;

        if (words.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text3);padding:40px">Không tìm thấy từ vựng nào.</p>';
            return;
        }

        container.innerHTML = '';
        words.forEach(w => {
            const p       = this.dm.progress[w.id] || {};
            const learned = p.level > 0;
            const fav     = p.isFavorite;

            const div = document.createElement('div');
            div.className = `word-item${learned ? ' learned' : ''}`;
            div.innerHTML = `
                <div class="word-item-main">
                    <div class="word-item-en">
                        ${w.word}
                        <span class="word-item-ipa">${w.ipa || ''}</span>
                        ${learned ? `<span style="font-size:10px;color:var(--green);font-weight:800">✓</span>` : ''}
                    </div>
                    <div class="word-item-vi">${w.meaning}</div>
                    <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
                        ${w.type  ? `<span class="word-badge">${w.type}</span>` : ''}
                        ${w.topic ? `<span class="topic-badge">${w.topic}</span>` : ''}
                    </div>
                </div>
                <div class="word-item-actions">
                    <button class="btn-icon btn-tts-word" title="Phát âm (L)"><i class="ph ph-speaker-high"></i></button>
                    <button class="btn-icon btn-fav ${fav ? 'fav-active' : ''}" title="Yêu thích">
                        <i class="ph${fav ? '-fill' : ''} ph-star" style="${fav ? 'color:var(--yellow)' : ''}"></i>
                    </button>
                </div>
            `;
            div.addEventListener('click', (e) => {
                if (e.target.closest('.btn-tts-word')) { onSpeak(w.word); return; }
                if (e.target.closest('.btn-fav'))       { onFavorite(w.id); return; }
                onClick(w);
            });
            container.appendChild(div);
        });
    }

    /* ── Flashcard counter ───────────────────── */
    updateFcCounter(current, total) {
        document.getElementById('fc-counter').textContent = `${current}/${total}`;
        document.getElementById('fc-progress').style.width = `${total ? (current / total) * 100 : 0}%`;
    }

    /* ── Quiz progress ───────────────────────── */
    updateQuizProgress(current, total) {
        document.getElementById('quiz-progress').style.width = `${total ? (current / total) * 100 : 0}%`;
    }

    updateHearts(count) {
        const el = document.getElementById('hearts-display');
        if (count > 10) {
            el.innerHTML = `<span style="font-size:0.9em; opacity:0.8; font-weight:600;"><i class="ph-fill ph-student"></i> Học không giới hạn</span>`;
            return;
        }
        el.innerHTML = Array.from({ length: 3 }, (_, i) =>
            `<i class="ph${i < count ? '-fill' : ''} ph-heart"></i>`
        ).join('');
    }

    /* ── Utils ───────────────────────────────── */
    shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    pickDistractors(correctWord, allWords, count = 3) {
        const pool = allWords.filter(w => w.id !== correctWord.id);
        return this.shuffle(pool).slice(0, count);
    }
}
