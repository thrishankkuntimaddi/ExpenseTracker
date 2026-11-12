// ─── Reading a statement file on the device ──────────────────────
// CSV, Excel (.xls / .xlsx) and PDF (password-protected too). Nothing is
// uploaded: the file is read in the browser / app and turned into rows for
// statementParse.js. The PDF and Excel readers load only when needed.
import { parseCSV } from './importHelpers';
import { rowsToLines, pdfItemsToRows, textLinesToLines } from './statementParse';

export class PasswordNeeded extends Error {
  constructor(wrong) { super(wrong ? 'That password didn’t open it.' : 'This statement is password-protected.'); this.wrong = !!wrong; }
}

const ext = (name) => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) ?? [])[1] ?? '';

/** → { lines, kind: 'csv'|'excel'|'pdf', pages? } ; throws PasswordNeeded / Error with a readable message */
export async function readStatementFile(file, password) {
  const kind = ext(file.name);
  if (kind === 'csv' || kind === 'txt' || file.type === 'text/csv') {
    const { lines } = rowsToLines(parseCSV(await file.text()));
    return { lines, kind: 'csv' };
  }
  if (kind === 'xls' || kind === 'xlsx') {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, password });
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
      const { lines, header } = rowsToLines(rows);
      if (header) return { lines, kind: 'excel' };
    }
    return { lines: [], kind: 'excel' };
  }
  if (kind === 'pdf' || file.type === 'application/pdf') return readPdf(file, password);
  throw new Error('Choose a CSV, Excel or PDF statement.');
}

async function readPdf(file, password) {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), password: password || undefined, isEvalSupported: false }).promise;
  } catch (e) {
    if (e?.name === 'PasswordException') throw new PasswordNeeded(e.code === 2);
    throw new Error('Couldn’t open that PDF.');
  }
  const pages = [], textLines = [];
  for (let n = 1; n <= Math.min(doc.numPages, 60); n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const items = content.items.filter((i) => 'str' in i).map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width }));
    pages.push(items);
    // plain lines too, for statements without a readable table
    const byY = new Map();
    items.forEach((i) => { const k = Math.round(i.y / 3); (byY.get(k) ?? byY.set(k, []).get(k)).push(i); });
    [...byY.entries()].sort((a, b) => b[0] - a[0]).forEach(([, its]) => textLines.push(its.sort((a, b) => a.x - b.x).map((i) => i.str).join(' ')));
  }
  let { lines } = rowsToLines(pdfItemsToRows(pages));
  if (!lines.length) lines = textLinesToLines(textLines);
  return { lines, kind: 'pdf', pages: doc.numPages };
}
