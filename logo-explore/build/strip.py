#!/usr/bin/env python3
"""strip.py out.png a.png b.png ...  — affianca PNG RGBA su fondo bianco."""
import struct, zlib, sys


def read(p):
    d = open(p, "rb").read()
    i, w, h, idat = 8, None, None, b""
    while i < len(d):
        ln = struct.unpack(">I", d[i:i + 4])[0]
        tag, data = d[i + 4:i + 8], d[i + 8:i + 8 + ln]
        if tag == b"IHDR":
            w, h = struct.unpack(">II", data[:8])
        if tag == b"IDAT":
            idat += data
        i += 12 + ln
    raw, st, rows, prev = zlib.decompress(idat), w * 4, [], bytearray(w * 4)
    for y in range(h):
        f = raw[y * (st + 1)]
        ln_ = bytearray(raw[y * (st + 1) + 1:(y + 1) * (st + 1)])
        for x in range(st):
            a = ln_[x - 4] if x >= 4 else 0
            b = prev[x]
            c = prev[x - 4] if x >= 4 else 0
            if f == 1:
                ln_[x] = (ln_[x] + a) & 255
            elif f == 2:
                ln_[x] = (ln_[x] + b) & 255
            elif f == 3:
                ln_[x] = (ln_[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                ln_[x] = (ln_[x] + (a if pa <= pb and pa <= pc else (b if pb <= pc else c))) & 255
        rows.append(bytes(ln_))
        prev = ln_
    return w, h, rows


def main(out, paths, gap=20):
    imgs = [read(p) for p in paths]
    W = sum(i[0] for i in imgs) + gap * (len(imgs) - 1)
    H = max(i[1] for i in imgs)
    canvas = [bytearray(b"\xff\xff\xff\xff" * W) for _ in range(H)]
    ox = 0
    for w, h, rows in imgs:
        for y in range(h):
            for x in range(w):
                px = rows[y][x * 4:x * 4 + 4]
                a = px[3] / 255
                for c in range(3):
                    canvas[y][(ox + x) * 4 + c] = round(px[c] * a + 255 * (1 - a))
        ox += w + gap
    raw = b"".join(b"\x00" + bytes(r) for r in canvas)

    def chunk(t, d):
        c = t + d
        return struct.pack(">I", len(d)) + c + struct.pack(">I", zlib.crc32(c))

    open(out, "wb").write(b"\x89PNG\r\n\x1a\n"
                          + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0))
                          + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    print(out, W, H)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
