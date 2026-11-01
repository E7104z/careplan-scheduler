import type { SourceRef } from "./types.js";

/** SOURCE-01: the 1-based line number an offset sits on within a page's text. */
export function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") line += 1;
  }
  return line;
}

/** SOURCE-01: a source ref for an offset on a page; the line defaults to 1 for an empty text. */
export function ref(page: number, text: string, offset: number): SourceRef {
  return { page, line: lineAt(text, offset) };
}

/** The number of newlines in `text`, for adding an offset within a sliced region to a base line. */
export function newlinesIn(text: string): number {
  let n = 0;
  for (const ch of text) if (ch === "\n") n += 1;
  return n;
}