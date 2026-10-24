import { Spinner } from "./Spinner";

/** Shown for the moment a page's chunk (or the signed-in session) is loading. */
export function PageLoading() {
  return (
    <div role="status" className="flex justify-center px-4 py-16 text-ink-3">
      <Spinner className="h-6 w-6" />
      <span className="sr-only">Loading the page</span>
    </div>
  );
}
