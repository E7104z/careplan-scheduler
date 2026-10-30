#!/usr/bin/env python3
"""Recalculate DSDS's own HCBS-3a workbook with LibreOffice and record the answers.

usage: python make-golden-3a.py <4.00appendix3da3aform.xlsx> <output.json>

Writes inputs into the state's workbook (formulas untouched), including the four linked checkbox cells on
Sheet2 (H9 personal care RCF/ALF, H10 APC RCF/ALF, H11 nurse RCF/ALF, L2 Medically Related Household),
lets LibreOffice recalculate, and saves what the workbook says. Also reads the rate table from Sheet2.
Needs: python3, openpyxl, LibreOffice. Not run in CI; the JSON it writes is committed.
"""
import datetime, hashlib, json, os, random, re, shutil, subprocess, sys, tempfile
import openpyxl

SH = 'HCBS-3a'
PC = [11, 14, 17, 20, 23, 26]
HM = [33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63]
APC = [69, 72, 75, 78, 81, 84, 87]
RESP = [100, 103]
ADC = [109, 112]
CHORE = [119]
TASK_ROWS = PC + HM + APC + RESP + ADC + CHORE            # 29 rows with the standard formula set
COST_CELLS = ['O30', 'O66', 'O90', 'O96', 'O100', 'O103', 'O106', 'O109', 'O112', 'O115', 'O119', 'O122']
UNIT_CELLS = ['N29', 'N30', 'N66', 'N90', 'N106', 'N115']

def num(v):
    return v if isinstance(v, (int, float)) else None

