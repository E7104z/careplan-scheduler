#!/usr/bin/env python3
"""Recalculate DSDS's own HCBS-3c workbook with LibreOffice and record the answers.

usage: python make-golden.py <4.00appendix4da-3cform.xlsx> <output.json>

Writes Min/Day (column L), Days/Wk (column N), transportation minutes (F88) and, on the ILW tab, the
ILW service units (O96-O100) into copies of the state's workbook (formulas untouched), lets LibreOffice
recalculate them, and saves what the workbook says: every task's Total Units (Q), the transportation
units (L88), Total Units/Mo (L93), the cost (O93) and the ILW service amounts (Q96-Q100), plus the
Units/Day (M) and Units/Wk (P) text exactly as the sheet displays it.
Every whole-minute value 1-1,440 x 1-7 days is entered once on each tab, plus sparse workbooks for
blank rows, zero minutes and the ceiling boundaries.
Needs: python3, openpyxl, LibreOffice (soffice on PATH, or set SOFFICE). Not run in CI; the JSON it
writes is committed.
"""
import csv, datetime, hashlib, json, os, random, re, shutil, subprocess, sys, tempfile
import openpyxl

TABS = ['CDS', 'ILW']
TASK_ROWS = [11, 14, 17, 20, 23, 26, 29, 32, 35, 38, 41, 44, 47, 50, 53, 56, 59, 62, 65, 68, 71, 74, 77, 80, 83]
ILW_EXTRA_ROWS = [96, 97, 98, 99, 100]
EDITION_CELL = {'CDS': 'Q101', 'ILW': 'Q107'}
CSV_FILTER = 'csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,true,false,false,-1'  # every sheet, as shown

def num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None

def cents(v):
    return round(v * 100) if num(v) is not None else None

def col_index(col):
    n = 0
    for ch in col: n = n * 26 + ord(ch) - 64
    return n - 1

def tab_meta(ws):
    ref = TASK_ROWS[0]
    def norm(f, r): return re.sub(r'(?<=[A-Z])' + str(r) + r'\b', '#', f) if isinstance(f, str) else f
    for r in TASK_ROWS:  # every task row must carry the same formulas, or one model of them is wrong
        for col in 'MOPQ':
            a, b = norm(ws[f'{col}{ref}'].value, ref), norm(ws[f'{col}{r}'].value, r)
            if a != b: sys.exit(f'{ws.title} row {r} col {col} differs from row {ref}: {b!r} vs {a!r}')
    rules = [(str(rng.sqref), r) for rng, rs in ws.conditional_formatting._cf_rules.items() for r in rs]
    ceiling = [r for sq, r in rules if sq.startswith('L93') and r.type == 'cellIs' and r.operator == 'greaterThan']
    if len(ceiling) != 1: sys.exit(f'{ws.title}: expected one "greater than" rule on L93, found {len(ceiling)}')
    cost = ws['O93'].value
    m = re.fullmatch(r'=L93\*(\d+)\.(\d\d)', cost or '')
    if not m: sys.exit(f'{ws.title}: O93 is not =L93*<rate>: {cost!r}')
    meta = {
        'sheet': ws.title,
        'edition': ws[EDITION_CELL[ws.title]].value,
        'editionCell': EDITION_CELL[ws.title],
        'ceilingCell': 'L93', 'ceilingValue': int(ceiling[0].formula[0]),
        'ceilingRule': f'{ceiling[0].type} {ceiling[0].operator} {ceiling[0].formula[0]} on {[sq for sq, r in rules][0]}',
        'unitRateCents': int(m.group(1)) * 100 + int(m.group(2)),
        'labels': {str(r): ws[f'A{r}'].value for r in TASK_ROWS},
        'taskFormulas': {c: ws[f'{c}{ref}'].value for c in 'MOPQ'},
        'numberFormats': {c: ws[f'{c}{ref}'].number_format for c in 'MOPQ'},
        'formulas': {c: ws[c].value for c in ['L88', 'L93', 'O93']},
        'validations': [{'type': d.type, 'min': d.formula1, 'max': d.formula2, 'cells': str(d.sqref)} for d in ws.data_validations.dataValidation],
    }
    if ws.title == 'ILW':
        meta['ilwExtras'] = {f'Q{r}': {'label': ws[f'A{r}'].value, 'formula': ws[f'Q{r}'].value, 'numberFormat': ws[f'Q{r}'].number_format} for r in ILW_EXTRA_ROWS}
    return meta

