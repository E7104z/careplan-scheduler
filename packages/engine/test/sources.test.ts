import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// FIX-7: @source citations from the approved v0.3 specification, one per rule.
const SOURCES: Record<string, string> = {
  "AUTH-03": "HCBS-3c (10/26) cell Q11; DHSS 4.00 Appendix 14a/14b cell M7",
  "AUTH-05": "INFO 05-25-03 (May 9, 2025); Fusion FAQ (Jun 4, 2025); DHSS 14a/14b cell D37",
  "AUTH-06": "INFO 05-25-03 (May 9, 2025)",
  "AUTH-07": "Product decision approved Oct 20, 2026 (P-02)",
  "AUTH-08": "Policy 3.25 (01/26); HCBS-3c cell L88",
  "AUTH-09": "3.00 Appendix 1 (rev. Jul 2026); Policy 3.50 (rev. Jul 2026); HCBS 06-26-01",
  "AUTH-11": "Policy 3.55 (01/26)",
  "AUTH-12": "Policy 3.55 (01/26); 3.00 Appendix 1 (rev. Jul 2026)",
  "AUTH-13": "Product decision approved Oct 20, 2026 (P-06)",
  "SCH-02": "INFO 09-25-02 (Sep 23, 2025); DHSS 14a/14b cell D7; 13 CSR 70-91.010(3)(H)2",
  "SCH-03": "Product decision approved Oct 20, 2026; DHSS 14a/14b weekly grid",
  "SCH-08": "DHSS 14a/14b \"Example Month\" sheet; 13 CSR 70-91.010(1)(B)2; LTSS email Nov 24, 2026",
  "SCH-11": "INFO 09-25-02 (Sep 23, 2025); CDS policy clarification Q9; two-month trigger is a product heuristic",
  "SCH-12": "Product decision approved Oct 20, 2026",
  "SCH-14": "Product decision approved Oct 20, 2026; Policy 3.55 (pending BFP approval)",
  "SCH-15": "Product decision approved Oct 20, 2026",
  "AMEND-01": "HCBS Manual 4.20 (care plan amendments: decreases effective the first of a later month, increases may take effect mid-month, participant-requested reductions immediate)",
  "EVT-01": "The authorization's own dates and months as Fusion prints them; product decision Nov 13, 2026",
  "EVT-02": "Fusion's authorized quantity for the month; 3.00 Appendix 1 (rev. Jul 2026) units and limits",
  "EVT-03": "3.00 Appendix 1 (rev. Jul 2026); Missouri coverage audit section 10, decision 2, and PR #10 (Oct 31, 2026)",
  "NUR-01": "HCBS Manual 4.00 Appendix 3 (rev. May 2025), Advanced Personal Care, as reviewed Oct 31, 2026; DHSS has not confirmed the first-month visit count",
  "NUR-02": "Missouri coverage audit RN-04 (missed general health evaluation follow-up); the follow-up wording is a product decision, Nov 13, 2026",
  "CON-01": "CDS policy clarification Q5",
  "CON-02": "CDS policy clarification Q5; Policy 3.50 (rev. Jul 2026)",
  "CON-03": "Policy 3.50 (rev. Jul 2026)",
  "CON-04": "Product decision approved Oct 20, 2026",
  "CON-05": "FLSA; product decision approved Oct 20, 2026",
  "CON-06": "Policy 3.25 (01/26)",
  "CON-07": "Policy 3.05 (04/25); Policy 3.10 (03/25); Policy 3.20 (rev. Mar 2026); Policy 3.45 (Nov 2021); Policy 3.50 (rev. Jul 2026)",
  "CON-09": "HCBS 06-26-01; Policy 3.50 (rev. Jul 2026); which seven days make the week is open (audit E-02)",
  "CON-10": "Policy 3.15 (04/26) as updated by HCBS 08-26-01; 3.00 Appendix 1 (rev. Jul 2026)",
  "CON-13": "13 CSR 70-91.010(1)(B)1; CDS policy clarification Q2",
  "CON-16": "Policy 3.05 (04/25)",
  "CON-17": "Policies 3.05, 3.10, 3.15, 3.25; Policy 3.55 (FCSR registration)",
  "SFC-01": "Policy 3.60 (rev. Jul 2026); HCBS 01-26-01 (Jan 20, 2026); Appendix 2g (rev. Jun 2026)",
  "SFC-02": "Policy 3.60 (rev. Jul 2026); Appendix 2g (rev. Jun 2026)",
  "CDS-01": "Policy 3.25 (rev. Jan 2026); Policy 4.35.1 (read Nov 13, 2026)",
  "CDS-02": "Policy 3.25 (rev. Jan 2026)",
  "CDS-03": "Policy 3.25 (rev. Jan 2026)",
  "CDS-04": "Policy 3.25 (rev. Jan 2026)",
  "CDS-05": "Policy 3.25 (rev. Jan 2026)",
  "PRG-01": "Policy 4.35.3 (rev. May 2023)",
  "PRG-02": "Policy 4.35.1 (read Nov 13, 2026); Policy 3.25 (rev. Jan 2026)",
  "PRG-03": "Policy 4.35.1 (read Nov 13, 2026)",
  "CAP-01": "HCBS Manual 4.20 (rev. Jul 2025); Policy 3.25 (rev. Jan 2026)",
  // Amendment C: worksheet rules (src/stateparity/rules.ts).
  "WS-R01": "HCBS-3c (10/26) and HCBS-3a (07/26) suggested time columns",
  "WS-R02": "HCBS Manual 4.00 Appendix 4 (rev. Jul 2026) and Appendix 3 (rev. May 2025): Description of Needs is required for ILW requests",
  "WS-R03": "HCBS Manual 4.00 Appendix 4 (rev. Jul 2026)",
  "WS-R04": "HCBS Manual 4.00 Appendix 3 (rev. May 2025), Advanced Personal Care",
  "WS-R05": "HCBS Manual 4.00 Appendix 3 (rev. May 2025), Advanced Personal Care",
  "WS-R06": "HCBS Manual 4.00 Appendix 3 (rev. May 2025), Authorized Nurse Visits and Comments",
  "WS-R07": "HCBS Manual 4.00 Appendix 3 (rev. May 2025), Authorized Nurse Visits",
  "WS-R08": "HCBS Manual 4.00 Appendix 3 (rev. May 2025), Adult Day Care",
  "WS-R09": "HCBS-3a (07/26) rate sheet cell G14: \"Max 2/day\"",
};

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

