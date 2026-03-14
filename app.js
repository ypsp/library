import './style.css';
import libraryData from './data.json';

// data.json からデータを取得
const { FY2025, FY2026, libraries: LIBRARIES, holidays } = libraryData;


class App {
    constructor() {
        this.selectedDate = new Date();
        this.init();
    }

    init() {
        this.updateView();

        const input = document.getElementById('date-input-hidden');
        input.addEventListener('change', (e) => {
            if (e.target.value) {
                // 'YYYY-MM-DD'文字列はUTC基準で解釈されるため、T00:00:00を付けてローカル時刻として解釈させる
                this.selectedDate = new Date(e.target.value + 'T00:00:00');
                this.updateView();
            }
        });
    }

    // タイムゾーンに依存しないローカル日付文字列(YYYY-MM-DD)を返す
    // toISOString()はUTC変換するため、JST深夜帯に日付がズレるバグを防ぐ
    toLocalDateStr(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    getNthDayOfMonth(date) {
        return Math.ceil(date.getDate() / 7);
    }

    isHoliday(date) {
        const dateStr = this.toLocalDateStr(date);
        return holidays.includes(dateStr);
    }

    getLibraryStatus(library, date) {
        const dateStr = this.toLocalDateStr(date);
        const monthDay = dateStr.substring(5);
        const dayOfWeek = date.getDay();
        const holiday = this.isHoliday(date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;

        // 1. New Year
        if (library.rules.new_year_closed.includes(monthDay)) return 'closed';

        // 2. Fiscal Year specific rules (Maintenance, etc.)
        const isFY2025 = (year === 2025 && month >= 4) || (year === 2026 && month <= 3);
        const fiscalRules = isFY2025 ? FY2025[library.id] : FY2026[library.id];

        if (fiscalRules) {
            if (fiscalRules.special_open && fiscalRules.special_open.includes(dateStr)) return 'open';
            if (fiscalRules.special_closed && fiscalRules.special_closed.includes(dateStr)) return 'closed';
            if (fiscalRules.third_wed && fiscalRules.third_wed.includes(dateStr)) return 'closed';
            if (fiscalRules.third_tues && fiscalRules.third_tues.includes(dateStr)) return 'closed';
        }

        // 3. Holiday Shift Rule (Sakai / Fukui Pref Style)
        if (library.rules.holiday_shift) {
            // Monday rule (open if holiday, closed otherwise)
            if (dayOfWeek === 1) {
                if (holiday) return 'open';
                return 'closed';
            }
            // Tuesday rule (Shifted Monday - closed if previous day was holiday)
            if (dayOfWeek === 2) {
                const prevDay = new Date(date);
                prevDay.setDate(date.getDate() - 1);
                if (this.isHoliday(prevDay) && !holiday) return 'closed';
            }

            // Awara's 4th Thursday shift (to Friday)
            if (library.id === 'awara') {
                if (dayOfWeek === 4 && this.getNthDayOfMonth(date) === 4) {
                    return holiday ? 'open' : 'closed';
                }
                if (dayOfWeek === 5) {
                    const prevDay = new Date(date);
                    prevDay.setDate(date.getDate() - 1);
                    if (this.isHoliday(prevDay) && this.getNthDayOfMonth(prevDay) === 4 && !holiday) {
                        return 'closed';
                    }
                }
            }

            // Sakai's 1st Thursday rule (Shifted to next week's Thursday)
            if (library.id !== 'fukui_pref' && library.id !== 'awara' && dayOfWeek === 4 && this.getNthDayOfMonth(date) === library.rules.nth_thu) {
                return holiday ? 'open' : 'closed';
            }
            // Sakai's Following Thursday rule (Shifted 1st Thu)
            if (library.id !== 'fukui_pref' && library.id !== 'awara' && dayOfWeek === 4 && this.getNthDayOfMonth(date) === library.rules.nth_thu + 1) {
                const prevThu = new Date(date);
                prevThu.setDate(date.getDate() - 7);
                if (this.isHoliday(prevThu) && !holiday) return 'closed';
            }
        }

        // 4. Fukui Pref Specific Rules: Holiday Next Day & 4th Thu
        if (library.id === 'fukui_pref') {
            // Holiday Next Day (Closed if prev day was holiday, unless Sat/Sun)
            if (library.rules.holiday_next_day_closed && dayOfWeek !== 0 && dayOfWeek !== 6) {
                const prevDay = new Date(date);
                prevDay.setDate(date.getDate() - 1);
                if (this.isHoliday(prevDay)) return 'closed';
            }
            // 4th Thursday
            if (dayOfWeek === 4 && this.getNthDayOfMonth(date) === 4 && !holiday) return 'closed';
        }

        // 5. Weekly Closed (Only if not handled by holiday_shift)
        if (!library.rules.holiday_shift && library.rules.weekly_closed && library.rules.weekly_closed.includes(dayOfWeek)) {
            if (!library.rules.holiday_open || !holiday) return 'closed';
        }

        // 6. Nth Day rule (General) - for nth_thu (if not handled by holiday_shift)
        if (library.rules.nth_thu && dayOfWeek === 4 && this.getNthDayOfMonth(date) === library.rules.nth_thu) {
            if (!library.rules.holiday_shift) return 'closed';
        }

        // 7. Nth Friday (Nomi Style)
        if (dayOfWeek === 5 && library.rules.nth_friday === this.getNthDayOfMonth(date)) {
            if (!library.rules.holiday_open || !holiday) return 'closed';
        }

        return 'open';
    }

    renderQuickLinks() {
        const container = document.getElementById('quick-links');
        const days = [
            { label: '今日', offset: 0 },
            { label: '明日', offset: 1 },
            { label: '明後日', offset: 2 }
        ];

        container.innerHTML = days.map(day => {
            const date = new Date();
            date.setDate(date.getDate() + day.offset);
            const isActive = this.selectedDate.toDateString() === date.toDateString();
            return `
                <div class="date-btn ${isActive ? 'active' : ''}" data-offset="${day.offset}">
                    <span class="day-label">${day.label}</span>
                    <span class="date-label">${date.getMonth() + 1}/${date.getDate()}</span>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.date-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const offset = parseInt(btn.dataset.offset);
                const date = new Date();
                date.setDate(date.getDate() + offset);
                this.selectedDate = date;
                this.updateView();
            });
        });
    }

    updateView() {
        const display = document.getElementById('selected-date-display');
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' };
        display.textContent = this.selectedDate.toLocaleDateString('ja-JP', options);

        const list = document.getElementById('library-list');
        list.innerHTML = '';

        const now = new Date();
        const isToday = this.selectedDate.toDateString() === now.toDateString();

        LIBRARIES.forEach(lib => {
            const statusType = this.getLibraryStatus(lib, this.selectedDate);
            const isWeekend = this.selectedDate.getDay() === 0 || this.selectedDate.getDay() === 6 || this.isHoliday(this.selectedDate);
            let hoursStr = isWeekend ? lib.hours.weekend : lib.hours.weekday;

            // Handle Neagari's seasonal weekend/holiday hours (June-Sep open until 18:00 instead of 17:00)
            if (lib.id === 'neagari' && isWeekend) {
                const month = this.selectedDate.getMonth() + 1;
                if (month >= 6 && month <= 9) {
                    hoursStr = '9:30 - 18:00';
                }
            }

            let statusText = '';
            let statusClass = '';

            if (statusType === 'open') {
                if (isToday) {
                    // Check current time
                    const [start, end] = hoursStr.split(' - ').map(t => {
                        const [h, m] = t.split(':').map(Number);
                        const d = new Date(now);
                        d.setHours(h, m, 0, 0);
                        return d;
                    });

                    if (now >= start && now < end) {
                        statusText = '開館中';
                        statusClass = 'status-open';
                    } else if (now < start) {
                        statusText = '開館前';
                        statusClass = 'status-waiting';
                    } else {
                        statusText = '閉館';
                        statusClass = 'status-closed';
                    }
                } else {
                    statusText = '開館日';
                    statusClass = 'status-open';
                }
            } else {
                statusText = '休館日';
                statusClass = 'status-closed';
            }

            const card = document.createElement('a');
            card.className = 'library-card';
            card.href = lib.url;
            card.target = '_blank';
            card.rel = 'noopener noreferrer';
            card.innerHTML = `
                <div class="library-info">
                    <h2>${lib.name}</h2>
                    <div class="library-hours">${statusType === 'open' ? hoursStr : '休館日です'}</div>
                </div>
                <div class="status-badge ${statusClass}">
                    ${statusText}
                </div>
            `;
            list.appendChild(card);
        });

        this.renderQuickLinks();
    }
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('SW Registered'))
            .catch(err => console.log('SW Failed', err));
    });
}

new App();
