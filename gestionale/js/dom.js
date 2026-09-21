// Micro-templating: il tag `html` escapa ogni valore interpolato, a meno che non
// sia a sua volta un frammento prodotto da `html` (o marcato con `raw`).

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ENTITIES[ch]);

class SafeHtml {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

export const raw = value => new SafeHtml(value);

function stringify(value) {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(stringify).join('');
  if (value === false || value === null || value === undefined) return '';
  return esc(value);
}

export function html(strings, ...values) {
  let out = '';
  strings.forEach((chunk, i) => {
    out += chunk;
    if (i < values.length) out += stringify(values[i]);
  });
  return new SafeHtml(out);
}
