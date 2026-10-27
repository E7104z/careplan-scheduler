import { Link } from "react-router";
import { MO_2026_07, WORKSHEET_LEDGER, calculate3c, dollars, findTaskByName, type LedgerStatus } from "@careplan/engine";
import { cn } from "../lib/cn";
import { usePageTitle } from "../lib/usePageTitle";
import { CONFORMANCE } from "./conformanceSamples";

// The page states "0 differences". The samples module is `as const`, so if it ever recorded a
// difference this line would stop the build (Phase 3, Prompt 7).
const DIFFERENCES: 0 = CONFORMANCE.differences;

const MANUAL = "https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/";
const PAGE_3C = `${MANUAL}400-home-and-community-based-services-11`;
const PAGE_3A = `${MANUAL}400-home-and-community-based-services-10`;
const BATHING = findTaskByName(MO_2026_07, "Bathing")!.taskCode;

const HEAD = "px-3 py-2 text-left text-[13px] font-semibold text-ink-2";
const CELL = "px-3 py-2 align-top text-sm text-ink";
const NUMBER = "text-right tabular-nums";

const STATUS: Record<LedgerStatus, { word: string; className: string }> = {
  DONE: { word: "Done", className: "bg-brand-tint text-ink" },
  EXISTING: { word: "Already built", className: "bg-info-bg text-ink" },
  PLANNED: { word: "Planned", className: "bg-review-bg text-ink" },
};

const number = (value: number): string => value.toLocaleString("en-US");

/** "CarePlan Scheduler says", computed now by the engine, not read from the recorded file. */
function liveUnits(sample: (typeof CONFORMANCE.samples)[number]): number {
  const result = calculate3c({
    tab: sample.tab,
    rows: [{ taskCode: BATHING, minPerDay: sample.minPerDay, daysPerWeek: sample.daysPerWeek }],
    transportMinutesPerMonth: sample.transportMinutes,
  }, MO_2026_07);
  return sample.kind === "total" ? result.totalUnits : result.rows[0]!.totalUnits!;
}

/**
 * Phase 3 `/conformance`: how CarePlan Scheduler matches DSDS's HCBS-3c and HCBS-3a worksheets, with
 * rows anyone can type into DSDS's own workbook to check, and the parity ledger.
 */
