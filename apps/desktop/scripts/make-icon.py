"""Draw apps/desktop/assets/icon.ico from the CarePlan Scheduler logo (apps/web/src/ui/Logo.tsx).

The logo is a 32-unit mark: three filled rounded squares and one outlined, in the Signature blue
(--brand in tokens.css). The icon puts it on a white rounded tile so it stays visible on a dark
taskbar. Each size is drawn at 1024 px and scaled down, so the small ones stay sharp.

    python apps/desktop/scripts/make-icon.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

BRAND = (0x26, 0x34, 0x8C, 255)
WHITE = (0xFF, 0xFF, 0xFF, 255)
CANVAS = 1024
SIZES = [256, 128, 64, 48, 32, 24, 16]
OUT = Path(__file__).resolve().parent.parent / "assets" / "icon.ico"


def draw_master() -> Image.Image:
    image = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, CANVAS - 1, CANVAS - 1), radius=224, fill=WHITE)

    unit = CANVAS * 0.75 / 32  # the 32-unit mark fills three quarters of the tile
    offset = (CANVAS - 32 * unit) / 2

    def box(x0: float, y0: float, x1: float, y1: float) -> tuple[float, float, float, float]:
        return (offset + x0 * unit, offset + y0 * unit, offset + x1 * unit, offset + y1 * unit)

    # <rect x y width=13 height=13 rx=2 /> three times, filled.
    for x, y in [(2, 2), (17, 2), (2, 17)]:
        draw.rounded_rectangle(box(x, y, x + 13, y + 13), radius=2 * unit, fill=BRAND)
    # The fourth, outlined: stroke 2 centred on the edge, so 1 unit outside to 1 unit inside.
    draw.rounded_rectangle(box(16, 16, 31, 31), radius=3 * unit, outline=BRAND, width=round(2 * unit))
    return image


def main() -> None:
    master = draw_master()
    images = [master.resize((size, size), Image.LANCZOS) for size in SIZES]
    images[0].save(OUT, format="ICO", sizes=[(size, size) for size in SIZES], append_images=images[1:])
    print(f"wrote {OUT} ({', '.join(str(size) for size in SIZES)} px)")


if __name__ == "__main__":
    main()
