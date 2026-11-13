import type { RuleCatalogEntry } from "./catalog.js";

/**
 * ENGINE-SPEC section 5 rows for the CDS task rules, program compatibility and the cost cap
 * (CP4-7, CP4-8), in table order after SFC-02. Kept apart only so catalog.ts stays one screen of
 * data; RULE_CATALOG lists them in place.
 */
export const PROGRAM_RULES: readonly RuleCatalogEntry[] = [
  {
    id: "CDS-01", area: "Conflicts and eligibility", severities: ["BLOCK", "REVIEW"], status: "VERIFIED",
    rule: "A CDS task whose label is only stand-by, prompting, cueing or encouragement → BLOCK; a CDS task label that mentions one alongside another task → REVIEW (it may be a component of that task). Read only from the label the plan prints.",
    source: "Policy 3.25 (rev. Jan 2026); Policy 4.35.1 (read Nov 13, 2026)",
  },
  {
    id: "CDS-02", area: "Conflicts and eligibility", severities: ["BLOCK", "REVIEW"], status: "VERIFIED",
    rule: "A CDS task whose label is only waiting time or respite → BLOCK; a CDS task label that mentions waiting or respite alongside another task → REVIEW.",
    source: "Policy 3.25 (rev. Jan 2026)",
  },
  {
    id: "CDS-03", area: "Conflicts and eligibility", severities: ["REVIEW"], status: "PARTIAL",
    rule: "A CDS task label naming therapy, skilled or licensed care, or a physician → REVIEW: tasks a licensed professional must perform or train are excluded, and a label can't show who must.",
    source: "Policy 3.25 (rev. Jan 2026)",
  },
  {
    id: "CDS-04", area: "Conflicts and eligibility", severities: ["REVIEW"], status: "PARTIAL",
    rule: "A CDS authorization with transportation minutes → REVIEW: trips to medical appointments NEMT covers are not CDS transportation, and which trips NEMT covers isn't on the plan.",
    source: "Policy 3.25 (rev. Jan 2026)",
  },
  {
    id: "CDS-05", area: "Conflicts and eligibility", severities: ["BLOCK"], status: "VERIFIED",
    rule: "CDS on dates that overlap RCF/ALF personal care (RCF_PC, RCF_APC) on the same plan → BLOCK on the CDS authorization; the setting is known only from the plan.",
    source: "Policy 3.25 (rev. Jan 2026)",
  },
  {
    id: "PRG-01", area: "Conflicts and eligibility", severities: ["BLOCK"], status: "VERIFIED",
    rule: "A PACE enrollment the person entered that overlaps an HCBS authorization → BLOCK on each overlapping authorization. Never inferred.",
    source: "Policy 4.35.3 (rev. May 2023)",
  },
  {
    id: "PRG-02", area: "Conflicts and eligibility", severities: ["BLOCK"], status: "VERIFIED",
    rule: "An entered DD Shared Living, Residential Habilitation or Individualized Supportive Living enrollment overlapping State Plan personal care (CDS, AGENCY_PC, APC, RCF_PC, RCF_APC) → BLOCK; an entered DMH self-directed enrollment overlapping CDS or ILW → BLOCK. One result per authorization.",
    source: "Policy 4.35.1 (read Nov 13, 2026); Policy 3.25 (rev. Jan 2026)",
  },
  {
    id: "PRG-03", area: "Conflicts and eligibility", severities: ["REVIEW"], status: "PARTIAL",
    rule: "An entered DD waiver personal assistant enrollment → REVIEW: State Plan personal care must be used up before that comparable waiver service, and whether it is isn't on the plan.",
    source: "Policy 4.35.1 (read Nov 13, 2026)",
  },
  {
    id: "CAP-01", area: "Conflicts and eligibility", severities: ["REVIEW"], status: "VERIFIED",
    rule: "Agency Basic Personal Care (T1019) and CDS (T1019U2) on overlapping dates → REVIEW on each: together they may not exceed 60% of the cost maximum; APC and RN visits can take it to 100%; over 100% with an HCBS waiver needs Bureau of Federal Programs approval. The scheduler holds no costs, so this is a flag, never a balance or a block.",
    source: "HCBS Manual 4.20 (rev. Jul 2025); Policy 3.25 (rev. Jan 2026)",
  },

  // State parity (src/stateparity/rules.ts; Amendment C).
];
