import './style.css';
import './edit.css';
import libraryData from './data.json';

const STORAGE_KEY = 'lib_calendar_storage';

// localStorageから取得、なければdata.jsonを使用
let editData;
try {
    const saved = localStorage.getItem(STORAGE_KEY);
    editData = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(libraryData));
} catch (e) {
    console.error('Failed to load from localStorage', e);
    editData = JSON.parse(JSON.stringify(libraryData));
}

class EditApp {
    constructor() {
        this.currentDate = new Date();
        this.currentDate.setDate(1); // 月の1日に固定
        this.currentLibraryId = editData.libraries[0].id;
        this.resetStep = 0;
        
        this.init();
    }

    init() {
        this.setupLibrarySelect();
        this.bindEvents();
        this.updateView();
    }

    setupLibrarySelect() {
        const select = document.getElementById('library-select');
        select.innerHTML = editData.libraries.map(lib => 
            `<option value="${lib.id}">${lib.name}</option>`
        ).join('');
        
        select.addEventListener('change', (e) => {
            this.currentLibraryId = e.target.value;
            this.updateView();
        });
    }

    bindEvents() {
        document.getElementById('prev-month').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.updateView();
        });

        document.getElementById('next-month').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.updateView();
        });

        document.getElementById('export-json-btn').addEventListener('click', () => this.exportJson());
        document.getElementById('reset-data-btn').addEventListener('click', (e) => this.resetData(e));
    }

    saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(editData));
    }

    resetData(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const btn = document.getElementById('reset-data-btn');
        
        if (!this.resetStep) {
            this.resetStep = 1;
            btn.innerHTML = '<span style="margin-right: 5px;">⚠</span>本当に実行しますか？（もう一度クリック）';
            btn.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
            btn.style.borderColor = '#ef4444';
            
            // 5秒後に元に戻す
            setTimeout(() => {
                if (this.resetStep === 1) {
                    this.resetStep = 0;
                    btn.innerHTML = '<span style="margin-right: 5px;">⚠</span>すべての変更を破棄して初期化';
                    btn.style.backgroundColor = '';
                    btn.style.borderColor = 'rgba(248, 113, 113, 0.2)';
                }
            }, 5000);
            return;
        }

        // 2回目のクリック：実行
        localStorage.removeItem(STORAGE_KEY);
        window.location.href = window.location.pathname + '?t=' + Date.now();
    }

    getCurrentLibrary() {
        return editData.libraries.find(l => l.id === this.currentLibraryId);
    }

    // YYYY-MM-DD
    toLocalDateStr(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    getNthDayOfMonth(date) {
        return Math.ceil(date.getDate() / 7);
    }

    isHoliday(date) {
        const dateStr = this.toLocalDateStr(date);
        return editData.holidays.includes(dateStr);
    }

    // そのライブラリの特定の日付のステータスと出処(source)を返す
    getLibraryStatusInfo(library, date) {
        const dateStr = this.toLocalDateStr(date);
        const monthDay = dateStr.substring(5);
        const dayOfWeek = date.getDay();
        const holiday = this.isHoliday(date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        
        // 1. 手動オーバーライド(FYデータの確認)
        const isFY2025 = (year === 2025 && month >= 4) || (year === 2026 && month <= 3);
        const fyKey = isFY2025 ? 'FY2025' : (year >= 2026 ? 'FY2026' : null);
        
        if (fyKey && editData[fyKey]?.[library.id]) {
            const rules = editData[fyKey][library.id];
            if (rules.special_open?.includes(dateStr)) return { status: 'open', source: 'special_open' };
            if (rules.special_closed?.includes(dateStr)) return { status: 'closed', source: 'special_closed' };
            if (rules.third_wed?.includes(dateStr)) return { status: 'closed', source: 'third_wed' };
            if (rules.third_tues?.includes(dateStr)) return { status: 'closed', source: 'third_tues' };
        }

        // --- 以降は app.js と同一の基本ルール判定 ---

        if (library.rules.new_year_closed.includes(monthDay)) return { status: 'closed', source: 'rule_new_year' };

        if (library.rules.holiday_shift) {
            if (dayOfWeek === 1) return { status: holiday ? 'open' : 'closed', source: 'rule_holiday_shift_mon' };
            if (dayOfWeek === 2) {
                const prev = new Date(date); prev.setDate(date.getDate() - 1);
                if (this.isHoliday(prev) && !holiday) return { status: 'closed', source: 'rule_holiday_shift_tue' };
            }
            if (library.id === 'awara') {
                if (dayOfWeek === 4 && this.getNthDayOfMonth(date) === 4) return { status: holiday ? 'open' : 'closed', source: 'rule_awara_thu' };
                if (dayOfWeek === 5) {
                    const prev = new Date(date); prev.setDate(date.getDate() - 1);
                    if (this.isHoliday(prev) && this.getNthDayOfMonth(prev) === 4 && !holiday) return { status: 'closed', source: 'rule_awara_fri' };
                }
            }
            if (library.id !== 'fukui_pref' && library.id !== 'awara' && dayOfWeek === 4 && this.getNthDayOfMonth(date) === library.rules.nth_thu) {
                return { status: holiday ? 'open' : 'closed', source: 'rule_nth_thu_shift' };
            }
            if (library.id !== 'fukui_pref' && library.id !== 'awara' && dayOfWeek === 4 && this.getNthDayOfMonth(date) === library.rules.nth_thu + 1) {
                const prev = new Date(date); prev.setDate(date.getDate() - 7);
                if (this.isHoliday(prev) && !holiday) return { status: 'closed', source: 'rule_nth_thu_shifted' };
            }
        }

        if (library.id === 'fukui_pref') {
            if (library.rules.holiday_next_day_closed && dayOfWeek !== 0 && dayOfWeek !== 6) {
                const prev = new Date(date); prev.setDate(date.getDate() - 1);
                if (this.isHoliday(prev)) return { status: 'closed', source: 'rule_holiday_next' };
            }
            if (dayOfWeek === 4 && this.getNthDayOfMonth(date) === 4 && !holiday) return { status: 'closed', source: 'rule_fukui_4thu' };
        }

        if (!library.rules.holiday_shift && library.rules.weekly_closed?.includes(dayOfWeek)) {
            if (!library.rules.holiday_open || !holiday) return { status: 'closed', source: 'rule_weekly' };
        }

        if (library.rules.nth_thu && dayOfWeek === 4 && this.getNthDayOfMonth(date) === library.rules.nth_thu) {
            if (!library.rules.holiday_shift) return { status: 'closed', source: 'rule_nth_thu' };
        }

        if (dayOfWeek === 5 && library.rules.nth_friday === this.getNthDayOfMonth(date)) {
            if (!library.rules.holiday_open || !holiday) return { status: 'closed', source: 'rule_nth_fri' };
        }

        return { status: 'open', source: 'default' };
    }

    // クリック時に special_closed または special_open を切り替える
    toggleDateStatus(date) {
        const lib = this.getCurrentLibrary();
        const dateStr = this.toLocalDateStr(date);
        const info = this.getLibraryStatusInfo(lib, date);
        
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const isFY2025 = (year === 2025 && month >= 4) || (year === 2026 && month <= 3);
        // 2026年度以降なら自動でFY2026に割り当て（必要に応じてFY2027なども拡張可能）
        const fyKey = isFY2025 ? 'FY2025' : 'FY2026'; 

        // 年度オブジェクトが存在しなければ作成
        if (!editData[fyKey]) editData[fyKey] = {};
        if (!editData[fyKey][lib.id]) editData[fyKey][lib.id] = {};
        const rules = editData[fyKey][lib.id];

        // helper
        const removeFromArray = (arr, val) => {
            if (!arr) return [];
            return arr.filter(item => item !== val);
        };
        const addToArray = (arr, val) => {
            const res = arr ? [...arr] : [];
            if (!res.includes(val)) res.push(val);
            return res.sort(); // 日付順にソートしておくとJSONが綺麗
        };

        if (info.status === 'open') {
            // 開館 -> 休館にしたい
            // もしspecial_openに入っていればそれを消すだけで基本ルール(休館)に戻るかもしれない
            if (info.source === 'special_open') {
                rules.special_open = removeFromArray(rules.special_open, dateStr);
                if (rules.special_open.length === 0) delete rules.special_open;
            } else {
                // 基本ルールで開館なら、special_closedに足す
                rules.special_closed = addToArray(rules.special_closed, dateStr);
            }
        } else {
            // 休館 -> 開館にしたい
            if (info.source === 'special_closed') {
                rules.special_closed = removeFromArray(rules.special_closed, dateStr);
                if (rules.special_closed.length === 0) delete rules.special_closed;
            } else {
                // 基本ルールで休館なら、special_openに足す
                rules.special_open = addToArray(rules.special_open, dateStr);
            }
        }

        this.saveData();
        this.updateView();
    }

    updateView() {
        const lib = this.getCurrentLibrary();
        
        // X-Frame-Options 等で iframe 埋め込みを拒否しているサイトのID
        const blockedIframes = ['neagari', 'harue'];
        
        const iframe = document.getElementById('reference-iframe');
        const fallback = document.getElementById('iframe-fallback');
        const extLink = document.getElementById('external-link');
        const fallbackLink = document.getElementById('fallback-link');

        if (blockedIframes.includes(lib.id)) {
            // iframeを隠してフォールバックを表示
            iframe.style.display = 'none';
            fallback.style.display = 'flex';
            extLink.href = lib.url;
            fallbackLink.href = lib.url;
        } else {
            // iframeを表示
            fallback.style.display = 'none';
            iframe.style.display = 'block';
            if (iframe.src !== lib.url) {
                iframe.src = lib.url;
            }
            extLink.href = lib.url;
        }

        // 2. ヘッダーの更新
        document.getElementById('current-month-display')
            .textContent = `${this.currentDate.getFullYear()}年 ${this.currentDate.getMonth() + 1}月`;

        // 3. カレンダーの描画
        const calendarBody = document.getElementById('calendar-body');
        calendarBody.innerHTML = '';

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // 開始前の空白セル
        for (let i = 0; i < firstDay.getDay(); i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'cal-cell empty';
            calendarBody.appendChild(emptyCell);
        }

        // 日付セル
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const date = new Date(year, month, d);
            const info = this.getLibraryStatusInfo(lib, date);
            const isHoliday = this.isHoliday(date);
            
            const cell = document.createElement('div');
            cell.className = `cal-cell ${info.status}`;
            if (info.source.startsWith('special_')) {
                cell.classList.add('manual-override');
            }
            if (isHoliday) {
                cell.classList.add('holiday');
            }

            // 日付数値
            const dateNum = document.createElement('div');
            dateNum.className = 'cal-date-num';
            dateNum.textContent = d;

            // バッジ
            const badge = document.createElement('div');
            badge.className = 'cal-badge';
            badge.textContent = info.status === 'open' ? '開館' : '休館';

            cell.appendChild(dateNum);
            cell.appendChild(badge);

            cell.addEventListener('click', () => this.toggleDateStatus(date));
            calendarBody.appendChild(cell);
        }
    }

    async exportJson() {
        const msg = document.getElementById('export-msg');
        try {
            // 綺麗にフォーマットして出力
            const jsonString = JSON.stringify(editData, null, 2);
            await navigator.clipboard.writeText(jsonString);
            
            msg.textContent = '✅ JSONをクリップボードにコピーしました！ data.jsonをこれで上書きしてください。';
            msg.className = 'export-msg success';
        } catch (err) {
            console.error(err);
            msg.textContent = '❌ コピーに失敗しました。コンソールを確認してください。';
            msg.className = 'export-msg error';
        }
        
        setTimeout(() => {
            msg.textContent = '';
        }, 5000);
    }
}

new EditApp();
