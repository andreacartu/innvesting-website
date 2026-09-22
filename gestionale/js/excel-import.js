// Trasforma il foglio Excel delle spese di un immobile in voci di costo del gestionale.
//
// Il primo foglio ha una riga per spesa, con le colonne: Tipo, Sub, Stato, Fornitore, Spesa, Lordo previsto,
// Lordo effettivo (quanto è già stato pagato), Tot da pagare, Imponibile, iva (in euro), totale.
// Si importano solo le righe "Confermato". Le righe "Immobile" (prezzo di acquisto, imposte) vanno nei dati dell'immobile.

import { readWorkbook } from './xlsx-reader.js';
import { round2 } from './calc.js';

const STATO_IMPORTATO = 'confermato';
const ALIQUOTE = [0, 4, 10, 22, 25];

/* Tipo del foglio → zona nel gestionale (quello che non è elencato resta com'è). */
const ZONE = { professionisti: 'Professionisti', 'lavori ristrutturazione': 'Lavori di ristrutturazione', 'bagno cieco': 'Bagno cieco' };
/* Nelle zone che sono stanze, il nome della stanza si aggiunge alla voce ("Sanitari - Bagno 2"): serve nelle liste che le mescolano. */
const STANZE = new Set(['bagno cieco', 'bagno 2', 'cucina']);

const number = value => {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
};

const capitalize = text => (text ? text[0].toUpperCase() + text.slice(1) : text);
const formatEuro = value => `${value.toLocaleString('it-IT', { maximumFractionDigits: 0 })} euro`;

function categoryOf(tipo, sub, description) {
  const text = `${tipo} ${sub} ${description}`.toLowerCase();
  if (/bagno/i.test(tipo)) return 'bagni';
  if (/notaio|intermediazione|agente/.test(text)) return 'intermediazione';
  if (/architett|progett|consulenza/.test(text)) return 'progetto';
  if (/caldaia|riscaldamento|condizionator|termostat/.test(text)) return 'termico';
  if (/infissi|portoncino|porte/.test(text)) return 'serramenti';
  if (/interru|luci|lampad/.test(text)) return 'elettrico';
  if (/piastrelle|pavimenti/.test(text)) return 'pavimenti';
  if (/forno|frigo|piano cottura|lavastoviglie/.test(text)) return 'elettrodomestici';
  if (/cucina/i.test(tipo)) return 'cucina';
  if (/lavori ristrutturazione/.test(text)) return 'opere-edili';
  return 'altro';
}

/* Tipo di fornitore, dedotto dal nome e dalla prima voce che lo riguarda. */
function supplierTypeOf(name, sub, category, description) {
  const lower = name.toLowerCase();
  if (/geometra/.test(lower)) return 'geometra';
  if (/architett/.test(lower)) return 'architetto';
  if (/notaio/.test(lower) || sub === 'Notaio') return 'notaio';
  if (/immobiliare|agenzia/.test(lower) || sub === 'Agente') return 'agenzia';
  if (category === 'opere-edili') return 'impresa';
  if (category === 'termico' && /caldaia|riscaldamento/i.test(description)) return 'idraulico';
  if (category === 'serramenti') return 'serramentista';
  if (category === 'pavimenti') return 'pavimenti';
  if (category === 'elettrico') return 'elettricista';
  if (['cucina', 'arredi', 'elettrodomestici'].includes(category)) return 'arredi';
  return 'altro';
}

/* IVA: se l'aliquota è una di quelle previste si tiene l'imponibile, altrimenti il totale IVA inclusa. */
function vatOf({ imponibile, iva, totale }) {
  if (!(imponibile > 0)) return { importo: totale, iva: 0 };
  const pct = ((iva ?? 0) / imponibile) * 100;
  const rate = ALIQUOTE.find(r => Math.abs(pct - r) < 0.2);
  if (rate === undefined) return { importo: totale, iva: 0, note: `Totale IVA inclusa: nel foglio l'IVA era al ${Math.round(pct * 10) / 10}%.` };
  const rounded = round2(imponibile);
  return { importo: round2(rounded * (1 + rate / 100)) === round2(totale) ? rounded : Math.round(imponibile * 1e4) / 1e4, iva: rate };
}

