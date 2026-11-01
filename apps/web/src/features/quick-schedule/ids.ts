/** JOIN-03: a random RFC 4122 version-4 UUID for an authorization or a task. */
export function newId(): string {
  return globalThis.crypto.randomUUID();
}
