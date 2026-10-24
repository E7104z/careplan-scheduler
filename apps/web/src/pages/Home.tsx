import { useAuth } from "../features/auth/authContext";
import { usePageTitle } from "../lib/usePageTitle";

/** `/app` until Prompt 9 gives Home its agency content. */
export function Home() {
  const headingRef = usePageTitle("Home | CarePlan Scheduler");
  const { user } = useAuth();

  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-3 px-[max(16px,env(safe-area-inset-left))] pb-16 pt-6">
      <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold leading-tight text-ink max-sm:text-[24px]">
        Home
      </h1>
      <p className="text-ink-2">Signed in as {user?.email}</p>
    </div>
  );
}
