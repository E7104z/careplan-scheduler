import { lazy, Suspense, type ComponentProps } from "react";

// The dated side of Quick Schedule (Coverage Phase 3 on) is one chunk, `extras.ts`, loaded with
// import() the first time one of its panels is shown. These are the slots the page puts them in:
// each renders nothing until the chunk arrives, so the page works without it.
const Visits = lazy(() => import("./extras").then((extras) => ({ default: extras.VisitsPanel })));
const Placing = lazy(() => import("./extras").then((extras) => ({ default: extras.OtherPlacing })));
const Amendments = lazy(() => import("./extras").then((extras) => ({ default: extras.AmendmentsPanel })));
const Calendar = lazy(() => import("./extras").then((extras) => ({ default: extras.ParticipantCalendar })));
const Times = lazy(() => import("./extras").then((extras) => ({ default: extras.VisitTimes })));
const Checks = lazy(() => import("./extras").then((extras) => ({ default: extras.PlanChecks })));
const Caregivers = lazy(() => import("./extras").then((extras) => ({ default: extras.CaregiversPanel })));
const Waivers = lazy(() => import("./extras").then((extras) => ({ default: extras.WaiversPanel })));
const Coverage = lazy(() => import("./extras").then((extras) => ({ default: extras.CoverageBlocks })));

export function VisitsSlot(props: ComponentProps<typeof Visits>) {
  return (
    <Suspense fallback={null}>
      <Visits {...props} />
    </Suspense>
  );
}

export function OtherPlacingSlot(props: ComponentProps<typeof Placing>) {
  return (
    <Suspense fallback={null}>
      <Placing {...props} />
    </Suspense>
  );
}

export function AmendmentsSlot(props: ComponentProps<typeof Amendments>) {
  return (
    <Suspense fallback={null}>
      <Amendments {...props} />
    </Suspense>
  );
}

export function CalendarSlot(props: ComponentProps<typeof Calendar>) {
  return (
    <Suspense fallback={null}>
      <Calendar {...props} />
    </Suspense>
  );
}

export function VisitTimesSlot(props: ComponentProps<typeof Times>) {
  return (
    <Suspense fallback={null}>
      <Times {...props} />
    </Suspense>
  );
}

export function PlanChecksSlot(props: ComponentProps<typeof Checks>) {
  return (
    <Suspense fallback={null}>
      <Checks {...props} />
    </Suspense>
  );
}

export function CaregiversSlot(props: ComponentProps<typeof Caregivers>) {
  return (
    <Suspense fallback={null}>
      <Caregivers {...props} />
    </Suspense>
  );
}

export function WaiversSlot(props: ComponentProps<typeof Waivers>) {
  return (
    <Suspense fallback={null}>
      <Waivers {...props} />
    </Suspense>
  );
}

export function CoverageBlocksSlot(props: ComponentProps<typeof Coverage>) {
  return (
    <Suspense fallback={null}>
      <Coverage {...props} />
    </Suspense>
  );
}