export function Conformance() {
  const headingRef = usePageTitle("How we match DSDS's worksheets | CarePlan Scheduler");
  const c = CONFORMANCE.hcbs3c;
  const a = CONFORMANCE.hcbs3a;
  const typed = c.tabs.CDS.taskRows + c.tabs.ILW.taskRows;
  const done = WORKSHEET_LEDGER.filter((row) => row.status !== "PLANNED");
  const open = WORKSHEET_LEDGER.filter((row) => row.status === "PLANNED");

  return (
    <div className="mx-auto w-full max-w-[1440px] px-[max(16px,env(safe-area-inset-left))] py-12">
      <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-bold text-ink">
        How CarePlan Scheduler matches the state's worksheets
      </h1>
      <div className="mt-4 max-w-[70ch] space-y-3 text-ink-2">
        <p className="font-semibold text-ink">CarePlan Scheduler is not an official DSDS tool and DSDS has not reviewed it.</p>
        <p>
          We typed {number(typed)} combinations of minutes and days into DSDS's own worksheet workbook (the HCBS-3c,
          every whole minute from {number(c.minutes[0])} to {number(c.minutes[1])} on {c.days[0]} to {c.days[1]} days a week,
          on both its CDS and ILW tabs), recalculated it, and compared every answer with ours. {DIFFERENCES} differences.
        </p>
        <p>
          We did the same with {number(a.taskRows)} task rows of the In-Home Services Worksheet (HCBS-3a), in{" "}
          {number(a.workbooks)} copies of the workbook with every combination of its RCF/ALF and medically related boxes,
          including each line's cost. 0 differences there too.
        </p>
      </div>

      <section aria-labelledby="check" className="mt-10 grid gap-6 min-[960px]:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
        <div className="min-w-0">
          <h2 id="check" className="text-[17px] font-bold text-ink">Check it yourself</h2>
          <div role="region" aria-labelledby="check" tabIndex={0} className="relative mt-3 overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[560px] border-collapse">
              <caption className="sr-only">Rows to type into DSDS's worksheet, with both answers</caption>
              <thead className="bg-sunk">
                <tr>
                  <th scope="col" className={HEAD}>Row</th>
                  <th scope="col" className={cn(HEAD, NUMBER)}>Min/Day</th>
                  <th scope="col" className={cn(HEAD, NUMBER)}>Days/Wk</th>
                  <th scope="col" className={cn(HEAD, NUMBER)}>Transportation minutes</th>
                  <th scope="col" className={cn(HEAD, NUMBER)}>DSDS workbook says</th>
                  <th scope="col" className={cn(HEAD, NUMBER)}>CarePlan Scheduler says</th>
                </tr>
              </thead>
              <tbody>
                {CONFORMANCE.samples.map((sample, index) => (
                  <tr key={index} className="border-t border-line" data-sample={index}>
                    <th scope="row" className={cn(CELL, "text-left font-normal")}>
                      {sample.kind === "task" ? `${index + 1}. Total Units` : `${index + 1}. Total Units/Mo`}
                    </th>
                    <td className={cn(CELL, NUMBER)}>{number(sample.minPerDay)}</td>
                    <td className={cn(CELL, NUMBER)}>{sample.daysPerWeek}</td>
                    <td className={cn(CELL, NUMBER)}>{sample.transportMinutes === null ? "" : number(sample.transportMinutes)}</td>
                    <td className={cn(CELL, NUMBER)} data-recorded>{number(sample.recorded)}</td>
                    <td className={cn(CELL, NUMBER, "font-semibold")} data-live>{number(liveUnits(sample))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="text-[17px] font-bold text-ink">Four steps</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-2">
            <li>
              Download DSDS's worksheet from its page in the HCBS Manual:{" "}
              <a href={PAGE_3C} className="font-semibold text-brand underline hover:text-brand-hover">4.00 Appendix 4 (HCBS-3c)</a>
              {" "}or{" "}
              <a href={PAGE_3A} className="font-semibold text-brand underline hover:text-brand-hover">4.00 Appendix 3 (HCBS-3a)</a>.
            </li>
            <li>On the HCBS-3c's CDS tab, type the first row's Min/Day and Days/Wk into any task.</li>
            <li>Read that task's Total Units. For the last two rows, also type the transportation minutes and read Total Units/Mo.</li>
            <li>Compare with "DSDS workbook says". "CarePlan Scheduler says" is worked out by the app as this page loads.</li>
          </ol>
        </div>
      </section>

      <section aria-labelledby="ledger" className="mt-10">
        <h2 id="ledger" className="text-[17px] font-bold text-ink">Ledger status</h2>
        <p className="mt-2 text-ink-2">{done.length} of {WORKSHEET_LEDGER.length} worksheet items done.</p>
        {open.length > 0 ? (
          <div className="mt-2 text-ink-2">
            <p>Still to come:</p>
            <ul className="list-disc pl-5">
              {open.map((row) => <li key={row.id}>{row.id}: {row.item}{row.refs ? ` (${row.refs})` : ""}</li>)}
            </ul>
          </div>
        ) : null}
        <div role="region" aria-labelledby="ledger" tabIndex={0} className="relative mt-3 overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[640px] border-collapse">
            <caption className="sr-only">Every item of DSDS's worksheets and its status in CarePlan Scheduler</caption>
            <thead className="bg-sunk">
              <tr>
                <th scope="col" className={HEAD}>Item</th>
                <th scope="col" className={HEAD}>Form</th>
                <th scope="col" className={HEAD}>What DSDS's worksheet (or the manual) does</th>
                <th scope="col" className={HEAD}>Status</th>
              </tr>
            </thead>
            <tbody>
              {WORKSHEET_LEDGER.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <th scope="row" className={cn(CELL, "whitespace-nowrap text-left font-semibold")}>{row.id}</th>
                  <td className={cn(CELL, "whitespace-nowrap text-ink-2")}>{row.form}</td>
                  <td className={CELL}>{row.item}</td>
                  <td className={CELL}>
                    <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-medium", STATUS[row.status].className)}>
                      {STATUS[row.status].word}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="limits" className="mt-10 max-w-[70ch]">
        <h2 id="limits" className="text-[17px] font-bold text-ink">Known limits</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-2">
          <li>
            LibreOffice ({CONFORMANCE.libreOffice.split(" ").slice(0, 2).join(" ")}), not Microsoft Excel, recalculated DSDS's
            workbooks. The arithmetic is plain rounding, sums and IF; a check of three rows in Excel is still to be done.
          </li>
          <li>
            The costs use the rates printed in DSDS's workbooks: {dollars(MO_2026_07.worksheet3c!.unitRateCents)} a unit on
            the HCBS-3c, and the HCBS-3a's rate sheet. We haven't matched them to the rate schedule (3.00 Appendix 1) yet,
            so they show as estimates and the Rules page marks them Needs review.
          </li>
          <li>
            The HCBS-3c's CDS tab is edition {c.editions.CDS.replace("DSDS-HCBS-3c ", "")}; its ILW tab and the HCBS-3a are{" "}
            {c.editions.ILW.replace("DSDS-HCBS-3c ", "")}.
          </li>
          <li>
            DSDS's worksheets count every month as 31 days. Quick Schedule's month view counts each month's real days, so
            its monthly units can be lower than the worksheet's; the Worksheet view shows both and says why.
          </li>
          <li>
            The files we compared with: HCBS-3c SHA-256 <code className="break-all">{c.sha256}</code>; HCBS-3a SHA-256{" "}
            <code className="break-all">{a.sha256}</code>. A weekly check watches DSDS's pages for a new edition.
          </li>
        </ul>
        <p className="mt-4 text-ink-2">
          <Link to="/rules" className="font-semibold text-brand underline hover:text-brand-hover">See every rule and its source</Link>
        </p>
      </section>
    </div>
  );
}
