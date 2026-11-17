import { planFromStored, storedPlan } from "./persistence";
import type { CarePlan } from "./types";

/**
 * APP-SPEC 5.9 saved plan file: the whole care plan, encrypted on this computer with a passphrase
 * only the person knows, saved as a `.careplan` file. Nothing is uploaded. It is the only copy that
 * keeps the participant's name and DCN, because it is encrypted (AES-256-GCM, key from PBKDF2-SHA-256
 * at 600,000 iterations, OWASP Password Storage Cheat Sheet 2023). It opens through the same shape
 * check as the tab's own copy, so a damaged or foreign file never reaches the schedule.
 *
 * This module is its own chunk: it loads when the person saves or opens a plan file (APP-SPEC 10).
 */

export const PLAN_FILE_FORMAT = "careplan-scheduler/plan";
export const PLAN_FILE_VERSION = 1;
export const PLAN_FILE_EXTENSION = ".careplan";
/** NIST SP 800-63B-4 3.1.1.2: a password that is the only factor is at least 15 characters. */
export const PASSPHRASE_MIN = 15;

const ITERATIONS = 600_000;
/** A file asking for more than this would hang the page; no file this app writes does. */
const MAX_ITERATIONS = 5_000_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export type PlanFileProblem = "not-a-plan-file" | "wrong-passphrase" | "unreadable";

export class PlanFileError extends Error {
  constructor(readonly problem: PlanFileProblem) {
    super(problem);
    this.name = "PlanFileError";
  }
}

/** What a plan file holds once opened. */
export interface OpenedPlanFile {
  plan: CarePlan;
  /** YYYY-MM-DD the file was saved. */
  savedAt: string;
}

/** "Care plan 2026-11-16.careplan": the date only. The name and DCN stay inside, encrypted. */
export function planFileName(today: string): string {
  return `Care plan ${today}${PLAN_FILE_EXTENSION}`;
}

function toBase64(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let at = 0; at < binary.length; at++) bytes[at] = binary.charCodeAt(at);
  return bytes;
}

/** The header is bound to the ciphertext, so a file with an edited header doesn't open. */
function header(iterations: number): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`${PLAN_FILE_FORMAT};v${PLAN_FILE_VERSION};PBKDF2-SHA-256;${iterations};AES-GCM`);
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number, usage: KeyUsage): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

/** The plan file's text: a small JSON header and the encrypted plan. */
export async function encryptPlan(plan: CarePlan, passphrase: string, savedAt: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, ITERATIONS, "encrypt");
  const payload = new TextEncoder().encode(JSON.stringify({ savedAt, plan: storedPlan(plan, { keepIdentity: true }) }));
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: header(ITERATIONS) }, key, payload);
  return JSON.stringify({
    format: PLAN_FILE_FORMAT,
    version: PLAN_FILE_VERSION,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: ITERATIONS, salt: toBase64(salt) },
    cipher: { name: "AES-GCM", iv: toBase64(iv) },
    data: toBase64(new Uint8Array(sealed)),
  });
}

interface FileHeader {
  iterations: number;
  salt: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  data: Uint8Array<ArrayBuffer>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The file's header, or a not-a-plan-file error for anything this app didn't write. */
function readHeader(text: string): FileHeader {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PlanFileError("not-a-plan-file");
  }
  if (!isRecord(parsed) || parsed.format !== PLAN_FILE_FORMAT) throw new PlanFileError("not-a-plan-file");
  // A later version of the app wrote it: it's a plan file, but not one this version can read.
  if (parsed.version !== PLAN_FILE_VERSION) throw new PlanFileError("unreadable");
  const { kdf, cipher, data } = parsed;
  if (!isRecord(kdf) || !isRecord(cipher) || typeof data !== "string") throw new PlanFileError("unreadable");
  const { iterations, salt } = kdf;
  if (kdf.name !== "PBKDF2" || kdf.hash !== "SHA-256" || cipher.name !== "AES-GCM") throw new PlanFileError("unreadable");
  if (typeof iterations !== "number" || !Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) {
    throw new PlanFileError("unreadable");
  }
  if (typeof salt !== "string" || typeof cipher.iv !== "string") throw new PlanFileError("unreadable");
  try {
    return { iterations, salt: fromBase64(salt), iv: fromBase64(cipher.iv), data: fromBase64(data) };
  } catch {
    throw new PlanFileError("unreadable");
  }
}

/** Opens a plan file with its passphrase, or throws a PlanFileError saying what is wrong. */
export async function decryptPlan(text: string, passphrase: string): Promise<OpenedPlanFile> {
  const file = readHeader(text);
  const key = await deriveKey(passphrase, file.salt, file.iterations, "decrypt");
  let opened: ArrayBuffer;
  try {
    opened = await crypto.subtle.decrypt({ name: "AES-GCM", iv: file.iv, additionalData: header(file.iterations) }, key, file.data);
  } catch {
    // AES-GCM can't tell a wrong passphrase from a changed file; the passphrase is far likelier.
    throw new PlanFileError("wrong-passphrase");
  }
  let content: unknown;
  try {
    content = JSON.parse(new TextDecoder().decode(opened));
  } catch {
    throw new PlanFileError("unreadable");
  }
  const plan = isRecord(content) ? planFromStored(content.plan) : null;
  if (!plan || !isRecord(content) || typeof content.savedAt !== "string") throw new PlanFileError("unreadable");
  return { plan, savedAt: content.savedAt };
}
