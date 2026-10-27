# State worksheet files

DSDS's own worksheet workbooks, and the files made from them, that Phase 3's tests compare
CarePlan Scheduler with. The two workbooks were downloaded from health.mo.gov on Oct 27, 2026 and
are unchanged. Git keeps every file here byte for byte (`.gitattributes`), and
`packages/engine/test/ledger.test.ts` checks each SHA-256 below against the file.

| File | Where it came from | SHA-256 | Edition printed inside |
|---|---|---|---|
| `4.00appendix4da-3cform.xlsx` | HCBS-3c, https://health.mo.gov/sites/health/files/2026-10/4.00appendix4da-3cform_0.xlsx (saved without the `_0`) | `701aaa1287cbf8a0612e7ac99c3ddc78ff348167fac637616adc46700cb5d36e` | DSDS-HCBS-3c (10/26) on the CDS tab (Q101); DSDS-HCBS-3c (07/26) on the ILW tab (Q107) |
| `4.00appendix3da3aform.xlsx` | HCBS-3a, https://health.mo.gov/sites/health/files/2026-07/4.00appendix3da3aform.xlsx | `b32c35e555b1ec493c1745b1ca8f5fd90237a3cd6c50ddf149b11b24629de0b8` | DSDS-HCBS-3a (07/26) (O129) |
| `hcbs3a-in-home-services-worksheet.csv` | The 3a saved as CSV: the HCBS-3a sheet's stored values, written by `scripts/state/sheet-to-csv.py` | `a575077798eff9c267a092612181dbc9c43627b803bfc479e98f981c11f2298f` | DSDS-HCBS-3a (07/26) |
| `hcbs3c-golden.json` | DSDS's 3c workbook recalculated by LibreOffice 24.2.7.2 (894 workbooks: 10,242 CDS and 10,269 ILW task rows, every whole minute 1–1,440 × 1–7 days on each tab, plus transportation, ILW service lines, blank rows and the 641/868 boundaries), written by `scripts/state/make-golden.py` | `6b2a6c395888a69961ec6c2665492f4c9f0a04748747c0d415c7a77b2e610d83` | DSDS-HCBS-3c (10/26) and (07/26) (`meta.tabs.*.edition`) |
| `hcbs3a-golden.json` | DSDS's 3a workbook recalculated by LibreOffice 24.2.7.2 (508 workbooks, 10,811 task rows), written by `scripts/state/make-golden-3a.py` | `e8c38276c278b39266c55cf27e3750f49a730a4b0a651a97064cb53c7f90d615` | DSDS-HCBS-3a (07/26) (`meta.edition`) |
| `worksheet-guidance.json` | Suggested times, frequencies, row labels and editions read from both workbooks, and the 3a's checkboxes and rate sheet (rates, fills and colour legend), by `scripts/state/extract-guidance.py` | `437736fde24f5285e89c51bc8f1f52593b2f894b2c86f302f0579751e52ddacb` | DSDS-HCBS-3c (10/26), DSDS-HCBS-3c (07/26), DSDS-HCBS-3a (07/26) |
| `pages/manual-hcbs3c-cds-worksheet.txt` | Text of HCBS Manual 4.00 Appendix 4, https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/400-home-and-community-based-services-11, read Oct 27, 2026 (page body only) | `b4e3037c940c0dad9be28fdc25f30e5a0d2d61da0dfceae08362e2aa7777d501` | Revised - July 2026 |
| `pages/manual-hcbs3a-in-home-services-worksheet.txt` | Text of HCBS Manual 4.00 Appendix 3, https://health.mo.gov/providers/manuals/home-and-community-based-services-manual/400-home-and-community-based-services-10, read Oct 27, 2026 (page body only) | `01438944b3b48c0f65e868c10c4bdc3f635e7fee98258512df0443a685dbc7e2` | Revised - May 2025 |
| `pages/manual-hcbs3c-cds-worksheet.html` | The same page (4.00 Appendix 4) saved whole, Oct 27, 2026, for `scripts/state/watch.mjs --self-test` | `286957d0d8e0627c6050b3e76849c1041107dfd4a732a30bb3a07549bca36bf6` | Revised - July 2026 |
| `pages/manual-hcbs3a-in-home-services-worksheet.html` | The same page (4.00 Appendix 3) saved whole, Oct 27, 2026, for `scripts/state/watch.mjs --self-test` | `5bafeb62ad21a7b474a62c50d150aac9aac4deae8a334817893e1653c029e135` | Revised - May 2025 |

## The weekly watch

`.github/workflows/state-forms-watch.yml` runs `scripts/state/watch.mjs` every Monday: it reads both manual pages,
downloads every `.xlsx` they link and compares its URL and SHA-256 with the table above. A difference opens (or
adds to) one issue, "DSDS changed a worksheet". `node scripts/state/watch.mjs` runs the same check locally.

## Copies the web app serves

`apps/web/public/state/` holds unchanged copies of the two workbooks, for "Download as DSDS's worksheet (.xlsx)"
(Phase 3, Prompt 8). The app writes only DSDS's unlocked input cells into a copy and sets `fullCalcOnLoad`, so Excel
recalculates every formula when the file opens. `apps/web/test/quick/exportWorkbook.test.ts` checks the copies'
SHA-256 against this table and checks that an export changes nothing but those cells.
`python scripts/state/verify-export.py` (needs LibreOffice; not in CI) recalculates three exported samples and
checks DSDS's totals and costs against the engine's.

## Remaking the generated files

Each script says what it needs at the top. None runs in CI. On Windows with long paths off, give
LibreOffice a short profile path, or it exits without converting anything:
`UserInstallation=file:///C:/Users/<you>/AppData/Local/Temp/lop` in the environment (and put LibreOffice's
`program` folder at the end of `PATH`, after Python, since it has its own `python.exe`).

- `python scripts/state/make-golden.py docs/fixtures/state/4.00appendix4da-3cform.xlsx docs/fixtures/state/hcbs3c-golden.json` (needs LibreOffice)
- `python scripts/state/make-golden-3a.py docs/fixtures/state/4.00appendix3da3aform.xlsx docs/fixtures/state/hcbs3a-golden.json` (needs LibreOffice)
- `python scripts/state/extract-guidance.py docs/fixtures/state/4.00appendix4da-3cform.xlsx docs/fixtures/state/4.00appendix3da3aform.xlsx docs/fixtures/state/worksheet-guidance.json`
- `python scripts/state/sheet-to-csv.py docs/fixtures/state/4.00appendix3da3aform.xlsx HCBS-3a docs/fixtures/state/hcbs3a-in-home-services-worksheet.csv`

`scripts/state/reference-model-3a.py` is an independent model of the 3a's formulas; it matches every
case in `hcbs3a-golden.json`. After remaking a file, update its SHA-256 here.
