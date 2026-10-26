"""Makes fusion-care-plan-report.pdf: a made-up participant in the layout of Fusion's care plan
report (the "Home & Community Based Services Care Plan" PDF), IMPORT-SPEC section 1.3.

Every name, number, address and date of birth here is invented. The layout copies a real report
seen in Oct 2026: Helvetica 12 on landscape letter, rows 26.6 pt apart, cells that wrap onto two
lines in the service row, and one wide blank text item drawn across each gap between cells (the
item that made the PDF reader join the cells with a single space).

    python docs/fixtures/fusion/make-care-plan-report.py   (needs reportlab)
"""

from pathlib import Path

from reportlab.lib.pagesizes import landscape, letter
from reportlab.pdfgen import canvas

OUT = Path(__file__).with_name("fusion-care-plan-report.pdf")
WIDTH, _ = landscape(letter)

NAME = "SAMPLE PARTICIPANT E"
DCN = "10000005"
GENERATED = "10/23/2026"
PAGES = 5
PROVIDER = ("TEST HOME CARE LLC , (555) 555-", "0100")

# Agency personal care: 13 tasks, 229 units a month by Fusion's method (IMPORT-SPEC 1.2).
TASKS = [
    ("Bathing", 45, 3),
    ("Dietary", 45, 3),
    ("Dressing/Grooming", 15, 3),
    ("Med Rel HC Tasks: Laundry (Home/Off Site)", 60, 1),
    ("Med Rel HC Tasks: Make Bed/Change Linens", 10, 3),
    ("Med Rel HC Tasks: Shop/Errands/Correspond", 90, 1),
    ("Med Rel HC Tasks: Trash", 5, 3),
    ("Mobility/Transfer/Position", 15, 3),
    ("Toileting", 15, 3),
    ("Med Rel HC Tasks: Clean Bath", 20, 1),
    ("Med Rel HC Tasks: Clean Kitchen", 20, 1),
    ("Self Admin of Meds", 5, 3),
    ("Med Rel HC Tasks: Clean Living Area", 30, 1),
]
MONTHS = [
    ("04/01/2026", "04/30/2026"), ("05/01/2026", "05/31/2026"), ("06/01/2026", "06/30/2026"),
    ("07/01/2026", "07/31/2026"), ("08/01/2026", "08/31/2026"), ("09/01/2026", "09/30/2026"),
    ("10/01/2026", "10/31/2026"), ("11/01/2026", "11/30/2026"), ("12/01/2026", "12/31/2026"),
    ("01/01/2027", "01/31/2027"),
]

ROW = 26.6
SERVICE_COLS = [42.4, 123.8, 192.1, 260.4, 556.9, 602.7, 648.4, 760.0]
MONTH_COLS = [42.4, 188.1, 333.8, 544.7, 760.0]
TASK_COLS = [42.4, 331.6, 404.6, 487.8, 580.1, 679.0, 760.0]

c = canvas.Canvas(str(OUT), pagesize=landscape(letter))
c.setTitle("Care plan")
c.setAuthor("")


def text(s, x, y, size=12, bold=False):
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.drawString(x, y, s)


def centred(s, y, size=12, bold=False):
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.drawCentredString(WIDTH / 2, y, s)


def blank(x0, x1, y, size=12):
    """One " " item from x0 to x1, as Fusion's report draws across the rest of a cell."""
    if x1 - x0 < 1:
        return
    t = c.beginText(x0, y)
    t.setFont("Helvetica", size)
    t.setWordSpace(x1 - x0 - c.stringWidth(" ", "Helvetica", size))
    t.textOut(" ")
    t.setWordSpace(0)  # word spacing is part of the graphics state: don't let it reach the next text
    c.drawText(t)


def cell(lines, x, right, y_top, bold=False):
    """A table cell: its lines from y_top down, then a blank to the cell's right edge."""
    y = y_top
    for line in lines:
        text(line, x, y, bold=bold)
        y -= 13.9
    end = x + c.stringWidth(lines[-1], "Helvetica-Bold" if bold else "Helvetica", 12)
    blank(end, right, y + 13.9)


def footer(page):
    text(f"Date Generated: {GENERATED} | Page", 302.8, 14.5, size=10)
    text(str(page), 464.1, 14.5, size=10)
    text("of", 472.4, 14.5, size=10)
    text(str(PAGES), 483.6, 14.5, size=10)


def page_header():
    centred(f"{NAME} - DCN:{DCN}", 589.6, bold=True)


