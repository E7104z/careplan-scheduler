/**
 * Small, exact edits to the XML inside an .xlsx (Phase 3, Prompt 8). Only the cells named are touched;
 * everything else in the file stays byte for byte as DSDS published it.
 */

export type CellValue = number | string | boolean;

/** "AB12" → column index 27 (A = 0), so cells can be kept in order within a row. */
function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)![0];
  let n = 0;
  for (const ch of letters) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

/** XML text: escaped, and without the control characters XML can't carry. */
export function xmlText(text: string): string {
  return text
    .replace(/[^\t\n\r -퟿-�]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function cellXml(ref: string, style: string, value: CellValue): string {
  if (typeof value === "number") return `<c r="${ref}"${style}><v>${value}</v></c>`;
  if (typeof value === "boolean") return `<c r="${ref}"${style} t="b"><v>${value ? 1 : 0}</v></c>`;
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
}

/** Text with `length` characters at `at` replaced: no replacement patterns, so typed text stays as typed. */
function splice(text: string, at: number, length: number, insert: string): string {
  return text.slice(0, at) + insert + text.slice(at + length);
}

const CELL = (ref: string) => new RegExp(`<c r="${ref}"(?=[ />])([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);

/**
 * The sheet XML with one cell set to a value, keeping the cell's style (`s`). A cell that holds a
 * formula is refused: the export writes inputs only.
 */
export function setCell(sheet: string, ref: string, value: CellValue): string {
  const row = Number(/\d+$/.exec(ref)![0]);
  const existing = CELL(ref).exec(sheet);
  if (existing) {
    if (/<f[ >]/.test(existing[0])) throw new Error(`${ref} holds a formula; the export writes inputs only`);
    const style = / s="\d+"/.exec(existing[1] ?? "")?.[0] ?? "";
    return splice(sheet, existing.index, existing[0].length, cellXml(ref, style, value));
  }
  const rowMatch = new RegExp(`<row r="${row}"(?=[ >])[^>]*?(/>|>([\\s\\S]*?)</row>)`).exec(sheet);
  if (!rowMatch) {
    // No such row: add it in order among the sheet's rows.
    const later = [...sheet.matchAll(/<row r="(\d+)"/g)].find((m) => Number(m[1]) > row);
    const newRow = `<row r="${row}">${cellXml(ref, "", value)}</row>`;
    return splice(sheet, later ? later.index : sheet.indexOf("</sheetData>"), 0, newRow);
  }
  const [whole, ending = "", inner = ""] = rowMatch;
  const open = ending === "/>" ? whole.slice(0, -2) + ">" : whole.slice(0, whole.length - ending.length + 1);
  const cells = [...inner.matchAll(/<c r="([A-Z]+\d+)"/g)];
  const after = cells.find((m) => columnIndex(m[1]!) > columnIndex(ref));
  const at = after ? after.index : inner.length;
  const rebuilt = `${open}${inner.slice(0, at)}${cellXml(ref, "", value)}${inner.slice(at)}</row>`;
  return splice(sheet, rowMatch.index, whole.length, rebuilt);
}

/** workbook.xml asking Excel (and LibreOffice) to recalculate every formula when the file opens. */
export function fullCalcOnLoad(workbook: string): string {
  if (/fullCalcOnLoad="1"/.test(workbook)) return workbook;
  return /<calcPr\b/.test(workbook)
    ? workbook.replace(/<calcPr\b/, `<calcPr fullCalcOnLoad="1"`)
    : workbook.replace("</workbook>", `<calcPr fullCalcOnLoad="1"/></workbook>`);
}

/** A form control's properties with its box checked or cleared (`checked="Checked"`). */
export function setChecked(ctrlProp: string, checked: boolean): string {
  const cleared = ctrlProp.replace(/ checked="[^"]*"/, "");
  return checked ? cleared.replace(/<formControlPr\b/, `<formControlPr checked="Checked"`) : cleared;
}

/** The sheet XML path for each sheet name, read from workbook.xml and its relationships. */
export function sheetPaths(workbook: string, rels: string): Record<string, string> {
  const targets = new Map([...rels.matchAll(/<Relationship\b[^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"/g)].map((m) => [m[1]!, m[2]!]));
  const paths: Record<string, string> = {};
  for (const m of workbook.matchAll(/<sheet\b[^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"/g)) {
    const target = targets.get(m[2]!);
    if (target) paths[m[1]!.replace(/&amp;/g, "&")] = `xl/${target.replace(/^\/?xl\//, "")}`;
  }
  return paths;
}

/**
 * The ctrlProp file of the checkbox whose top-left corner is in (column, row), both 0-based, read
 * from the sheet's `<controls>` and its relationships.
 */
export function checkboxAt(sheet: string, sheetRels: string, column: number, row: number): string | null {
  const targets = new Map([...sheetRels.matchAll(/<Relationship\b[^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"/g)].map((m) => [m[1]!, m[2]!]));
  for (const m of sheet.matchAll(/<control\b[^>]*?r:id="([^"]+)"[^>]*>[\s\S]*?<from><xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/g)) {
    if (Number(m[2]) === column && Number(m[3]) === row) {
      const target = targets.get(m[1]!);
      return target ? `xl/${target.replace(/^\.\.\//, "")}` : null;
    }
  }
  return null;
}