// Every rule file, plus the files that implement AUTH-13 (validate.ts) and SCH-15 (time.ts), and
// the worksheet rules (Amendment C).
const FILES = [
  ...readdirSync(`${SRC}rules`).map((name) => `rules/${name}`),
  "validate.ts",
  "calendar/time.ts",
  "stateparity/rules.ts",
];

const BLOCKS = FILES.flatMap((file) => readFileSync(`${SRC}${file}`, "utf8").match(/\/\*\*[\s\S]*?\*\//g) ?? []);

function citations(block: string): string[] {
  return [...block.matchAll(/@source (.+)/g)].map((match) => match[1]!.trimEnd());
}

describe("FIX-7 rule @source tags match the approved v0.3 specification", () => {
  for (const [ruleId, source] of Object.entries(SOURCES)) {
    it(`${ruleId} cites its approved source`, () => {
      const tagged = BLOCKS.filter((block) => new RegExp(`@rule ${ruleId}\\b`).test(block));
      expect(tagged.length).toBeGreaterThan(0);
      for (const block of tagged) {
        expect(citations(block)).toEqual([source]);
      }
    });
  }

  it("every @rule tag has an approved source listed", () => {
    const tagged = BLOCKS.flatMap((block) => [...block.matchAll(/@rule (\S+)/g)].map((match) => match[1]!));
    expect(tagged.filter((ruleId) => !(ruleId in SOURCES))).toEqual([]);
  });
});