def main():
    src, out = sys.argv[1], sys.argv[2]
    soffice = os.environ.get('SOFFICE') or shutil.which('soffice') or shutil.which('libreoffice')
    if not soffice: sys.exit('LibreOffice (soffice) not found on PATH; set SOFFICE to its path')
    base = openpyxl.load_workbook(src)
    meta = {
        'sourceFile': os.path.basename(src), 'sourceSha256': hashlib.sha256(open(src, 'rb').read()).hexdigest(),
        'soffice': subprocess.run([soffice, '--version'], capture_output=True, text=True).stdout.strip(),
        'generated': datetime.date.today().isoformat(),
        'tabs': {t: tab_meta(base[t]) for t in TABS},
        'minutesRange': [1, 1440], 'daysRange': [1, 7],
    }
    rnd = random.Random(26)
    tmp = tempfile.mkdtemp(); inp = os.path.join(tmp, 'in'); outp = os.path.join(tmp, 'out'); csvp = os.path.join(tmp, 'csv')
    for d in (inp, outp, csvp): os.makedirs(d)
    plan = []

    def save(tab, inputs):
        wb = openpyxl.load_workbook(src); ws = wb[tab]
        for r, (L, N) in inputs['rows'].items():
            if L is not None: ws[f'L{r}'] = L
            if N is not None: ws[f'N{r}'] = N
        if inputs['transportMinutes'] is not None: ws['F88'] = inputs['transportMinutes']
        for r, v in inputs.get('ilwExtras', {}).items(): ws[f'O{r}'] = v
        name = f'w{len(plan):04d}.xlsx'; wb.save(os.path.join(inp, name)); plan.append((tab, inputs, name))

    for tab in TABS:
        cases = [(L, N) for N in range(1, 8) for L in range(1, 1441)]
        rnd.shuffle(cases)
        for k in range(0, len(cases), len(TASK_ROWS)):
            inputs = {'rows': dict(zip(TASK_ROWS, cases[k:k + len(TASK_ROWS)])),
                      'transportMinutes': rnd.choice([None, rnd.randint(0, 2400), rnd.randint(0, 600)])}
            if tab == 'ILW' and rnd.random() < 0.75:
                inputs['ilwExtras'] = {r: rnd.choice([0, 1, 2, rnd.randint(0, 40)]) for r in rnd.sample(ILW_EXTRA_ROWS, rnd.randint(1, 5))}
            save(tab, inputs)
        # sparse: blank Days/Wk (row counts nothing), blank Min/Day with days (0 units), zero minutes
        for k2 in range(40):
            rows = {}
            for r in rnd.sample(TASK_ROWS, rnd.randint(1, 8)):
                rows[r] = rnd.choice([(rnd.randint(1, 480), None), (None, rnd.randint(1, 7)), (0, rnd.randint(1, 7)),
                                      (45, 3), (309, 5), (61, 7), (1, 1), (1440, 7), (rnd.randint(1, 480), rnd.randint(1, 7))])
            inputs = {'rows': rows, 'transportMinutes': rnd.choice([None, 0, 14, 15, 29, 30, 345, rnd.randint(0, 900)])}
            if tab == 'ILW': inputs['ilwExtras'] = {r: rnd.choice([0, 1, 3]) for r in rnd.sample(ILW_EXTRA_ROWS, rnd.randint(1, 5))}
            save(tab, inputs)
        # the ceiling: one 7-day task plus transportation lands exactly on it, and one unit above
        ceiling = meta['tabs'][tab]['ceilingValue']
        for total in (ceiling - 1, ceiling, ceiling + 1):
            L = (ceiling - 30) * 15 // 31; task = (L * 31 + 14) // 15
            save(tab, {'rows': {17: (L, 7)}, 'transportMinutes': (total - task) * 15})

    files = sorted(os.listdir(inp))
    for i in range(0, len(files), 100):
        subprocess.run([soffice, '--headless', '--convert-to', 'xlsx', '--outdir', outp] + [os.path.join(inp, f) for f in files[i:i + 100]], check=True, capture_output=True)
    recalc = sorted(os.listdir(outp))
    for i in range(0, len(recalc), 100):
        subprocess.run([soffice, '--headless', '--convert-to', CSV_FILTER, '--outdir', csvp] + [os.path.join(outp, f) for f in recalc[i:i + 100]], check=True, capture_output=True)

    result = {'meta': meta, 'workbooks': []}
    for tab, inputs, name in plan:
        ws = openpyxl.load_workbook(os.path.join(outp, name), data_only=True)[tab]
        with open(os.path.join(csvp, f'{name[:-5]}-{tab}.csv'), encoding='utf-8') as fh:
            shown = list(csv.reader(fh))
        def text(cell):
            col, row = re.fullmatch(r'([A-Z]+)(\d+)', cell).groups()
            line = shown[int(row) - 1] if int(row) <= len(shown) else []
            i = col_index(col)
            return line[i] if i < len(line) else ''
        rec = {'tab': tab,
               'inputs': {'rows': {str(r): list(v) for r, v in inputs['rows'].items()}, 'transportMinutes': inputs['transportMinutes']},
               'units': {str(r): num(ws[f'Q{r}'].value) for r in inputs['rows']},
               'display': {str(r): [text(f'M{r}'), text(f'P{r}')] for r in inputs['rows']},
               'transportUnits': num(ws['L88'].value), 'totalUnits': num(ws['L93'].value), 'costCents': cents(ws['O93'].value)}
        if tab == 'ILW':
            rec['inputs']['ilwExtras'] = {str(r): v for r, v in inputs.get('ilwExtras', {}).items()}
            rec['ilwExtrasCents'] = {f'Q{r}': cents(ws[f'Q{r}'].value) for r in ILW_EXTRA_ROWS}
        # a row with Days/Wk must come back with a number; a row without it must come back blank
        for r, (L, N) in inputs['rows'].items():
            if (N is None) != (rec['units'][str(r)] is None): sys.exit(f'{name}: row {r} {(L, N)} gave {rec["units"][str(r)]!r}')
        result['workbooks'].append(rec)
    counts = {'workbooks': len(result['workbooks'])}
    for tab in TABS:
        mine = [w for w in result['workbooks'] if w['tab'] == tab]
        counts[tab] = {'workbooks': len(mine), 'taskRows': sum(len(w['inputs']['rows']) for w in mine),
                       'transportCases': sum(1 for w in mine if w['inputs']['transportMinutes'] is not None)}
    meta['caseCounts'] = counts
    json.dump(result, open(out, 'w'), separators=(',', ':'))
    print(json.dumps(counts)); shutil.rmtree(tmp)

if __name__ == '__main__':
    main()
