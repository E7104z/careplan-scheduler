/**
 * IMP-01: normalize what browsers and PDFs put on the clipboard before anything is read.
 * Line breaks become `\n`; no-break, figure and narrow no-break spaces become a space;
 * Unicode dashes (U+2010 to U+2015) become `-`; rich-text underline marks (`__`) are removed.
 */
export function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[   ]/g, " ")
    .replace(/[‐-―]/g, "-")
    .replace(/__/g, "");
}
