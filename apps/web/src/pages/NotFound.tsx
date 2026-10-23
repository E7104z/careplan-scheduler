import { Link } from "react-router";
import { usePageTitle } from "../lib/usePageTitle";

const linkClass = "rounded-sm font-semibold text-brand hover:underline";

export function NotFound() {
  const headingRef = usePageTitle("Page not found | CarePlan Scheduler");

  return (
    <div className="mx-auto w-full max-w-[1440px] px-[max(16px,env(safe-area-inset-left))] py-12">
      <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold text-ink">
        We can't find that page
      </h1>
      <p className="mt-3 text-ink-2">Check the address, or start again from a page that works.</p>
      <div className="mt-6 flex flex-wrap gap-6">
        <Link to="/" className={linkClass}>
          Go to the home page
        </Link>
        <Link to="/quick" className={linkClass}>
          Try Quick Schedule
        </Link>
      </div>
    </div>
  );
}
