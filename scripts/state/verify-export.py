#!/usr/bin/env python3
"""Check the "Download as DSDS's worksheet" export against DSDS's own formulas (Phase 3, Prompt 8).

usage: python scripts/state/verify-export.py

1. Runs the export test with EXPORT_DIR set, which writes three filled copies of DSDS's workbooks (the 3c's
   CDS and ILW tabs and the 3a) and expected.json, what CarePlan Scheduler's engine calculates for them.
2. Recalculates each copy with LibreOffice and reads the workbook's own answers: Total Units/Mo (L93) and
   cost (O93) on the 3c; the Personal Care, Homemaker and APC subtotals (N30, N66, N90) and total cost
   (O122) on the 3a.
3. Fails unless every one equals the engine's.
Needs: python3, openpyxl, LibreOffice (soffice on PATH, or set SOFFICE), Node and the repo's npm install.
Not run in CI.
"""
import json, os, shutil, subprocess, sys, tempfile
import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHEETS = {'cds': 'CDS', 'ilw': 'ILW', '3a': 'HCBS-3a'}
# LibreOffice keeps an .xlsx's cached results unless told to recalculate on load (Excel follows the file's own
# fullCalcOnLoad="1"). A throwaway profile with "always recalculate" makes LibreOffice do what Excel does.
RECALC_ALWAYS = """<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item>
</oor:items>
"""

def main():
    soffice = os.environ.get('SOFFICE') or shutil.which('soffice') or shutil.which('libreoffice')
    if not soffice: sys.exit('LibreOffice (soffice) not found on PATH; set SOFFICE to its path')
    tmp = tempfile.mkdtemp(); out = os.path.join(tmp, 'out'); os.makedirs(out)
    profile = os.path.join(tmp, 'p'); os.makedirs(os.path.join(profile, 'user'))
    open(os.path.join(profile, 'user', 'registrymodifications.xcu'), 'w').write(RECALC_ALWAYS)
    profile_url = 'file:///' + profile.replace(os.sep, '/')
    env = dict(os.environ, EXPORT_DIR=tmp)
    npx = shutil.which('npx') or 'npx'
    subprocess.run([npx, 'vitest', 'run', 'test/quick/exportWorkbook.test.ts'], cwd=os.path.join(ROOT, 'apps', 'web'), env=env, check=True, capture_output=True)
    expected = json.load(open(os.path.join(tmp, 'expected.json')))
    files = [os.path.join(tmp, f'{name}.xlsx') for name in expected]
    subprocess.run([soffice, f'-env:UserInstallation={profile_url}', '--headless', '--convert-to', 'xlsx', '--outdir', out] + files, check=True, capture_output=True)
    failures = 0
    for name, cells in expected.items():
        # read_only: LibreOffice writes the 3a's "BASEMENT & ATTICS" box label unescaped in its drawing, which
        # openpyxl's full reader can't parse; the read-only reader skips drawings.
        wb = openpyxl.load_workbook(os.path.join(out, f'{name}.xlsx'), data_only=True, read_only=True)
        ws = wb[SHEETS[name]]
        for cell, want in cells.items():
            got = ws[cell].value
            if cell.startswith('O'): got = round((got or 0) * 100)  # dollars on the sheet, cents in the engine
            ok = got == want
            failures += not ok
            print(f'{name:4} {cell:5} workbook {got!r:>10}  engine {want!r:>10}  {"ok" if ok else "DIFFERENT"}')
        wb.close()
    shutil.rmtree(tmp)
    if failures: sys.exit(f'{failures} differences')
    print('verify-export: DSDS\'s workbook gives the engine\'s numbers for every exported sample')

if __name__ == '__main__':
    main()
