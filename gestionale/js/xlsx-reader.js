// Lettura di un file Excel (.xlsx) direttamente nel browser, senza librerie.
// Un .xlsx è un archivio zip di file XML: si legge l'indice dell'archivio, si decomprime solo quello che serve
// (con la funzione del browser DecompressionStream) e si interpretano fogli e celle.

const utf8 = new TextDecoder('utf-8');

/* ── Zip ────────────────────────────────────────────────────────────────── */

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Questo browser non sa leggere i file Excel: aggiorna il sistema o usa un altro browser.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function openZip(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  let end = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('Il file non è un foglio Excel valido.');

  const entries = new Map();
  let offset = view.getUint32(end + 16, true);
  for (let n = view.getUint16(end + 10, true); n > 0 && view.getUint32(offset, true) === 0x02014b50; n--) {
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    entries.set(utf8.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)), {
      method: view.getUint16(offset + 10, true),
      size: view.getUint32(offset + 20, true),
      localOffset: view.getUint32(offset + 42, true),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return async function read(name) {
    const entry = entries.get(name);
    if (!entry) return null;
    const local = entry.localOffset;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + entry.size);
    return utf8.decode(entry.method === 0 ? data : await inflateRaw(data));
  };
}

/* ── Fogli e celle ──────────────────────────────────────────────────────── */

const parseXml = text => new DOMParser().parseFromString(text, 'application/xml');
const textOf = node => [...node.getElementsByTagName('t')].filter(t => t.parentNode.nodeName !== 'rPh').map(t => t.textContent).join('');

function readSheet(xml, sharedStrings) {
  const rows = new Map(); // numero di riga → { colonna: testo }
  for (const row of parseXml(xml).getElementsByTagName('row')) {
    const cells = {};
    for (const cell of row.getElementsByTagName('c')) {
      const type = cell.getAttribute('t');
      const v = cell.getElementsByTagName('v')[0]?.textContent;
      let value;
      if (type === 's') value = sharedStrings[Number(v)];
      else if (type === 'inlineStr') value = textOf(cell);
      else value = v;
      if (value !== undefined && value !== null && value !== '') cells[cell.getAttribute('r').replace(/\d+/g, '')] = String(value);
    }
    if (Object.keys(cells).length) rows.set(Number(row.getAttribute('r')), cells);
  }
  return rows;
}

/* Restituisce { sheets: [{ name, rows }] } con i fogli nell'ordine del file. */
export async function readWorkbook(buffer) {
  const read = openZip(buffer);
  const workbook = await read('xl/workbook.xml');
  if (!workbook) throw new Error('Il file non è un foglio Excel valido.');

  const relations = new Map([...parseXml(await read('xl/_rels/workbook.xml.rels')).getElementsByTagName('Relationship')]
    .map(rel => [rel.getAttribute('Id'), rel.getAttribute('Target')]));
  const stringsXml = await read('xl/sharedStrings.xml');
  const sharedStrings = stringsXml ? [...parseXml(stringsXml).getElementsByTagName('si')].map(textOf) : [];

  const sheets = [];
  for (const sheet of parseXml(workbook).getElementsByTagName('sheet')) {
    const target = relations.get(sheet.getAttribute('r:id'));
    const xml = target && await read(target.startsWith('/') ? target.slice(1) : `xl/${target}`);
    if (xml) sheets.push({ name: sheet.getAttribute('name'), rows: readSheet(xml, sharedStrings) });
  }
  return { sheets };
}
