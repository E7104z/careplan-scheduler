import boldUrl from "@fontsource/public-sans/files/public-sans-latin-700-normal.woff?url";
import regularUrl from "@fontsource/public-sans/files/public-sans-latin-400-normal.woff?url";
import semiboldUrl from "@fontsource/public-sans/files/public-sans-latin-600-normal.woff?url";
import fontkit from "@pdf-lib/fontkit";
import { LineCapStyle, PDFDocument, rgb as colorFrom, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import tokensCss from "../../styles/tokens.css?raw";
import type { ScheduleSheet, SheetCell, SheetMonth, SheetRow } from "./scheduleSheet";

/**
 * APP-SPEC 5.4 Print: the schedule as one US Letter landscape page, drawn as a PDF so it comes out
 * the same in every browser and in the Windows app (a page sent to the print dialog can be split,
 * turned portrait or given the browser's own headers). Loaded only when someone prints.
 */

/** US Letter landscape, in points (72 to the inch). */
export const PAGE_WIDTH = 792;
export const PAGE_HEIGHT = 612;
/** Clear of the edge any printer leaves blank. */
export const MARGIN = 30;

const LEFT = MARGIN;
const RIGHT = PAGE_WIDTH - MARGIN;
const SIDEBAR_WIDTH = 178;
const COLUMN_GAP = 16;
const GRID_WIDTH = RIGHT - LEFT - SIDEBAR_WIDTH - COLUMN_GAP;
const TASK_COLUMN = 142;
const WEEK_COLUMN = 50;
const DAY_COLUMN = (GRID_WIDTH - TASK_COLUMN - WEEK_COLUMN) / 7;
const GRID_HEAD = 22;
const TOTAL_ROW = 12.5;
const MAX_ROW = 26;
/** Below this a task's name and its minutes and days share one line. */
const TWO_LINE_ROW = 16.5;
const MIN_ROW = 8;
const MONTH_ROW = 10.5;
const FOOTER_TOP = PAGE_HEIGHT - MARGIN - 8;
/** Between the heading, the week, the months and the footer. */
const SECTION_GAP = 12;

/** Public Sans: ascender, cap height and descender as a share of the font size. */
const ASCENT = 0.95;
const CAP_HEIGHT = 0.723;
const DESCENT = 0.225;

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface FontFiles {
  regular: Uint8Array;
  semibold: Uint8Array;
  bold: Uint8Array;
}

type Weight = keyof FontFiles;
type Fonts = Record<Weight, PDFFont>;

const TOKEN_NAMES = [
  "sunk", "ink", "ink-2", "ink-3", "line", "line-2", "brand", "brand-tint", "brand-on",
  "block", "block-bg", "review", "review-bg", "warn", "warn-bg",
] as const;
type Token = (typeof TOKEN_NAMES)[number];
type Palette = Record<Token, RGB>;

/** The light theme's colors from tokens.css (APP-SPEC 4.1): paper is white whatever the screen's theme. */
export function printPalette(css: string = tokensCss): Palette {
  const start = css.search(/^:root \{/m);
  const block = css.slice(start, css.indexOf("}", start));
  const values = new Map<string, RGB>();
  for (const [, name, hex] of block.matchAll(/--([a-z0-9-]+):\s*#([0-9a-fA-F]{6});/g)) {
    const channel = (at: number) => parseInt(hex!.slice(at, at + 2), 16) / 255;
    values.set(name!, colorFrom(channel(0), channel(2), channel(4)));
  }
  const palette = {} as Palette;
  for (const name of TOKEN_NAMES) {
    const value = values.get(name);
    if (!value) throw new Error(`tokens.css has no light value for --${name}`);
    palette[name] = value;
  }
  return palette;
}

interface TextStyle {
  weight?: Weight;
  size: number;
  color: RGB;
  align?: "left" | "center" | "right";
}

interface BoxStyle {
  fill?: RGB;
  stroke?: RGB;
  strokeWidth?: number;
  dash?: number[];
  radius?: number;
  /** Round only the top corners (the grid's heading band). */
  topOnly?: boolean;
}

/**
 * Drawing with the origin at the page's top left, as the layout reads. Without a page it only
 * measures, so a block can be sized before it is drawn.
 */
class Painter {
  constructor(
    private readonly page: PDFPage | null,
    readonly fonts: Fonts,
    readonly color: Palette,
  ) {}

  width(text: string, weight: Weight, size: number): number {
    return this.fonts[weight].widthOfTextAtSize(text, size);
  }

  /** The text cut to fit the width, ending in an ellipsis when cut. */
  fit(text: string, weight: Weight, size: number, width: number): string {
    if (this.width(text, weight, size) <= width) return text;
    let end = text.length;
    while (end > 0 && this.width(`${text.slice(0, end).trimEnd()}…`, weight, size) > width) end--;
    return end > 0 ? `${text.slice(0, end).trimEnd()}…` : "";
  }

  /** The largest size, from `size` down to `min`, at which the text fits the width. */
  sizeToFit(text: string, weight: Weight, size: number, min: number, width: number): number {
    let fitted = size;
    while (fitted > min && this.width(text, weight, fitted) > width) fitted = Math.max(min, fitted - 0.25);
    return fitted;
  }

  /** Greedy word wrap; a word wider than the line is cut to fit. */
  wrap(text: string, weight: Weight, size: number, width: number): string[] {
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (this.width(next, weight, size) <= width) {
        line = next;
      } else {
        if (line) lines.push(line);
        line = this.fit(word, weight, size, width);
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  /** One line whose ascender sits at `top`; x is its left, center or right by `align`. */
  text(text: string, x: number, top: number, style: TextStyle): void {
    this.baseline(text, x, top + style.size * ASCENT, style);
  }

  /** One line centered on `middle` by its capital letters, as figures in a cell are. */
  middle(text: string, x: number, middle: number, style: TextStyle): void {
    this.baseline(text, x, middle + (style.size * CAP_HEIGHT) / 2, style);
  }

  /** One line sitting on `baseline`. */
  baseline(text: string, x: number, baseline: number, style: TextStyle): void {
    if (!this.page || !text) return;
    const weight = style.weight ?? "regular";
    const width = this.width(text, weight, style.size);
    const left = style.align === "center" ? x - width / 2 : style.align === "right" ? x - width : x;
    this.page.drawText(text, {
      x: left,
      y: PAGE_HEIGHT - baseline,
      size: style.size,
      font: this.fonts[weight],
      color: style.color,
    });
  }

  box(x: number, top: number, width: number, height: number, style: BoxStyle): void {
    if (!this.page) return;
    const r = Math.min(style.radius ?? 0, width / 2, height / 2);
    const border = style.stroke
      ? { borderColor: style.stroke, borderWidth: style.strokeWidth ?? 0.75, borderDashArray: style.dash }
      : {};
    if (r === 0) {
      this.page.drawRectangle({ x, y: PAGE_HEIGHT - top - height, width, height, color: style.fill, ...border });
      return;
    }
    const bottom = style.topOnly ? 0 : r;
    const path =
      `M ${r} 0 H ${width - r} Q ${width} 0 ${width} ${r} V ${height - bottom} ` +
      (bottom ? `Q ${width} ${height} ${width - r} ${height} H ${r} Q 0 ${height} 0 ${height - r}` : `L ${width} ${height} H 0`) +
      ` V ${r} Q 0 0 ${r} 0 Z`;
    this.page.drawSvgPath(path, { x, y: PAGE_HEIGHT - top, color: style.fill, ...border });
  }

  line(x1: number, y1: number, x2: number, y2: number, color: RGB, thickness = 0.5, dash?: number[]): void {
    this.page?.drawLine({
      start: { x: x1, y: PAGE_HEIGHT - y1 },
      end: { x: x2, y: PAGE_HEIGHT - y2 },
      color,
      thickness,
      dashArray: dash,
    });
  }

  dot(x: number, y: number, size: number, color: RGB): void {
    this.page?.drawCircle({ x, y: PAGE_HEIGHT - y, size, color });
  }

  /** A stroked mark (the check and the cross), in a 10-unit box centered on (x, y). */
  mark(path: string, x: number, y: number, scale: number, color: RGB): void {
    this.page?.drawSvgPath(path, {
      x: x - 5 * scale,
      y: PAGE_HEIGHT - (y - 5 * scale),
      scale,
      borderColor: color,
      borderWidth: 1.6 / scale,
      borderLineCap: LineCapStyle.Round,
    });
  }
}

const CHECK_MARK = "M 2.2 5.2 L 4.2 7.2 L 7.9 3";
const CROSS_MARK = "M 3 3 L 7 7 M 7 3 L 3 7";

/** The logo from Logo.tsx: three filled 15-minute squares and one open, drawn `size` wide. */
function drawLogo(p: Painter, x: number, top: number, size: number): void {
  const unit = size / 32;
  for (const [left, upper] of [[2, 2], [17, 2], [2, 17]] as const) {
    p.box(x + left * unit, top + upper * unit, 13 * unit, 13 * unit, { fill: p.color.brand, radius: 2 * unit });
  }
  p.box(x + 18 * unit, top + 18 * unit, 11 * unit, 11 * unit, { stroke: p.color.brand, strokeWidth: 2 * unit, radius: 1.5 * unit });
}

/** The page's heading: who and what, with the status on the right. Returns its bottom. */
function drawHeader(p: Painter, sheet: ScheduleSheet): number {
  drawLogo(p, LEFT, MARGIN, 12);
  p.middle("CarePlan Scheduler", LEFT + 17, MARGIN + 6, { weight: "bold", size: 8.5, color: p.color.ink });
  p.middle("Weekly care schedule, Sunday to Saturday", RIGHT, MARGIN + 6, {
    weight: "semibold", size: 8.5, color: p.color.brand, align: "right",
  });

  // The status pill: "Ready to use" in the brand's tint, or what to fix in red.
  const status = sheet.status;
  const pillSize = 9;
  const pillWidth = p.width(status.title, "bold", pillSize) + 34;
  const nameTop = MARGIN + 22;
  const pillTop = nameTop + 1;
  p.box(RIGHT - pillWidth, pillTop, pillWidth, 20, { fill: status.blocked ? p.color["block-bg"] : p.color["brand-tint"], radius: 10 });
  const tone = status.blocked ? p.color.block : p.color.brand;
  p.mark(status.blocked ? CROSS_MARK : CHECK_MARK, RIGHT - pillWidth + 15, pillTop + 10, 1.05, tone);
  p.middle(status.title, RIGHT - pillWidth + 25, pillTop + 10, { weight: "bold", size: pillSize, color: tone });

  // The participant, or lines to write the name and DCN on (a plan built by hand has neither).
  const nameWidth = RIGHT - LEFT - pillWidth - 24;
  if (sheet.name !== null) {
    const size = p.sizeToFit(sheet.name, "bold", 20, 13, nameWidth);
    p.text(p.fit(sheet.name, "bold", size, nameWidth), LEFT, nameTop, { weight: "bold", size, color: p.color.ink });
  } else {
    p.text("Participant", LEFT, nameTop + 2, { size: 7, color: p.color["ink-3"] });
    p.line(LEFT, nameTop + 20, LEFT + 250, nameTop + 20, p.color["line-2"], 0.75);
    p.text("DCN", LEFT + 270, nameTop + 2, { size: 7, color: p.color["ink-3"] });
    p.line(LEFT + 270, nameTop + 20, LEFT + 390, nameTop + 20, p.color["line-2"], 0.75);
  }

  // Facts: a small label over each value, side by side, wrapping onto a second line if they must.
  let x = LEFT;
  let top = nameTop + 30;
  for (const fact of sheet.facts) {
    const value = p.fit(fact.value, "semibold", 8.5, RIGHT - LEFT);
    const width = Math.max(p.width(fact.label, "regular", 6.5), p.width(value, "semibold", 8.5));
    if (x > LEFT && x + width > RIGHT) {
      x = LEFT;
      top += 22;
    }
    p.text(fact.label, x, top, { size: 6.5, color: p.color["ink-3"] });
    p.text(value, x, top + 9, { weight: "semibold", size: 8.5, color: p.color.ink });
    x += width + 20;
  }
  const bottom = top + 24;
  p.line(LEFT, bottom, RIGHT, bottom, p.color.line, 0.75);
  return bottom;
}

function dayLeft(day: number): number {
  return LEFT + TASK_COLUMN + day * DAY_COLUMN;
}

const WEEK_CENTER = LEFT + GRID_WIDTH - WEEK_COLUMN / 2;

/** How tall each row of the week can be in the space left for it. */
function rowHeight(rows: number, space: number): number {
  return Math.max(MIN_ROW, Math.min(MAX_ROW, (space - GRID_HEAD - 3 * TOTAL_ROW - 4) / Math.max(rows, 1)));
}

function drawTaskName(p: Painter, row: SheetRow, top: number, height: number): void {
  const width = TASK_COLUMN - 14;
  const nameColor = row.transport ? p.color["ink-2"] : p.color.ink;
  if (height >= TWO_LINE_ROW) {
    // Centered by what shows: the name's capitals, a gap clear of its descenders, the detail line.
    const nameSize = Math.min(8.5, height * 0.46);
    const detailSize = nameSize * 0.78;
    const gap = 3;
    const visible = nameSize * CAP_HEIGHT + gap + detailSize * (CAP_HEIGHT + DESCENT);
    const nameBaseline = top + (height - visible) / 2 + nameSize * CAP_HEIGHT;
    p.baseline(p.fit(row.name, "semibold", nameSize, width), LEFT + 8, nameBaseline, { weight: "semibold", size: nameSize, color: nameColor });
    p.baseline(p.fit(row.detail, "regular", detailSize, width), LEFT + 8, nameBaseline + gap + detailSize * CAP_HEIGHT, {
      size: detailSize, color: p.color["ink-3"],
    });
    return;
  }
  // One line: the name, then its minutes and days if they fit.
  const size = Math.min(8, height * 0.68);
  const name = p.fit(row.name, "semibold", size, width);
  p.middle(name, LEFT + 8, top + height / 2, { weight: "semibold", size, color: nameColor });
  const after = p.width(name, "semibold", size) + 5;
  const detail = p.fit(row.detail, "regular", size * 0.85, width - after);
  if (detail === row.detail) {
    p.middle(detail, LEFT + 8 + after, top + height / 2, { size: size * 0.85, color: p.color["ink-3"] });
  }
}

function drawCell(p: Painter, cell: SheetCell, transport: boolean, left: number, top: number, height: number): void {
  const inset = 4;
  const pillHeight = Math.min(height - 2, 16);
  const pillTop = top + (height - pillHeight) / 2;
  const width = DAY_COLUMN - inset * 2;
  // Figures stay legible in a long plan's short rows.
  const size = Math.min(8.5, Math.max(6, height * 0.62));
  if (transport) {
    p.box(left + inset, pillTop, width, pillHeight, { stroke: p.color["line-2"], strokeWidth: 0.6, dash: [1.5, 1.5], radius: 3 });
    p.middle(String(cell.minutes), left + DAY_COLUMN / 2, top + height / 2, {
      weight: "semibold", size, color: p.color["ink-2"], align: "center",
    });
    return;
  }
  p.box(left + inset, pillTop, width, pillHeight, { fill: cell.over ? p.color["warn-bg"] : p.color["brand-tint"], radius: 3 });
  p.middle(String(cell.minutes), left + DAY_COLUMN / 2, top + height / 2, {
    weight: "bold", size, color: cell.over ? p.color.warn : p.color.ink, align: "center",
  });
  // QS-10: a changed cell is underlined, as on the screen.
  if (cell.changed) p.box(left + inset + 3, pillTop + pillHeight - 1.6, width - 6, 1.2, { fill: p.color.warn });
}

/** The week, Sunday to Saturday: a row per task, then each day's visit length, minutes and units. */
function drawGrid(p: Painter, sheet: ScheduleSheet, top: number, height: number): number {
  const rows = sheet.rows;
  const rowH = rowHeight(rows.length, height);
  const bodyTop = top + GRID_HEAD;
  const totalsTop = bodyTop + rows.length * rowH + 2;
  const bottom = totalsTop + 3 * TOTAL_ROW + 2;

  // Days without care are shaded from heading to totals.
  sheet.days.forEach((day, index) => {
    if (!day.care) p.box(dayLeft(index), bodyTop, DAY_COLUMN, bottom - bodyTop, { fill: p.color.sunk });
  });

  // Heading band.
  p.box(LEFT, top, GRID_WIDTH, GRID_HEAD, { fill: p.color.brand, radius: 5, topOnly: true });
  const head = { weight: "semibold" as const, size: 8, color: p.color["brand-on"] };
  p.middle("Task", LEFT + 8, top + GRID_HEAD / 2, head);
  sheet.days.forEach((day, index) => {
    const name = p.width(day.name, "semibold", 8) <= DAY_COLUMN - 4 ? day.name : WEEKDAY_SHORT[index]!;
    p.middle(name, dayLeft(index) + DAY_COLUMN / 2, top + GRID_HEAD / 2, { ...head, align: "center" });
  });
  p.middle("Week", WEEK_CENTER, top + GRID_HEAD / 2, { ...head, align: "center" });

  rows.forEach((row, index) => {
    const rowTop = bodyTop + index * rowH;
    drawTaskName(p, row, rowTop, rowH);
    row.cells.forEach((cell, day) => {
      if (cell) drawCell(p, cell, row.transport, dayLeft(day), rowTop, rowH);
      else if (sheet.days[day]?.care) p.dot(dayLeft(day) + DAY_COLUMN / 2, rowTop + rowH / 2, 0.8, p.color["line-2"]);
    });
    const weekSize = Math.min(8, rowH * 0.6);
    p.middle(row.weekMinutes ? String(row.weekMinutes) : "", WEEK_CENTER, rowTop + rowH / 2, {
      weight: "semibold", size: weekSize, color: p.color["ink-2"], align: "center",
    });
    p.line(LEFT, rowTop + rowH, LEFT + GRID_WIDTH, rowTop + rowH, p.color.line, 0.5);
  });

  // Totals: each visit's length (what an EVV window is set to), its minutes and its units.
  p.line(LEFT, totalsTop - 1, LEFT + GRID_WIDTH, totalsTop - 1, p.color.ink, 0.9);
  const totals: [string, (index: number) => string, string, Weight][] = [
    ["Visit length", (index) => sheet.days[index]?.visit ?? "No visit", sheet.week.visit, "bold"],
    ["Minutes", (index) => sheet.days[index]?.minutes ?? "", sheet.week.minutes, "regular"],
    ["Units", (index) => sheet.days[index]?.units ?? "", sheet.week.units, "regular"],
  ];
  totals.forEach(([label, value, week, weight], line) => {
    const middle = totalsTop + line * TOTAL_ROW + TOTAL_ROW / 2;
    const size = line === 0 ? 7.5 : 7;
    p.middle(label, LEFT + 8, middle, { weight: "semibold", size, color: line === 0 ? p.color.ink : p.color["ink-2"] });
    for (let day = 0; day < 7; day++) {
      const text = value(day);
      const none = line === 0 && sheet.days[day]?.visit === null;
      const fitted = p.sizeToFit(text, weight, size, 5.5, DAY_COLUMN - 4);
      p.middle(text, dayLeft(day) + DAY_COLUMN / 2, middle, {
        weight: none ? "regular" : weight,
        size: none ? 6.5 : fitted,
        color: none ? p.color["ink-3"] : line === 0 ? p.color.ink : p.color["ink-2"],
        align: "center",
      });
    }
    p.middle(week, WEEK_CENTER, middle, {
      weight, size: p.sizeToFit(week, weight, size, 5.5, WEEK_COLUMN - 4), color: line === 0 ? p.color.ink : p.color["ink-2"], align: "center",
    });
  });

  // Column rules between the days, light enough to read across.
  for (let day = 0; day <= 7; day++) {
    p.line(dayLeft(day), bodyTop, dayLeft(day), bottom, p.color.line, 0.5);
  }
  p.line(LEFT, bottom, LEFT + GRID_WIDTH, bottom, p.color.line, 0.5);
  return bottom;
}

/** A small heading over a sidebar section; returns where its content starts. */
function heading(p: Painter, text: string, x: number, top: number): number {
  p.text(text, x, top, { weight: "bold", size: 7.5, color: p.color.brand });
  return top + 12;
}

interface KeyItem {
  label: string;
  /** Drawn before the label; without one the label starts at the edge. */
  swatch?: (x: number, top: number) => void;
}

/**
 * The column beside the week: the week in figures, the checks, the review with the participant
 * and a key to the grid. Checks are cut short, with a count of the rest, if they don't all fit.
 */
function drawSidebar(p: Painter, sheet: ScheduleSheet, top: number, bottomLimit: number): number {
  const x = RIGHT - SIDEBAR_WIDTH;
  const width = SIDEBAR_WIDTH;

  // The key and the review sit at the bottom of the column; work out their height first.
  const key: KeyItem[] = [
    { label: "Minutes scheduled that day", swatch: (left, upper) => p.box(left, upper, 12, 7, { fill: p.color["brand-tint"], radius: 1.5 }) },
  ];
  const cells = sheet.rows.flatMap((row) => row.cells.filter((cell): cell is SheetCell => cell !== null));
  if (cells.some((cell) => cell.changed)) {
    key.push({
      label: "Minutes changed by hand",
      swatch: (left, upper) => {
        p.box(left, upper, 12, 7, { fill: p.color["brand-tint"], radius: 1.5 });
        p.box(left + 2, upper + 5.4, 8, 1.1, { fill: p.color.warn });
      },
    });
  }
  if (cells.some((cell) => cell.over)) {
    key.push({ label: "More than the task's minutes a day", swatch: (left, upper) => p.box(left, upper, 12, 7, { fill: p.color["warn-bg"], radius: 1.5 }) });
  }
  if (sheet.rows.some((row) => row.transport)) {
    key.push({
      label: "Transportation, set aside",
      swatch: (left, upper) => p.box(left, upper, 12, 7, { stroke: p.color["line-2"], strokeWidth: 0.6, dash: [1.5, 1.5], radius: 1.5 }),
    });
  }
  if (sheet.days.some((day) => !day.care)) {
    key.push({ label: "Not a care day", swatch: (left, upper) => p.box(left, upper, 12, 7, { fill: p.color.sunk }) });
  }
  key.push({ label: "One unit = 15 minutes" });
  const keyHeight = 12 + key.length * 10;
  const reviewHeight = 12 + 22;
  let y = top;

  // The week in figures.
  y = heading(p, "This week", x, y);
  for (const figure of sheet.summary) {
    p.text(figure.label, x, y, { size: 6.5, color: p.color["ink-3"] });
    p.text(p.fit(figure.value, "bold", 10, width), x, y + 8.5, { weight: "bold", size: 10, color: p.color.ink });
    let noteTop = y + 21;
    for (const line of p.wrap(figure.note, "regular", 7, width)) {
      p.text(line, x, noteTop, { size: 7, color: p.color["ink-2"] });
      noteTop += 9;
    }
    y = noteTop + 4;
  }

  // Checks: the status line, then each Must fix, Needs review and Worth checking card in brief.
  y = heading(p, "Checks", x, y + 4);
  for (const line of p.wrap(sheet.status.detail, "regular", 7, width)) {
    p.text(line, x, y, { size: 7, color: p.color["ink-2"] });
    y += 9;
  }
  y += 3;
  const tones = {
    BLOCK: [p.color.block, p.color["block-bg"]],
    REVIEW: [p.color.review, p.color["review-bg"]],
    WARN: [p.color.warn, p.color["warn-bg"]],
  } as const;
  const room = bottomLimit - reviewHeight - keyHeight - 8;
  for (const [index, check] of sheet.checks.entries()) {
    const lines = [
      ...p.wrap(check.title, "semibold", 7, width - 10).map((text) => ({ text, weight: "semibold" as const })),
      ...p.wrap(check.context, "regular", 6.5, width - 10).map((text) => ({ text, weight: "regular" as const })),
    ];
    const cardHeight = 12 + lines.length * 8.5 + 4;
    const rest = sheet.checks.length - index;
    // Keep a line for "and N more" unless this card is the last.
    if (y + cardHeight + (rest > 1 ? 11 : 0) > room) {
      p.text(`And ${rest} more ${rest === 1 ? "check" : "checks"}. See Checks in Quick Schedule.`, x, y, {
        weight: "semibold", size: 7, color: p.color["ink-2"],
      });
      y += 11;
      break;
    }
    const [tone, tint] = tones[check.severity];
    p.box(x, y, width, cardHeight - 3, { fill: tint, radius: 3 });
    p.box(x, y, 2.5, cardHeight - 3, { fill: tone });
    p.text(check.label, x + 7, y + 3, { weight: "bold", size: 6.5, color: tone });
    let lineTop = y + 12;
    for (const line of lines) {
      p.text(line.text, x + 7, lineTop, { weight: line.weight, size: line.weight === "semibold" ? 7 : 6.5, color: p.color.ink });
      lineTop += 8.5;
    }
    y += cardHeight;
  }

  // Reviewed with the participant (INFO 09-25-02): the date, or a line to write it on.
  y = heading(p, "Reviewed with the participant", x, y + 6);
  if (sheet.reviewed !== null) {
    p.text(sheet.reviewed, x, y + 1, { weight: "semibold", size: 9, color: p.color.ink });
  } else {
    p.text("Date", x, y + 7, { size: 7, color: p.color["ink-3"] });
    p.line(x + 20, y + 14, x + width, y + 14, p.color["line-2"], 0.75);
  }
  y += 22;

  // The key to the grid.
  y = heading(p, "Key", x, y + 4);
  for (const item of key) {
    item.swatch?.(x, y + 0.5);
    p.text(item.label, item.swatch ? x + 17 : x, y, { size: 7, color: p.color["ink-2"] });
    y += 10;
  }
  return y;
}

interface MonthLine {
  label: string;
  value: (month: SheetMonth) => string;
  /** A figure that needs attention: over the authorization, or cut at month end. */
  flag?: (month: SheetMonth) => "block" | "warn" | null;
}

/** The table's lines: a "Starting" line only when some month is cut short. */
function monthLines(sheet: ScheduleSheet): MonthLine[] {
  const lines: MonthLine[] = [
    { label: "Month", value: (month) => month.label },
    { label: "Authorized", value: (month) => month.authorized },
    { label: "Scheduled", value: (month) => month.scheduled },
    { label: "Left", value: (month) => month.left, flag: (month) => (month.over ? "block" : null) },
    { label: "Cut at month end", value: (month) => month.cut || "–", flag: (month) => (month.cut ? "warn" : null) },
  ];
  if (sheet.months.some((month) => month.cut)) {
    lines.push({ label: "Starting", value: (month) => month.cutFrom || "–", flag: (month) => (month.cut ? "warn" : null) });
  }
  return lines;
}

/** Each month's authorized, scheduled and left units and the minutes cut at month end. */
function stripHeight(p: Painter, sheet: ScheduleSheet): number {
  const notes = [sheet.authorizedNote, sheet.cutNote].filter((note): note is string => note !== null);
  const lines = notes.reduce((sum, note) => sum + p.wrap(note, "regular", 6.5, RIGHT - LEFT).length, 0);
  return 12 + monthLines(sheet).length * MONTH_ROW + 4 + lines * 8.5;
}

function drawMonths(p: Painter, sheet: ScheduleSheet, top: number): number {
  const labelWidth = 84;
  const columnWidth = Math.min(64, (RIGHT - LEFT - labelWidth) / Math.max(sheet.months.length, 1));
  const tableWidth = labelWidth + columnWidth * sheet.months.length;
  const lines = monthLines(sheet);
  let y = heading(p, "Units by month", LEFT, top);

  p.box(LEFT, y, tableWidth, MONTH_ROW, { fill: p.color.sunk, radius: 2 });
  lines.forEach((line, index) => {
    const middle = y + index * MONTH_ROW + MONTH_ROW / 2;
    const first = index === 0;
    p.middle(line.label, LEFT + 6, middle, { weight: "semibold", size: 7, color: first ? p.color.ink : p.color["ink-2"] });
    sheet.months.forEach((month, at) => {
      const text = line.value(month);
      const flag = line.flag?.(month) ?? null;
      const weight = first || flag === "block" ? "semibold" : "regular";
      p.middle(text, LEFT + labelWidth + columnWidth * at + columnWidth / 2, middle, {
        weight,
        size: p.sizeToFit(text, weight, 7, 5.5, columnWidth - 4),
        color: flag ? p.color[flag] : first ? p.color.ink : p.color["ink-2"],
        align: "center",
      });
    });
    if (!first) p.line(LEFT, y + index * MONTH_ROW, LEFT + tableWidth, y + index * MONTH_ROW, p.color.line, 0.4);
  });
  y += lines.length * MONTH_ROW + 4;

  for (const [note, color] of [[sheet.authorizedNote, p.color["ink-3"]], [sheet.cutNote, p.color.warn]] as const) {
    if (note === null) continue;
    for (const line of p.wrap(note, "regular", 6.5, RIGHT - LEFT)) {
      p.text(line, LEFT, y, { size: 6.5, color });
      y += 8.5;
    }
  }
  return y;
}

function drawFooter(p: Painter, sheet: ScheduleSheet): void {
  p.line(LEFT, FOOTER_TOP - 5, RIGHT, FOOTER_TOP - 5, p.color.line, 0.5);
  p.text(sheet.footer, LEFT, FOOTER_TOP, { size: 6.5, color: p.color["ink-3"] });
  p.text("Set each EVV visit window to its visit length.", RIGHT, FOOTER_TOP, { size: 6.5, color: p.color["ink-3"], align: "right" });
}

/** Lays the sheet out on the page (or, without a page, only measures). */
function layOut(p: Painter, sheet: ScheduleSheet): void {
  const headerBottom = drawHeader(p, sheet);
  const mainTop = headerBottom + SECTION_GAP;
  const mainLimit = FOOTER_TOP - SECTION_GAP - stripHeight(p, sheet) - SECTION_GAP;
  const gridBottom = drawGrid(p, sheet, mainTop, mainLimit - mainTop);
  const sidebarBottom = drawSidebar(p, sheet, mainTop, mainLimit);
  drawMonths(p, sheet, Math.max(gridBottom, sidebarBottom) + SECTION_GAP);
  drawFooter(p, sheet);
}

/** The one-page PDF of the schedule. */
export async function renderSchedulePdf(sheet: ScheduleSheet, files: FontFiles, now: Date): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.registerFontkit(fontkit);
  const fonts: Fonts = {
    regular: await doc.embedFont(files.regular, { subset: true }),
    semibold: await doc.embedFont(files.semibold, { subset: true }),
    bold: await doc.embedFont(files.bold, { subset: true }),
  };
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  layOut(new Painter(page, fonts, printPalette()), sheet);

  // No name in the title: a PDF viewer shows it in its tab and window list.
  doc.setTitle("Weekly care schedule", { showInWindowTitleBar: true });
  doc.setCreator("CarePlan Scheduler");
  doc.setProducer("CarePlan Scheduler");
  doc.setLanguage("en-US");
  doc.setCreationDate(now);
  doc.setModificationDate(now);
  return doc.save();
}

/** Public Sans (static weights, latin) from this site, so the PDF's type matches the screen's. */
export async function fontFiles(): Promise<FontFiles> {
  const load = async (url: string): Promise<Uint8Array> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Font request failed with ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  };
  const [regular, semibold, bold] = await Promise.all([load(regularUrl), load(semiboldUrl), load(boldUrl)]);
  return { regular, semibold, bold };
}

/** The schedule's PDF, ready to open or save. */
export async function schedulePdfBlob(sheet: ScheduleSheet, now: Date): Promise<Blob> {
  const bytes = await renderSchedulePdf(sheet, await fontFiles(), now);
  return new Blob([bytes.slice()], { type: "application/pdf" });
}
