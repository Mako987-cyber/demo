#!/usr/bin/env python3
"""Rasterizza il marchio AM in favicon.ico e apple-touch-icon.png.
Solo stdlib: campionamento 4x4 per l'antialiasing, PNG a mano, ICO con
payload PNG (supportato da tutti i browser correnti)."""

import os, struct, zlib

OUT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
GRAPHITE = (13, 17, 23)
EMERALD = (46, 204, 143)
SS = 4                      # supersampling per lato

# poligoni del marchio nello spazio 64x64 (stessi vertici dei path SVG)
MARK = [
    [(8, 50), (18, 14), (26, 14), (31.2, 32.72), (31.2, 50), (28, 50), (22, 28.4), (16, 50)],
    [(56, 50), (46, 14), (38, 14), (32.8, 32.72), (32.8, 50), (36, 50), (42, 28.4), (48, 50)],
    [(11.75, 36.5), (31.2, 36.5), (31.2, 43), (11.75, 43)],
]


def in_poly(poly, x, y):
    inside = False
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            inside = not inside
    return inside


def in_tile(x, y, r):
    """Quadrato 0..64 con raccordo r (0 = pieno, angoli vivi)."""
    if not (0 <= x <= 64 and 0 <= y <= 64):
        return False
    if r <= 0:
        return True
    cx = r if x < r else (64 - r if x > 64 - r else x)
    cy = r if y < r else (64 - r if y > 64 - r else y)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def rasterize(size, radius=9.6, scale=1.0, opaque=False):
    """RGBA, size x size. scale rimpicciolisce il marchio attorno al centro."""
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            tile_hits = mark_hits = 0
            for sy in range(SS):
                for sx in range(SS):
                    u = (px + (sx + 0.5) / SS) * 64.0 / size
                    v = (py + (sy + 0.5) / SS) * 64.0 / size
                    if not in_tile(u, v, radius):
                        continue
                    tile_hits += 1
                    mu, mv = 32 + (u - 32) / scale, 32 + (v - 32) / scale
                    if any(in_poly(p, mu, mv) for p in MARK):
                        mark_hits += 1
            total = SS * SS
            if tile_hits == 0:
                row += bytes(4)
                continue
            k = mark_hits / tile_hits          # quota di smeraldo dentro la tile
            rgb = tuple(round(GRAPHITE[i] + (EMERALD[i] - GRAPHITE[i]) * k)
                        for i in range(3))
            alpha = 255 if opaque else round(255 * tile_hits / total)
            row += bytes((*rgb, alpha))
        rows.append(bytes(row))
    return rows


def png(rows, size):
    raw = b"".join(b"\x00" + r for r in rows)

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c))

    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b""))


def ico(sizes):
    imgs = [(s, png(rasterize(s), s)) for s in sizes]
    header = struct.pack("<HHH", 0, 1, len(imgs))
    offset = 6 + 16 * len(imgs)
    entries, blobs = b"", b""
    for s, data in imgs:
        entries += struct.pack("<BBBBHHII", s if s < 256 else 0,
                               s if s < 256 else 0, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
        blobs += data
    return header + entries + blobs


def save(path, data):
    with open(path, "wb") as f:
        f.write(data)
    print(f"{len(data):6d} B  {path}")


# favicon.ico: 16/32/48, angoli raccordati come l'SVG
save(os.path.join(OUT, "favicon.ico"), ico([16, 32, 48]))

# apple-touch-icon: 180x180 al vivo e opaco — iOS applica la sua maschera,
# un raccordo nostro produrrebbe un doppio arrotondamento. Marchio all'88%
# per stare dentro la safe area della maschera.
save(os.path.join(OUT, "assets/apple-touch-icon.png"),
     png(rasterize(180, radius=0, scale=0.88, opaque=True), 180))