def main():
    src, out = sys.argv[1], sys.argv[2]
    soffice = shutil.which('soffice') or shutil.which('libreoffice')
    if not soffice: sys.exit('LibreOffice (soffice) not found on PATH')
    base = openpyxl.load_workbook(src)
    ws0, s2 = base[SH], base['Sheet2']
    # every task row must carry the same formula set, or the single model used below is wrong
    ref = TASK_ROWS[0]
    def norm(f, r): return re.sub(r'[()]', '', re.sub(r'(?<=[A-Z])' + str(r) + r'\b', '#', f)) if isinstance(f, str) else f  # row 11 has harmless extra parentheses
    for r in TASK_ROWS:
        for col in 'IKLMN':
            a, b = norm(ws0[f'{col}{ref}'].value, ref), norm(ws0[f'{col}{r}'].value, r)
            if a != b: sys.exit(f'row {r} col {col} differs from row {ref}: {b!r} vs {a!r}')
    rate_formulas = {c: s2[c].value for c in ('I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'I9', 'I10', 'I11', 'I12', 'I13', 'I14')}
    meta = {
        'sourceFile': os.path.basename(src), 'sourceSha256': hashlib.sha256(open(src, 'rb').read()).hexdigest(),
        'edition': ws0['O129'].value, 'soffice': subprocess.run([soffice, '--version'], capture_output=True, text=True).stdout.strip(),
        'generated': datetime.date.today().isoformat(),
        'rateCells': rate_formulas,
        'taskFormulas': {c: ws0[f'{c}{ref}'].value for c in 'IKLMN'},
        'formulas': {c: ws0[c].value for c in ['N29', 'N30', 'O30', 'N66', 'O66', 'N90', 'O90', 'O96', 'O100', 'O103', 'N106', 'O106', 'O109', 'O112', 'N115', 'O115', 'O119', 'O122']},
        'linkedCheckboxes': {'H9': 'Personal Care RCF/ALF', 'H10': 'Advanced Personal Care RCF/ALF', 'H11': 'Nurse Visits RCF/ALF', 'L2': 'Medically Related Household tasks'},
        'validations': [{'type': d.type, 'min': d.formula1, 'max': d.formula2, 'cells': str(d.sqref)} for d in ws0.data_validations.dataValidation if d.type == 'whole'],
        'conditionalFormatting': len(ws0.conditional_formatting._cf_rules),
    }
    rnd = random.Random(26)
    cases = [(L, N) for N in range(1, 8) for L in range(1, 1441)]
    rnd.shuffle(cases)
    chunks = [cases[i:i + len(TASK_ROWS)] for i in range(0, len(cases), len(TASK_ROWS))]
    hdm_cases = [(u, d) for d in range(1, 8) for u in range(1, 21)]
    tmp = tempfile.mkdtemp(); inp = os.path.join(tmp, 'in'); outp = os.path.join(tmp, 'out'); os.makedirs(inp); os.makedirs(outp)
    plan = []
    for k, ch in enumerate(chunks):
        wb = openpyxl.load_workbook(src); ws = wb[SH]; sh2 = wb['Sheet2']
        inputs = {'rows': {}, 'flags': {}}
        for r, (L, N) in zip(TASK_ROWS, ch):
            ws[f'G{r}'] = L; ws[f'J{r}'] = N; inputs['rows'][r] = [L, N]
        flags = {c: bool(rnd.getrandbits(1)) for c in ('H9', 'H10', 'H11', 'L2')}
        if k % 4 == 0: flags = {c: False for c in flags}
        for c, v in flags.items(): sh2[c] = v
        inputs['flags'] = flags
        if k < len(hdm_cases):
            u, d = hdm_cases[k]; ws['I106'] = u; ws['J106'] = d; inputs['hdm'] = [u, d]
        inputs['nurseVisits'] = rnd.randint(0, 31) if k % 2 == 0 else None
        if inputs['nurseVisits'] is not None: ws['N96'] = inputs['nurseVisits']
        name = f'w{k}.xlsx'; wb.save(os.path.join(inp, name)); plan.append((k, inputs, name))
    # sparse scenarios: a handful of tasks, every flag combination, boundary values
    for k2 in range(160):
        k = len(chunks) + k2
        wb = openpyxl.load_workbook(src); ws = wb[SH]; sh2 = wb['Sheet2']
        inputs = {'rows': {}, 'flags': {}}
        for r in rnd.sample(TASK_ROWS, rnd.randint(1, 8)):
            L, N = rnd.choice([(15, 1), (30, 7), (45, 3), (60, 5), (10, 7), (309, 5), (1440, 7), (1, 1), (600, 5), (7, 3)] + [(rnd.randint(1, 480), rnd.randint(1, 7))])
            ws[f'G{r}'] = L; ws[f'J{r}'] = N; inputs['rows'][r] = [L, N]
        flags = {c: bool((k2 >> i) & 1) for i, c in enumerate(('H9', 'H10', 'H11', 'L2'))}
        for c, v in flags.items(): sh2[c] = v
        inputs['flags'] = flags
        if k2 % 3 == 0: ws['I106'] = rnd.randint(1, 2); ws['J106'] = rnd.randint(1, 7); inputs['hdm'] = [ws['I106'].value, ws['J106'].value]
        inputs['nurseVisits'] = rnd.randint(0, 9) if k2 % 2 else None
        if inputs['nurseVisits'] is not None: ws['N96'] = inputs['nurseVisits']
        name = f'w{k}.xlsx'; wb.save(os.path.join(inp, name)); plan.append((k, inputs, name))
    files = sorted(os.listdir(inp))
    for i in range(0, len(files), 100):
        subprocess.run([soffice, '--headless', '--convert-to', 'xlsx', '--outdir', outp] + [os.path.join(inp, f) for f in files[i:i + 100]], check=True, capture_output=True)
    result = {'meta': meta, 'workbooks': []}
    for k, inputs, name in plan:
        ws = openpyxl.load_workbook(os.path.join(outp, name), data_only=True)[SH]
        rec = {'inputs': inputs, 'units': {str(r): num(ws[f'N{r}'].value) for r in TASK_ROWS}}
        rec['units'].update({c: num(ws[c].value) for c in UNIT_CELLS})
        rec['costCents'] = {c: (round(ws[c].value * 100) if isinstance(ws[c].value, (int, float)) else None) for c in COST_CELLS}
        # a task row the workbook left blank must come back blank, not 0
        for r in TASK_ROWS:
            if str(r) in map(str, inputs['rows']) and rec['units'][str(r)] is None: sys.exit(f'{name}: row {r} blank')
        result['workbooks'].append(rec)
    meta['caseCounts'] = {'taskRows': sum(len(w['inputs']['rows']) for w in result['workbooks']), 'workbooks': len(result['workbooks'])}
    json.dump(result, open(out, 'w'), separators=(',', ':'))
    print(meta['caseCounts']); shutil.rmtree(tmp)

if __name__ == '__main__':
    main()
