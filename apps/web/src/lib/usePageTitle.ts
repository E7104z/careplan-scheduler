import { useEffect, useRef } from "react";

/**
 * Sets document.title and moves focus to the page's h1 on mount and whenever the
 * title changes. The returned ref is attached to the page's <h1 tabIndex={-1}>.
 */
export function usePageTitle(title: string) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    document.title = title;
    headingRef.current?.focus();
  }, [title]);

  return headingRef;
}
