#!/usr/bin/env python3
"""svg2png.py file.svg out.png [width] [--bg=RRGGBB]
Rasterizza gli SVG a riempimento (nessun tratto) riusando il parser di svgview."""
import re, sys, struct, zlib
import svgview as sv

SS = 3


def hexcol(c, default=(0, 0, 0)):
    c = (c or "").strip()
    if not c.startswith("#"):
        return default
    c = c[1:]
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def shapes_of(src):
    root = src[:src.index(">") + 1]
    out, gtags = [], []
    for m in re.finditer(r"<(rect|circle|path|polygon|g)\b[^>]*>", src):
        tag, name = m.group(0), m.group(1)
        if name == "g":
            gtags.append((m.start(), tag))
            continue
        ctx = ""
        for pos, gtag in gtags:
            if pos < m.start():
                ctx = gtag
        if name == "rect":
            subs = sv.rect_subpath(tag)
        elif name == "circle":
            subs = sv.circle_subpath(tag)
        elif name == "polygon":
            subs = sv.poly_subpath(tag, True)
        else:
            subs = sv.path_to_subpaths(sv.attr(tag, "d", ""))
        fill = sv.attr(tag, "fill") or sv.attr(ctx, "fill") or sv.attr(root, "fill") or "#000"
        eo = (sv.attr(tag, "fill-rule") or sv.attr(ctx, "fill-rule") or "") == "evenodd"
        if fill != "none":
            out.append((subs, hexcol(fill), eo))
    return out


def main(path, out, width=None, bg=None):
    src = open(path).read()
    vb = re.search(r'viewBox\s*=\s*"([^"]*)"', src).group(1)
    vx, vy, vw, vh = [float(v) for v in re.split(r"[\s,]+", vb.strip())]
    W = int(width or vw)
    H = max(1, round(W * vh / vw))
    shapes = shapes_of(src)
    bgcol = hexcol(bg, None) if bg else None

    rows = []
    for py in range(H):
        row = bytearray()
        for px in range(W):
            acc, hits = [0, 0, 0], 0
            for sy in range(SS):
                for sx in range(SS):
                    u = vx + (px + (sx + 0.5) / SS) * vw / W
                    v = vy + (py + (sy + 0.5) / SS) * vh / H
                    col = None
                    for subs, c, eo in shapes:
                        if sv.inside(subs, u, v, eo):
                            col = c
                    if col is None:
                        if bgcol is None:
                            continue
                        col = bgcol
                    hits += 1
                    for i in range(3):
                        acc[i] += col[i]
            n = SS * SS
            if hits == 0:
                row += bytes(4)
            else:
                row += bytes((*(round(a / hits) for a in acc), round(255 * hits / n)))
        rows.append(bytes(row))

    raw = b"".join(b"\x00" + r for r in rows)

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c))

    open(out, "wb").write(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b""))
    print(f"{out}  {W}x{H}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    bgarg = next((a.split("=")[1] for a in sys.argv[1:] if a.startswith("--bg=")), None)
    main(args[0], args[1], int(args[2]) if len(args) > 2 else None, bgarg)
