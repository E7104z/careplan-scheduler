# State worksheet fixtures

DSDS's own workbooks, snapshotted so the engine's parity tests and rule citations point at exact
files. The SHA-256 hashes below pin each source.

| Workbook | Local file | SHA-256 |
|---|---|---|
| HCBS-3c (CDS/ILW request) | not committed; recorded in `worksheet-guidance.json` | `701aaa1287cbf8a0612e7ac99c3ddc78ff348167fac637616adc46700cb5d36e` |
| HCBS-3a (agency request) | not committed; recorded in `worksheet-guidance.json` | `b32c35e555b1ec493c1745b1ca8f5fd90237a3cd6c50ddf149b11b24629de0b8` |
| 4.00 Appendix 14a — Agency Model Scheduling Worksheet | `4.00appendix14a.xlsx` | `a10b05d10b9dc0b148a0c8ec72be140f47a9d837ce883475b0cbd684c059b968` |
| 4.00 Appendix 14b — CDS Scheduling Worksheet | `4.00appendix14b.xlsx` | `d62480a6f9668c9c321083a331f3d3c9a9e54a5a80b5cb024e48979f1b613f7a` |

The 14a/14b sheets are password-locked, but their formulas are readable straight from the file;
14a and 14b use identical formulas except one cell (below). The 14a file was last edited 2025-09-24
and the 14b file 2025-09-19 (the same day as DSDS's training video).

`hcbs14-case-01.golden.json` records the state's own numbers for one five-task care plan,
recalculated in LibreOffice headless (no engine code involved).
`packages/engine/test/stateparity-golden-14.test.ts` runs the engine on the same inputs and checks
every figure against it, and hashes the committed xlsx files to confirm they are the exact workbooks
the fixture cites.

## Known state defect

In 14a's `Example Month` sheet, `H12` is a hardcoded `0` where it should pull Thursday from task
line 5 (`='Weekly Schedule'!I11`). Any Thursday minutes on that line silently drop out of the month
view; 14b does not have the defect. The engine reproduces the correct (14b) month view.

## D7 edge case (decided Nov 25, 2026)

The weekly schedule's D7 is `COUNTA(E7:K7)`: a weekday typed as `0` counts as a scheduled day. The
engine matches this — a weekday with an entry (even 0 minutes) counts toward a task's days per week
(SCH-02), and `calculate14`'s `timesPerWeek` counts every weekday listed in `minutesByDay`, 0
included.
