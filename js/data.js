/**
 * data.js — Data management, LocalStorage, Spaced Repetition Algorithm
 */

// ── Spaced Repetition interval table (in hours)
const SR_INTERVALS = [0, 12, 24, 72, 168, 336]; // levels 0-5

const LS_KEY_PROGRESS = 'engvocab_progress';
const LS_KEY_STATS    = 'engvocab_stats';
const LS_KEY_THEME    = 'engvocab_theme';

export class DataManager {
    constructor() {
        this.words    = [];
        this.progress = {};
        this.stats    = {
            streak:        0,
            lastStudyDate: null,
            totalCorrect:  0,
            totalWrong:    0,
            dailyXP:       0,
            lastXPDate:    null,
        };
    }

    /* ── Initialise ──────────────────────────── */
    async init() {
        this._loadProgress();
        this._loadStats();
        await this._fetchWords();
        this._syncProgress();
        this._checkStreak();
    }

    async _fetchWords() {
        const resp = await fetch('data/words.json');
        if (!resp.ok) throw new Error(`Cannot load data/words.json (${resp.status})`);
        const raw = await resp.json();
        // Normalise IDs
        this.words = raw.map((w, i) => ({ id: w.id || `w${i + 1}`, ...w }));
    }

    /* ── Progress persistence ────────────────── */
    _loadProgress() {
        try {
            this.progress = JSON.parse(localStorage.getItem(LS_KEY_PROGRESS)) || {};
        } catch { this.progress = {}; }
    }

    _saveProgress() {
        localStorage.setItem(LS_KEY_PROGRESS, JSON.stringify(this.progress));
    }

    _syncProgress() {
        let changed = false;
        this.words.forEach(w => {
            if (!this.progress[w.id]) {
                this.progress[w.id] = {
                    level:          0,
                    nextReview:     0,   // timestamp ms
                    correct:        0,
                    wrong:          0,
                    isFavorite:     false,
                };
                changed = true;
            }
        });
        if (changed) this._saveProgress();
    }

    /* ── Stats persistence ───────────────────── */
    _loadStats() {
        try {
            const saved = JSON.parse(localStorage.getItem(LS_KEY_STATS));
            if (saved) this.stats = { ...this.stats, ...saved };
        } catch { /* ignore */ }
    }

    _saveStats() {
        localStorage.setItem(LS_KEY_STATS, JSON.stringify(this.stats));
    }

    /* ── Streak ──────────────────────────────── */
    _checkStreak() {
        const today = new Date().toDateString();
        if (this.stats.lastStudyDate === today) return; // already counted today

        const yesterday = new Date(Date.now() - 86_400_000).toDateString();
        if (this.stats.lastStudyDate === yesterday) {
            this.stats.streak = (this.stats.streak || 0) + 1;
        } else {
            this.stats.streak = 1; // reset
        }
        this.stats.lastStudyDate = today;
        this._saveStats();
    }

    markStudied() {
        const today = new Date().toDateString();
        if (this.stats.lastStudyDate !== today) this._checkStreak();
        this.stats.lastStudyDate = today;
        this._saveStats();
    }

    /* ── Add XP ──────────────────────────────── */
    addXP(amount) {
        const today = new Date().toDateString();
        if (this.stats.lastXPDate !== today) this.stats.dailyXP = 0;
        this.stats.dailyXP   = (this.stats.dailyXP || 0) + amount;
        this.stats.lastXPDate = today;
        this._saveStats();
    }

    /* ── Update word after answer ────────────── */
    recordAnswer(wordId, isCorrect) {
        const p = this.progress[wordId];
        if (!p) return;

        if (isCorrect) {
            p.correct++;
            p.level = Math.min(p.level + 1, SR_INTERVALS.length - 1);
            this.stats.totalCorrect++;
            this.addXP(10);
        } else {
            p.wrong++;
            p.level = 0;
            this.stats.totalWrong++;
        }

        // Set next review timestamp
        p.nextReview = Date.now() + SR_INTERVALS[p.level] * 3_600_000;
        this._saveProgress();
        this.markStudied();
        this._saveStats();
    }

    toggleFavorite(wordId) {
        if (!this.progress[wordId]) return;
        this.progress[wordId].isFavorite = !this.progress[wordId].isFavorite;
        this._saveProgress();
    }

    /* ── Computed getters ────────────────────── */
    get totalWords()   { return this.words.length; }

    get learnedWords() {
        return this.words.filter(w => this.progress[w.id]?.level > 0);
    }

    get dueWords() {
        const now = Date.now();
        return this.words.filter(w => {
            const p = this.progress[w.id];
            return p && (p.level === 0 || p.nextReview <= now);
        });
    }

    get favoriteWords() {
        return this.words.filter(w => this.progress[w.id]?.isFavorite);
    }

    get wrongWords() {
        return this.words.filter(w => (this.progress[w.id]?.wrong || 0) > 0)
            .sort((a, b) => (this.progress[b.id]?.wrong || 0) - (this.progress[a.id]?.wrong || 0));
    }

    get completionRate() {
        if (!this.totalWords) return 0;
        return Math.round((this.learnedWords.length / this.totalWords) * 100);
    }

    get accuracyRate() {
        const total = (this.stats.totalCorrect || 0) + (this.stats.totalWrong || 0);
        if (!total) return 0;
        return Math.round((this.stats.totalCorrect / total) * 100);
    }

    getTopics() {
        return [...new Set(this.words.map(w => w.topic).filter(Boolean))].sort();
    }

    /* ── Import / Export ─────────────────────── */
    loadWordsFromJSON(arr) {
        this.words = arr.map((w, i) => ({ id: w.id || `w${i + 1}`, ...w }));
        this._syncProgress();
    }

    exportWords() {
        const blob = new Blob([JSON.stringify(this.words, null, 2)], { type: 'application/json' });
        _downloadBlob(blob, 'words.json');
    }

    exportProgress() {
        const data = { progress: this.progress, stats: this.stats, exportedAt: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        _downloadBlob(blob, 'engvocab_backup.json');
    }

    importProgress(json) {
        if (!json.progress || !json.stats) return false;
        this.progress = json.progress;
        this.stats    = { ...this.stats, ...json.stats };
        this._saveProgress();
        this._saveStats();
        return true;
    }

    resetAll() {
        localStorage.removeItem(LS_KEY_PROGRESS);
        localStorage.removeItem(LS_KEY_STATS);
        this.progress = {};
        this.stats    = { streak: 0, lastStudyDate: null, totalCorrect: 0, totalWrong: 0, dailyXP: 0, lastXPDate: null };
        this._syncProgress();
    }
}

function _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href    = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
