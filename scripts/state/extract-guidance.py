#!/usr/bin/env python3
"""Read DSDS's suggested times and frequencies, row labels and editions from the two state worksheets.

usage: python extract-guidance.py <4.00appendix4da-3cform.xlsx> <4.00appendix3da3aform.xlsx> <output.json>

Copies what the workbooks print, in their order: for each 3c tab (CDS, ILW) the task rows and Essential
Transportation; for the 3a the Personal Care, Homemaker and Advanced Personal Care task rows and the
other service rows. `raw` is the cell text exactly; `label` is the same text with line breaks and
repeated spaces collapsed. `minLow`/`minHigh` are read from a suggested time of the form "N MIN" or
"N-M MIN" (null otherwise); `perWeekLow`/`perWeekHigh` from a frequency "N X WK" or "N-M X WK".
For the 3a it also records every checkbox (the cell its top-left corner sits in, the cell it is linked
to, and its printed label) and the rate sheet's rows (Sheet2 F:I), because they decide what the 3a's
calculation reads.
Needs: python3, openpyxl. Not run in CI; the JSON it writes is committed.
"""
import datetime, hashlib, html, json, os, re, sys, zipfile
import openpyxl
from openpyxl.styles.colors import COLOR_INDEX
from openpyxl.utils import get_column_letter

C_ROWS = [11, 14, 17, 20, 23, 26, 29, 32, 35, 38, 41, 44, 47, 50, 53, 56, 59, 62, 65, 68, 71, 74, 77, 80, 83, 86]
C_EDITION = {'CDS': 'Q101', 'ILW': 'Q107'}
A_SECTIONS = [('PERSONAL CARE', 'A10', [11, 14, 17, 20, 23, 26, 29]),
              ('HOMEMAKER', 'A32', [33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63]),
              ('ADVANCED PERSONAL CARE', 'A68', [69, 72, 75, 78, 81, 84, 87])]
A_SERVICES = [('A92', 96), ('B100', 100), ('B103', 103), ('A106', 106), ('A109', 109), ('A112', 112), ('A115', 119)]

def clean(text):
    return re.sub(r'\s+', ' ', text).strip() if isinstance(text, str) else None

def minutes(time):
    m = re.fullmatch(r'(\d+)(?:\s*-\s*(\d+))?\s*MIN', clean(time) or '', re.I)
    return (int(m.group(1)), int(m.group(2) or m.group(1))) if m else (None, None)

def per_week(freq):
    m = re.fullmatch(r'(\d+)(?:\s*-\s*(\d+))?\s*X\s*WK', clean(freq) or '', re.I)
    return (int(m.group(1)), int(m.group(2) or m.group(1))) if m else (None, None)

def row(ws, r, label_col, time_col, freq_col):
    raw, time, freq = ws[f'{label_col}{r}'].value, ws[f'{time_col}{r}'].value, ws[f'{freq_col}{r}'].value
    lo, hi = minutes(time); wlo, whi = per_week(freq)
    return {'row': r, 'raw': raw, 'label': clean(raw), 'time': clean(time), 'freq': clean(freq),
            'minLow': lo, 'minHigh': hi, 'perWeekLow': wlo, 'perWeekHigh': whi}

def checkboxes(path):
    """Form-control checkboxes from the 3a's drawing: top-left cell, linked cell and label, in sheet order."""
    boxes = []
    with zipfile.ZipFile(path) as z:
        for name in sorted(n for n in z.namelist() if n.endswith('.vml')):
            for shape in re.findall(r'<v:shape .*?</v:shape>', z.read(name).decode('utf-8'), re.S):
                if 'ObjectType="Checkbox"' not in shape: continue
                anchor = [int(v) for v in re.search(r'<x:Anchor>([^<]*)', shape).group(1).split(',')]
                text = re.search(r'<v:textbox.*?</v:textbox>', shape, re.S)
                label = clean(html.unescape(re.sub(r'<[^>]+>', '', text.group(0)))) if text else None
                link = re.search(r'<x:FmlaLink>([^<]*)', shape)
                boxes.append({'cell': f'{get_column_letter(anchor[0] + 1)}{anchor[2] + 1}', 'linkedCell': link.group(1).replace('$', '') if link else None, 'label': label or None})
    return sorted(boxes, key=lambda b: (int(re.sub(r'\D', '', b['cell'])), b['cell']))

def fill(cell):
    """A cell's solid fill as text: RGB hex (alpha dropped), or theme N with its tint; None when unfilled."""
    f = cell.fill
    if f.fill_type != 'solid': return None
    c = f.fgColor
    if c.type == 'rgb': return c.rgb[-6:]
    if c.type == 'indexed': return COLOR_INDEX[c.indexed][-6:]
    return f'theme {c.theme} tint {round(c.tint, 2)}'

def rate_sheet(ws):
    """Sheet2's rate rows (F service, G note, I rate or formula, with I's fill) and its colour legend (G16:H18)."""
    rows = [{'row': r, 'service': clean(ws[f'F{r}'].value), 'note': clean(ws[f'G{r}'].value), 'rate': ws[f'I{r}'].value,
             'fill': fill(ws[f'I{r}'])} for r in range(3, 15)]
    legend = [{'fill': fill(ws[f'G{r}']), 'meaning': clean(ws[f'H{r}'].value)} for r in range(16, 19)]
    return {'rows': rows, 'legend': legend}

def main():
    c_src, a_src, out = sys.argv[1], sys.argv[2], sys.argv[3]
    c, a = openpyxl.load_workbook(c_src), openpyxl.load_workbook(a_src)
    sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
    result = {
        'meta': {'generated': datetime.date.today().isoformat(),
                 '3c': {'sourceFile': os.path.basename(c_src), 'sourceSha256': sha(c_src)},
                 '3a': {'sourceFile': os.path.basename(a_src), 'sourceSha256': sha(a_src)}},
        '3c': {}, '3a': {},
    }
    for tab in ('CDS', 'ILW'):
        ws = c[tab]
        if (ws['F10'].value, ws['I10'].value) != ('SUGGESTED TIME', 'SUGGESTED FREQ'): sys.exit(f'{tab}: columns moved')
        result['3c'][tab] = {'edition': ws[C_EDITION[tab]].value, 'editionCell': C_EDITION[tab],
                             'tasks': [row(ws, r, 'A', 'F', 'I') for r in C_ROWS]}
    ws = a['HCBS-3a']
    if (ws['D9'].value, ws['E9'].value) != ('SUGGESTED TIME', 'SUGGESTED FREQ'): sys.exit('3a: columns moved')
    result['3a'] = {
        'edition': ws['O129'].value, 'editionCell': 'O129', 'footnote': clean(ws['A122'].value),
        'sections': [{'name': clean(ws[head].value), 'rows': [row(ws, r, 'B', 'D', 'E') for r in rows]} for _, head, rows in A_SECTIONS],
        'services': [{'row': r, 'label': clean(ws[cell].value)} for cell, r in A_SERVICES],
        'checkboxes': checkboxes(a_src),
        'rateSheet': rate_sheet(a['Sheet2']),
    }
    for name, head, _ in A_SECTIONS:
        if clean(ws[head].value) != name: sys.exit(f'3a: {head} is {ws[head].value!r}, expected {name}')
    with open(out, 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(result, fh, indent=1, ensure_ascii=False); fh.write('\n')

if __name__ == '__main__':
    main()
