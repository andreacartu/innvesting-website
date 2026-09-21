const eurNoCents = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' });
const percentFmt = new Intl.NumberFormat('it-IT', { style: 'percent', maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

/* Importi mostrati sempre in euro interi: i centesimi restano nei dati e nei calcoli, non sullo schermo. */
export const euro = value => eurNoCents.format(Number(value) || 0);

export const percent = value => percentFmt.format(value);

/* Date: sempre "YYYY-MM-DD" in ora locale, mai via toISOString (sposterebbe il giorno per il fuso). */

const pad = n => String(n).padStart(2, '0');
export const toISO = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const todayISO = () => toISO(new Date());

const parseISO = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (iso, days) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
};

export const formatDate = iso => (iso ? dateFmt.format(parseISO(iso)) : '');

export const daysFromToday = iso => Math.round((parseISO(iso) - parseISO(todayISO())) / 86400000);

export function dueLabel(iso) {
  const d = daysFromToday(iso);
  if (d < 0) return `scaduto da ${-d} ${-d === 1 ? 'giorno' : 'giorni'}`;
  if (d === 0) return 'scade oggi';
  if (d === 1) return 'scade domani';
  return `tra ${d} giorni`;
}

/* Importi: accetta "1.500,50", "1500,5", "1500.5", "€ 2.000". Restituisce null se vuoto. */
export function parseMoney(value) {
  let s = String(value ?? '').trim().replace(/[€\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const moneyToInput = value => (value === null || value === undefined ? '' : String(value).replace('.', ','));
