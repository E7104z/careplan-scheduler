import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount every rendered tree after each test. Radix modal layers set
// document.body.style.pointerEvents = "none" while open and restore it only on
// unmount; without cleanup that value leaks into later tests.
afterEach(cleanup);

// Minimal stubs for browser APIs that Radix primitives use but jsdom lacks.
if (typeof window !== "undefined") {
  if (typeof globalThis.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    globalThis.ResizeObserver =
      ResizeObserverStub as unknown as typeof ResizeObserver;
  }

  if (typeof window.matchMedia !== "function") {
    window.matchMedia = ((query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  }

  if (typeof globalThis.requestAnimationFrame !== "function") {
    globalThis.requestAnimationFrame = (callback) =>
      window.setTimeout(() => callback(Date.now()), 16);
    globalThis.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
  }

  const proto = window.HTMLElement.prototype as HTMLElement & {
    scrollIntoView?: () => void;
    releasePointerCapture?: () => void;
    hasPointerCapture?: () => boolean;
    setPointerCapture?: () => void;
  };
  if (typeof proto.scrollIntoView !== "function") proto.scrollIntoView = () => {};
  if (typeof proto.releasePointerCapture !== "function") {
    proto.releasePointerCapture = () => {};
  }
  if (typeof proto.hasPointerCapture !== "function") {
    proto.hasPointerCapture = () => false;
  }
  if (typeof proto.setPointerCapture !== "function") {
    proto.setPointerCapture = () => {};
  }
}
