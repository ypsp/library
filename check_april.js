const FY2026 = {};

function isHoliday(date) {
    const holidays = ['2026-04-29'];
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    return holidays.includes(dateStr);
}

function getNthDayOfMonth(date) {
    return Math.ceil(date.getDate() / 7);
}

function getLibraryStatus(lib, date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    const dayOfWeek = date.getDay();
    const holiday = isHoliday(date);

    // Monday Rule
    if (dayOfWeek === 1) {
        if (holiday) return 'open';
        return 'closed';
    }
    
    // Holiday Next Day (Fukui Pref style)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const prev = new Date(date);
        prev.setDate(date.getDate() - 1);
        if (isHoliday(prev)) return 'closed';
    }

    // 4th Thursday
    if (dayOfWeek === 4 && getNthDayOfMonth(date) === 4) return 'closed';

    return 'open';
}

console.log('--- Fukui Pref Library April 2026 Closed Days ---');
for (let d = 1; d <= 30; d++) {
    const date = new Date(2026, 3, d); // April is index 3
    if (getLibraryStatus({}, date) === 'closed') {
        const dow = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
        console.log(`4/${d}(${dow})`);
    }
}