def service_table(label, start, end, pa):
    cols = SERVICE_COLS
    heads = [["Service", "Type"], ["Start", "Date"], ["End Date"], ["Provider"], ["GHE", "1"], ["GHE", "2"],
             ["Prior", "Authorization"]]
    for i, head in enumerate(heads):
        cell(head, cols[i], cols[i + 1], 557.7 if len(head) == 2 else 550.6, bold=True)
    cell([label], cols[0], cols[1], 509.8)
    cell([start[:5], start[5:]], cols[1], cols[2], 516.8)
    cell([end[:5], end[5:]], cols[2], cols[3], 516.8)
    cell(list(PROVIDER), cols[3], cols[4], 516.8)
    cell(["N/A"], cols[4], cols[5], 509.8)
    cell(["N/A"], cols[5], cols[6], 509.8)
    cell([pa], cols[6], cols[7], 509.8)


def month_table(rows, code, units, y):
    for i, head in enumerate(["Start Date", "End Date", "Procedure Code", "Authorized Units"]):
        cell([head], MONTH_COLS[i], MONTH_COLS[i + 1], y, bold=True)
    for start, end in rows:
        y -= ROW
        for i, value in enumerate([start, end, code, str(units)]):
            cell([value], MONTH_COLS[i], MONTH_COLS[i + 1], y)
    return y


def task_table(rows, y):
    heads = ["Task", "#Min/Day", "#Units/Day", "#Days/Week", "#Units/Month", "Comments"]
    for i, head in enumerate(heads):
        cell([head], TASK_COLS[i], TASK_COLS[i + 1], y, bold=True)
    for values in rows:
        y -= ROW
        # Empty cells draw nothing; each blank runs on to the next cell that has text.
        filled = [(i, v) for i, v in enumerate(values) if v != ""]
        for k, (i, value) in enumerate(filled):
            right = TASK_COLS[filled[k + 1][0]] if k + 1 < len(filled) else TASK_COLS[-1]
            cell([value], TASK_COLS[i], right, y)


# Page 1: who, and the plan dates.
centred(f"Participant Information: {NAME}", 553.1, size=16, bold=True)
text("Physical Address:", 45.0, 513.9, bold=True)
for y, line in [(499.9, "100 Sample Street"), (486.1, "Apt 1"), (472.2, "Sampletown, MO 650000000")]:
    text(line, 45.0, y)
text("Primary Phone:", 45.0, 444.1, bold=True)
text("N/A", 137.1, 444.1)
text("Secondary Phone:", 45.0, 429.8, bold=True)
text("(555) 555-0101", 153.7, 429.8)
text("DCN:", 404.3, 513.9, bold=True)
text(DCN, 437.6, 513.9)
text("DOB:", 404.3, 499.6, bold=True)
text("01/01/1950", 438.3, 499.6)
text("COOP Priority:", 404.3, 485.3, bold=True)
text("2 - Medium", 492.3, 485.3)
centred("Home & Community Based Services Care Plan", 380.1, size=16, bold=True)
for y, line in [
    (339.0, "The information below lists the services you have been authorized to receive. These services are intended to help you remain in"),
    (325.2, "your home. The services will be paid for by MO HealthNet as long as you have active MO HealthNet benefits."),
    (297.4, "Each service and its unit description are listed on a separate line. The dates you are eligible to receive the service, the total"),
    (283.5, "monthly units, and the provider who is to deliver your service are also on the line. Under each service, the specific task(s) and/or"),
    (269.7, "days of the week for service delivery is shown."),
]:
    text(line, 47.3, y)
centred("Care Plan Information 04/01/2026 - 01/31/2027", 232.8, size=16, bold=True)
footer(1)
c.showPage()

# Page 2: the personal care service and its units for each month.
page_header()
service_table("PC - Agency", "04/01/2026", "01/31/2027", "20260000000005")
month_table(MONTHS, "T1019", 229, 464.6)
footer(2)
c.showPage()

# Page 3: its tasks.
page_header()
task_table([(name, str(minutes), "", str(days), "", "N/A") for name, minutes, days in TASKS], 557.7)
footer(3)
c.showPage()

# Pages 4 and 5: General Health Evaluations, a nurse visit (not scheduled by Quick Schedule).
for page, (start, end, pa) in [(4, ("11/01/2026", "11/30/2026", "20260000000006")),
                               (5, ("05/01/2026", "05/31/2026", "20260000000007"))]:
    page_header()
    service_table("GHE", start, end, pa)
    y = month_table([(start, end)], "T1001", 1, 464.6)
    task_table([("General Health Evaluation", "", "", "", "1", "N/A")], y - ROW - 10)
    footer(page)
    c.showPage()

c.save()
print(f"wrote {OUT}")
