#!/usr/bin/env python3
"""Save one sheet of a state workbook as CSV, using the values Excel stored in the file (no recalculation).

usage: python sheet-to-csv.py <workbook.xlsx> <sheet name> <output.csv>

Gives a plain-text copy of what the form prints (labels, suggested times, edition stamp) that a diff can read.
Needs: python3, openpyxl. Not run in CI; the CSV it writes is committed.
"""
import csv, sys
import openpyxl

def main():
    src, sheet, out = sys.argv[1], sys.argv[2], sys.argv[3]
    ws = openpyxl.load_workbook(src, data_only=True)[sheet]
    with open(out, 'w', encoding='utf-8', newline='') as fh:
        writer = csv.writer(fh, lineterminator='\n')
        for row in ws.iter_rows(values_only=True):
            writer.writerow(['' if v is None else v for v in row])

if __name__ == '__main__':
    main()
