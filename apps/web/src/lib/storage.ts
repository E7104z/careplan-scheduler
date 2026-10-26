export type StorageKind = "session" | "local";

function pick(kind: StorageKind): Storage {
  return kind === "session" ? sessionStorage : localStorage;
}

export function readJson<T>(kind: StorageKind, key: string): T | null {
  try {
    const raw = pick(kind).getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJson(kind: StorageKind, key: string, value: unknown): void {
  try {
    pick(kind).setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be full or blocked; the write is best-effort.
  }
}

export function removeJson(kind: StorageKind, key: string): void {
  try {
    pick(kind).removeItem(key);
  } catch {
    // Best-effort only.
  }
}
