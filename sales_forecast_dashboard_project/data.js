// Business time series data and helpers for preparing the forecast dataset.
// This module handles raw historical sales data, date normalization, and missing-value filling.

export const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const rawHistory = [
  { date: '2021-01-01', revenue: 260 },
  { date: '2021-02-01', revenue: 245 },
  { date: '2021-03-01', revenue: 290 },
  { date: '2021-04-01', revenue: 330 },
  { date: '2021-05-01', revenue: 360 },
  { date: '2021-06-01', revenue: 385 },
  { date: '2021-07-01', revenue: 410 },
  { date: '2021-08-01', revenue: 430 },
  { date: '2021-09-01', revenue: 470 },
  { date: '2021-10-01', revenue: 525 },
  { date: '2021-11-01', revenue: 590 },
  { date: '2021-12-01', revenue: 700 },
  { date: '2022-01-01', revenue: 310 },
  { date: '2022-02-01', revenue: 285 },
  { date: '2022-03-01', revenue: 340 },
  { date: '2022-04-01', revenue: 390 },
  { date: '2022-05-01', revenue: null },
  { date: '2022-06-01', revenue: 420 },
  { date: '2022-07-01', revenue: 460 },
  { date: '2022-08-01', revenue: 470 },
  { date: '2022-09-01', revenue: 520 },
  { date: '2022-10-01', revenue: 590 },
  { date: '2022-11-01', revenue: 650 },
  { date: '2022-12-01', revenue: 780 },
  { date: '2023-01-01', revenue: 320 },
  { date: '2023-02-01', revenue: 300 },
  { date: '2023-03-01', revenue: 380 },
  { date: '2023-04-01', revenue: 430 },
  { date: '2023-05-01', revenue: 510 },
  { date: '2023-06-01', revenue: 540 },
  { date: '2023-07-01', revenue: 590 },
  { date: '2023-08-01', revenue: 620 },
  { date: '2023-09-01', revenue: 670 },
  { date: '2023-10-01', revenue: 740 },
  { date: '2023-11-01', revenue: 820 },
  { date: '2023-12-01', revenue: 950 },
  { date: '2024-01-01', revenue: 340 },
  { date: '2024-02-01', revenue: 320 },
  { date: '2024-03-01', revenue: 395 },
  { date: '2024-04-01', revenue: 445 },
  { date: '2024-05-01', revenue: 530 },
  { date: '2024-06-01', revenue: 560 },
];

export function parseDate(value) {
  return new Date(value + 'T00:00:00');
}

export function formatMonthYear(date) {
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

export function addMonths(date, count) {
  const copy = new Date(date.getTime());
  copy.setMonth(copy.getMonth() + count);
  return copy;
}

export function cleanHistoricalData(raw) {
  const normalized = raw
    .map(row => ({ date: parseDate(row.date), revenue: row.revenue }))
    .sort((a, b) => a.date - b.date);

  const start = new Date(normalized[0].date.getTime());
  const end = normalized[normalized.length - 1].date;
  const filled = [];

  for (let cursor = new Date(start.getTime()); cursor <= end; cursor = addMonths(cursor, 1)) {
    const key = formatMonthYear(cursor);
    const existing = normalized.find(row => formatMonthYear(row.date) === key);
    filled.push({ date: new Date(cursor.getTime()), revenue: existing ? existing.revenue : null });
  }

  for (let i = 0; i < filled.length; i++) {
    if (filled[i].revenue === null) {
      const prev = filled.slice(0, i).reverse().find(row => row.revenue !== null);
      const next = filled.slice(i + 1).find(row => row.revenue !== null);
      if (prev && next) {
        const monthsBetween = (next.date.getFullYear() - prev.date.getFullYear()) * 12 + (next.date.getMonth() - prev.date.getMonth());
        const step = (next.revenue - prev.revenue) / monthsBetween;
        const offset = (filled[i].date.getFullYear() - prev.date.getFullYear()) * 12 + (filled[i].date.getMonth() - prev.date.getMonth());
        filled[i].revenue = Math.round(prev.revenue + step * offset);
      } else if (prev) {
        filled[i].revenue = prev.revenue;
      } else if (next) {
        filled[i].revenue = next.revenue;
      }
    }
  }

  return filled;
}

export function buildFeatureVector(trend, month, lag12) {
  const vector = [1, trend / 12, lag12 / 1000];
  for (let m = 1; m < 12; m += 1) {
    vector.push(month === m ? 1 : 0);
  }
  return vector;
}

export function createTrainingSet(cleaned) {
  return cleaned
    .map((entry, index) => {
      if (index < 12) return null;
      const lag12 = cleaned[index - 12].revenue;
      const trend = index;
      const features = buildFeatureVector(trend, entry.date.getMonth(), lag12);
      return { ...entry, trend, lag12, features };
    })
    .filter(Boolean);
}