/* ── Lettura del foglio ─────────────────────────────────────────────────── */

export function parseCostSheet(workbook) {
  const [main] = workbook.sheets;
  const cell = (rows, row, col) => rows.get(row)?.[col];
  if (!main || String(cell(main.rows, 1, 'A') ?? '').trim().toLowerCase() !== 'tipo') {
    throw new Error('Non riconosco il foglio: la prima riga deve avere le colonne Tipo, Sub, Stato, Fornitore, Spesa…');
  }

  const property = { prezzoAcquisto: 0, speseAcquisto: 0 };
  const costs = [];
  const excluded = [];

  for (const row of [...main.rows.keys()].sort((a, b) => a - b)) {
    const c = main.rows.get(row);
    const tipo = (c.A ?? '').trim();
    const sub = (c.B ?? '').trim();
    const stato = (c.C ?? '').trim();
    if (!tipo || !stato || ['totale', 'tipo'].includes(tipo.toLowerCase())) continue;

    const imponibile = number(c.I);
    const iva = number(c.J);
    const k = number(c.K);
    const totale = k > 0 ? k : imponibile !== null ? imponibile + (iva ?? 0) : 0;
    const confirmed = stato.toLowerCase() === STATO_IMPORTATO;

    if (tipo.toLowerCase() === 'immobile') { // acquisto e imposte: nei dati dell'immobile
      if (confirmed && k) property[sub.toLowerCase() === 'casa' ? 'prezzoAcquisto' : 'speseAcquisto'] += k;
      continue;
    }
    if (!(totale > 0)) continue;
    if (!confirmed) { excluded.push({ riga: row, tipo, sub, totale: round2(totale), stato }); continue; }

    let text = (c.E ?? '').trim();
    const link = text.match(/https?:\/\/\S+/)?.[0] ?? '';
    text = text.replace(/https?:\/\/\S+/g, '').trim();

    const professional = tipo.toLowerCase() === 'professionisti';
    let description = professional ? text || sub : sub;
    if (!professional && (/^arredobagno$/i.test(sub) || /^piastrelle$/i.test(sub))) description = 'Piastrelle';
    if (/^interrutori$/i.test(sub)) description = 'Interruttori';
    const zona = ZONE[tipo.toLowerCase()] ?? tipo;
    if (STANZE.has(tipo.toLowerCase()) && description.toLowerCase() !== zona.toLowerCase()) description = `${description} - ${zona}`;
    description = capitalize(description.trim());

    const vat = vatOf({ imponibile, iva, totale });
    const previsto = number(c.F);
    const notes = [];
    if (!professional && text && text.length <= 60 && text.toLowerCase() !== sub.toLowerCase()) notes.push(text); // i testi lunghi (descrizioni di prodotto) non si importano
    if (vat.note) notes.push(vat.note);
    if (previsto !== null && Math.abs(previsto - totale) > 1) notes.push(`Stima iniziale: ${formatEuro(previsto)}.`);

    const category = categoryOf(tipo, sub, description);
    const supplierName = (c.D ?? '').trim();
    const paid = number(c.G);

    costs.push({
      descrizione: description,
      zona,
      categoria: category,
      importo: vat.importo,
      iva: vat.iva,
      link,
      note: notes.join(' '),
      fornitore: supplierName ? { nome: supplierName, tipo: supplierTypeOf(supplierName, sub, category, description) } : null,
      pagato: paid > 0.004 ? round2(paid) : 0,
      totale: round2(totale),
    });
  }

  // Budget lavori e rivendita obiettivo stanno nel foglio "Sheet1", se c'è.
  const stima = workbook.sheets.find(sheet => sheet.name === 'Sheet1');
  const budget = stima && number(cell(stima.rows, 5, 'C'));
  const ricavi = stima && number(cell(stima.rows, 20, 'D'));
  if (budget > 0) property.budgetLavori = budget;
  if (ricavi > 0) property.prezzoObiettivo = ricavi;
  property.prezzoAcquisto = round2(property.prezzoAcquisto);
  property.speseAcquisto = round2(property.speseAcquisto);

  return { sheetName: main.name, property, costs, excluded };
}

export async function readCostFile(file) {
  return parseCostSheet(await readWorkbook(await file.arrayBuffer()));
}
