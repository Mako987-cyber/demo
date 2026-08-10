#!/usr/bin/env python3
"""Genera il set di marchio "AM · moduli" per aniellomollo.

Marchio: uno zigzag (due picchi = M) smontato in quattro moduli con luce
costante 1.6; il primo picco porta la traversa e diventa A.
Wordmark: stesse regole del marchio — tagli piatti, nessuna curva
(la O e' un ottagono), un'unica asta di riferimento.

I glifi sono definiti in uno spazio normalizzato con altezza maiuscola 20
(y 22..42, asta 4) e poi scalati da K attorno all'asse orizzontale del
marchio: cambiare K e' l'unico modo previsto per ridimensionare il wordmark.
"""

import os

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = os.path.join(ROOT, "assets")
GRAPHITE = "#0d1117"
EMERALD = "#2ecc8f"
INK_LIGHT = "#0d1117"   # wordmark su fondo chiaro
INK_DARK = "#e6edf3"    # wordmark su fondo scuro

# ── Marchio: due moduli + traversa, viewBox 0 0 64 64 ────────────────
# Zigzag a due picchi (= M) spezzato in due moduli da una luce di 1.6 sulla
# valle centrale. Il picco sinistro porta la traversa e diventa A.
# I picchi restano pieni: tagliarli come la valle faceva leggere quattro
# barre parallele invece di due picchi, e la M spariva.
MARK = [
    "M8 50 L18 14 H26 L31.2 32.72 V50 H28 L22 28.4 L16 50 Z",
    "M56 50 L46 14 H38 L32.8 32.72 V50 H36 L42 28.4 L48 50 Z",
    "M11.75 36.5 H31.2 V43 H11.75 Z",
]

# ── Wordmark ────────────────────────────────────────────────────────
T, B, S = 22.0, 42.0, 4.0     # spazio normalizzato: cap 20, asta 4
CY = 32.0                     # asse orizzontale, condiviso col marchio
K = 1.2                       # cap finale = 24
C = 4.0                       # smusso della O
I = 5.657                     # rientro dello smusso interno: 4 + 4*(sqrt2 - 1)


def n(v):
    """Numero compatto: max 2 decimali, senza zeri di coda."""
    s = f"{round(v + 0.0, 2):.2f}".rstrip("0").rstrip(".")
    return "0" if s == "-0" else s


def box(x, y, w, h):
    return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]


def glyph(ch):
    """Ritorna (shapes, larghezza) in coordinate normalizzate.
    Uno shape e' una lista di contorni: piu' di uno solo per le lettere cave."""
    if ch == "A":
        w = 15.0
        return [
            [[(5.5, T), (9.5, T), (4, B), (0, B)]],          # gamba sinistra
            [[(5.5, T), (9.5, T), (w, B), (11, B)]],         # gamba destra
            [box(2.2, 34, 10.6, S)],                         # traversa
        ], w
    if ch == "N":
        w = 13.0
        return [
            [box(0, T, S, 20)], [box(9, T, S, 20)],
            [[(0, T), (S, T), (w, B), (9, B)]],
        ], w
    if ch == "I":
        return [[box(0, T, S, 20)]], S
    if ch == "E":
        w = 11.0
        return [[box(0, T, S, 20)], [box(0, T, w, S)],
                [box(0, 30, 9.5, S)], [box(0, 38, w, S)]], w
    if ch == "L":
        w = 11.0
        return [[box(0, T, S, 20)], [box(0, 38, w, S)]], w
    if ch == "O":
        w = 15.0
        outer = [(C, T), (w - C, T), (w, T + C), (w, B - C),
                 (w - C, B), (C, B), (0, B - C), (0, T + C)]
        inner = [(I, T + S), (w - I, T + S), (w - S, T + I), (w - S, B - I),
                 (w - I, B - S), (I, B - S), (S, B - I), (S, T + I)]
        return [[outer, inner]], w                            # cava: evenodd
    if ch == "M":
        w = 17.0
        return [
            [box(0, T, S, 20)], [box(13, T, S, 20)],
            [[(0, T), (S, T), (10.5, 38), (6.5, 38)]],
            [[(13, T), (w, T), (10.5, 38), (6.5, 38)]],
        ], w
    raise ValueError(ch)


# avanzamenti calibrati sulle coppie critiche: AN stretta (la A apre in alto),
# I ariosa da entrambi i lati, spazio di parola 10.
LAYOUT = [("A", 3), ("N", 5), ("I", 5), ("E", 4), ("L", 4), ("L", 4), ("O", 10),
          ("M", 4), ("O", 4), ("L", 4), ("L", 4), ("O", 0)]


def emit(shape, x0):
    """Contorni normalizzati -> path data assoluto, scalato di K."""
    out = []
    for contour in shape:
        pts = [(x0 + u * K, CY + (v - CY) * K) for u, v in contour]
        d = f"M{n(pts[0][0])} {n(pts[0][1])}"
        for px, py in pts[1:]:
            d += f" L{n(px)} {n(py)}"
        out.append(d + " Z")
    return " ".join(out)


def wordmark(x0):
    paths, x = [], x0
    for ch, gap in LAYOUT:
        shapes, w = glyph(ch)
        paths += [emit(s, x) for s in shapes]
        x += (w + gap) * K
    return paths, x - 0.0


def svg(vb, body, title=None):
    head = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb
            + '" role="img" aria-label="Aniello Mollo">')
    t = f"\n  <title>{title}</title>" if title else ""
    return head + t + "\n" + body + "\n</svg>\n"


def tile():
    return f'  <rect width="64" height="64" rx="9.6" fill="{GRAPHITE}"/>'


def mark_paths():
    return "\n".join(f'    <path d="{d}"/>' for d in MARK)


def write(name, content):
    path = os.path.join(OUT, name)
    with open(path, "w") as f:
        f.write(content)
    print(f"{len(content):5d} B  {path}")


# ── 1. logo.svg / favicon.svg: tile grafite + marchio smeraldo ───────
tile_body = tile() + f'\n  <g fill="{EMERALD}">\n' + mark_paths() + "\n  </g>"
write("logo.svg", svg("0 0 64 64", tile_body,
                      "Aniello Mollo — Infrastructure &amp; Cloud Engineer"))
write("favicon.svg", svg("0 0 64 64", tile_body))

# ── 2. logo-mark.svg: solo marchio, eredita il colore dal contesto ───
write("logo-mark.svg", svg("0 0 64 64",
                           '  <g fill="currentColor">\n' + mark_paths() + "\n  </g>",
                           "Monogramma AM"))

# ── 3. lockup orizzontale: tile + wordmark ──────────────────────────
WM_X = 84.0
wm, end = wordmark(WM_X)
print(f"wordmark: cap {n(20 * K)}, da {n(WM_X)} a {n(end)} (larghezza {n(end - WM_X)})")

for suffix, ink in (("", INK_LIGHT), ("-dark", INK_DARK)):
    body = (tile() + f'\n  <g fill="{EMERALD}">\n' + mark_paths() + "\n  </g>\n"
            + f'  <g fill="{ink}" fill-rule="evenodd">\n'
            + "\n".join(f'    <path d="{d}"/>' for d in wm) + "\n  </g>")
    write(f"logo-lockup{suffix}.svg", svg(f"0 0 {n(end)} 64", body, "Aniello Mollo"))
