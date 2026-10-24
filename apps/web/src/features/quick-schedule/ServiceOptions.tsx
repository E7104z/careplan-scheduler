import type { RulePack, ServiceCode } from "@careplan/engine";

// QS-01: the 15-minute services, grouped the way agencies know them. Nurse visits (T1001) are
// visits, not tasks, so they are not offered.
const GROUPS: readonly { label: string; codes: readonly ServiceCode[] }[] = [
  { label: "Consumer Directed Services", codes: ["T1019U2"] },
  { label: "Independent Living Waiver", codes: ["T1019U6"] },
  { label: "Agency model", codes: ["T1019", "T1019TF"] },
  { label: "Aged and Disabled Waiver", codes: ["S5130", "S5120", "S5150", "S5150TF"] },
];

/** The `<optgroup>`s for a native service select: "<name> · <code>". */
export function ServiceOptions({ pack }: { pack: RulePack }) {
  return (
    <>
      {GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.codes.map((code) => {
            const service = pack.services.find((svc) => svc.code === code && svc.unit === "15min");
            return service ? (
              <option key={code} value={code}>
                {service.name} · {code}
              </option>
            ) : null;
          })}
        </optgroup>
      ))}
    </>
  );
}
