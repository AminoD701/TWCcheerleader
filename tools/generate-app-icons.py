from pathlib import Path
import math, struct, zlib

ROOT = Path(__file__).resolve().parents[1]
GRAPHITE = (17, 20, 24, 255)
SILVER = (244, 245, 247, 255)
ORANGE = (255, 138, 61, 255)

def canvas(size):
    return [list(GRAPHITE) for _ in range(size * size)]

def put(px, size, x, y, color):
    if 0 <= x < size and 0 <= y < size:
        px[y * size + x] = list(color)

def circle(px, size, cx, cy, r, color):
    x0, x1 = max(0, int(cx-r)), min(size-1, int(cx+r))
    y0, y1 = max(0, int(cy-r)), min(size-1, int(cy+r))
    rr = r * r
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if (x-cx)**2 + (y-cy)**2 <= rr:
                put(px, size, x, y, color)

def polygon(px, size, pts, color):
    ys = [p[1] for p in pts]
    for y in range(max(0, int(min(ys))), min(size-1, int(max(ys))) + 1):
        hits = []
        for i, (x1, y1) in enumerate(pts):
            x2, y2 = pts[(i + 1) % len(pts)]
            if (y1 <= y < y2) or (y2 <= y < y1):
                hits.append(x1 + (y-y1) * (x2-x1) / (y2-y1))
        hits.sort()
        for a, b in zip(hits[0::2], hits[1::2]):
            for x in range(max(0, math.ceil(a)), min(size-1, math.floor(b)) + 1):
                put(px, size, x, y, color)

def line(px, size, a, b, width, color):
    x1, y1 = a; x2, y2 = b
    steps = max(1, int(max(abs(x2-x1), abs(y2-y1)) * 1.5))
    for i in range(steps + 1):
        t = i / steps
        circle(px, size, x1 + (x2-x1)*t, y1 + (y2-y1)*t, width/2, color)

def png_bytes(size, maskable=False):
    px = canvas(size)
    s = size / 512
    def P(x, y): return (x*s, y*s)
    circle(px, size, 256*s, 178*s, 42*s, SILVER)
    polygon(px, size, [P(220,224), P(292,224), P(334,388), P(178,388)], SILVER)
    line(px, size, P(234,244), P(151,139), 31*s, SILVER)
    line(px, size, P(278,244), P(361,139), 31*s, SILVER)
    polygon(px, size, [P(205,376),P(244,382),P(220,476),P(181,476)], SILVER)
    polygon(px, size, [P(307,376),P(268,382),P(292,476),P(331,476)], SILVER)
    for cx, cy, r in [(138,120,31),(112,130,24),(154,94,24),(164,133,22),(374,120,31),(400,130,24),(358,94,24),(348,133,22)]:
        circle(px, size, cx*s, cy*s, r*s, ORANGE)
    raw = b''.join(b'\x00' + bytes(v for pixel in px[y*size:(y+1)*size] for v in pixel) for y in range(size))
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')

outputs = {
    'favicon-32.png': (32, False),
    'app-icon-192.png': (192, False),
    'app-icon-512.png': (512, False),
    'app-icon-maskable-512.png': (512, True),
}
for name, (size, maskable) in outputs.items():
    (ROOT / name).write_bytes(png_bytes(size, maskable))
    print(f'wrote {name} ({size}x{size})')
