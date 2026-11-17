/** A download's object URL is freed after this; the download started long before. */
const REVOKE_AFTER_MS = 60_000;

/** Downloads a file the page made (a PDF, a saved plan) under the given name. Nothing is uploaded. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}

/** A chosen file's text, through FileReader (works in every browser the app supports). */
export function readFileText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("The file couldn't be read"));
    reader.readAsText(file);
  });
}
