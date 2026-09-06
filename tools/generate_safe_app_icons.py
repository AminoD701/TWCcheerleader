from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "app-icon-512.png"
BG = (5, 5, 5, 255)


def render(size: int, scale: float, output: str) -> None:
    source = Image.open(SOURCE).convert("RGBA")
    canvas = Image.new("RGBA", (size, size), BG)
    inner = round(size * scale)
    resized = source.resize((inner, inner), Image.Resampling.LANCZOS)
    pos = ((size - inner) // 2, (size - inner) // 2)
    canvas.alpha_composite(resized, pos)
    canvas.convert("RGB").save(ROOT / output, "PNG", optimize=True)


# iOS / normal launcher icons: new filenames also force phones to stop using the
# aggressively cached previous icon URL.
render(180, 0.82, "twc-app-icon-v3-180.png")
render(192, 0.82, "twc-app-icon-v3-192.png")
render(512, 0.82, "twc-app-icon-v3-512.png")

# Adaptive Android icons need a larger safe zone because the launcher may crop the
# source into circles, squircles or other masks.
render(512, 0.72, "twc-app-icon-maskable-v3-512.png")
