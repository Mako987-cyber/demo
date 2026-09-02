#!/usr/bin/env python3
"""Minimal SVG -> terminal renderer. Supports the subset used for logo work:
rect (with rx), circle, path (M L H V C Q Z, abs+rel), polygon/polyline,
fill (nonzero/evenodd) and stroke (distance-based, round joins).
Usage: svgview.py file.svg [cols] [--invert]
"""
import re, sys, math

def tokenize_path(d):
    return re.findall(r'([MmLlHhVvCcQqSsTtAaZz])|(-?\d*\.?\d+(?:e-?\d+)?)', d)

def path_to_subpaths(d, steps=12):
    toks, i = tokenize_path(d), 0
    nums, cmds = [], []
    for c, n in toks:
        if c:
            cmds.append((c, []))
        elif cmds:
            cmds[-1][1].append(float(n))
    subs, cur = [], []
    x = y = sx = sy = 0.0
    px = py = None  # last control point for S/T
    for cmd, args in cmds:
        u = cmd.upper(); rel = cmd.islower()
        k = {'M':2,'L':2,'H':1,'V':1,'C':6,'Q':4,'S':4,'T':2,'A':7,'Z':0}[u]
        groups = [args[j:j+k] for j in range(0, len(args), k)] if k else [[]]
        for gi, a in enumerate(groups):
            if k and len(a) < k: break
            if u == 'M':
                if gi == 0:
                    if cur: subs.append(cur)
                    x, y = (x+a[0], y+a[1]) if rel else (a[0], a[1])
                    sx, sy = x, y; cur = [(x, y)]
                else:
                    x, y = (x+a[0], y+a[1]) if rel else (a[0], a[1]); cur.append((x, y))
            elif u == 'L':
                x, y = (x+a[0], y+a[1]) if rel else (a[0], a[1]); cur.append((x, y))
            elif u == 'H':
                x = x+a[0] if rel else a[0]; cur.append((x, y))
            elif u == 'V':
                y = y+a[0] if rel else a[0]; cur.append((x, y))
            elif u in 'CQST':
                if u == 'C':
                    c1 = (x+a[0], y+a[1]) if rel else (a[0], a[1])
                    c2 = (x+a[2], y+a[3]) if rel else (a[2], a[3])
                    e = (x+a[4], y+a[5]) if rel else (a[4], a[5])
                elif u == 'S':
                    c1 = (2*x-px, 2*y-py) if px is not None else (x, y)
                    c2 = (x+a[0], y+a[1]) if rel else (a[0], a[1])
                    e = (x+a[2], y+a[3]) if rel else (a[2], a[3])
                elif u == 'Q':
                    q = (x+a[0], y+a[1]) if rel else (a[0], a[1])
                    e = (x+a[2], y+a[3]) if rel else (a[2], a[3])
                    c1 = (x+2/3*(q[0]-x), y+2/3*(q[1]-y)); c2 = (e[0]+2/3*(q[0]-e[0]), e[1]+2/3*(q[1]-e[1]))
                else:
                    q = (2*x-px, 2*y-py) if px is not None else (x, y)
                    e = (x+a[0], y+a[1]) if rel else (a[0], a[1])
                    c1 = (x+2/3*(q[0]-x), y+2/3*(q[1]-y)); c2 = (e[0]+2/3*(q[0]-e[0]), e[1]+2/3*(q[1]-e[1]))
                for t in range(1, steps+1):
                    t /= steps; mt = 1-t
                    bx = mt**3*x + 3*mt*mt*t*c1[0] + 3*mt*t*t*c2[0] + t**3*e[0]
                    by = mt**3*y + 3*mt*mt*t*c1[1] + 3*mt*t*t*c2[1] + t**3*e[1]
                    cur.append((bx, by))
                px, py = c2; x, y = e
                continue
            elif u == 'A':
                rx, ry, rot, laf, sf = a[0], a[1], math.radians(a[2]), a[3], a[4]
                e = (x+a[5], y+a[6]) if rel else (a[5], a[6])
                x1p = math.cos(rot)*(x-e[0])/2 + math.sin(rot)*(y-e[1])/2
                y1p = -math.sin(rot)*(x-e[0])/2 + math.cos(rot)*(y-e[1])/2
                den = rx*rx*y1p*y1p + ry*ry*x1p*x1p
                num = max(rx*rx*ry*ry - den, 0)
                co = (0 if den == 0 else math.sqrt(num/den)) * (1 if laf != sf else -1)
                cxp, cyp = co*rx*y1p/ry, -co*ry*x1p/rx
                cx = math.cos(rot)*cxp - math.sin(rot)*cyp + (x+e[0])/2
                cy = math.sin(rot)*cxp + math.cos(rot)*cyp + (y+e[1])/2
                a1 = math.atan2((y1p-cyp)/ry, (x1p-cxp)/rx)
                a2 = math.atan2((-y1p-cyp)/ry, (-x1p-cxp)/rx)
                da = a2-a1
                if sf == 0 and da > 0: da -= 2*math.pi
                if sf == 1 and da < 0: da += 2*math.pi
                for t in range(1, steps+1):
                    ang = a1 + da*t/steps
                    cur.append((math.cos(rot)*rx*math.cos(ang) - math.sin(rot)*ry*math.sin(ang) + cx,
                                math.sin(rot)*rx*math.cos(ang) + math.cos(rot)*ry*math.sin(ang) + cy))
                x, y = e
            elif u == 'Z':
                if cur: cur.append((sx, sy)); subs.append(cur); cur = []
                x, y = sx, sy
            px = py = None if u not in 'CQST' else px
    if cur: subs.append(cur)
    return subs

def attr(tag, name, default=None):
    m = re.search(r'\b%s\s*=\s*"([^"]*)"' % name, tag)
    return m.group(1) if m else default

def rect_subpath(tag):
    x, y = float(attr(tag,'x',0)), float(attr(tag,'y',0))
    w, h = float(attr(tag,'width',0)), float(attr(tag,'height',0))
    rx = float(attr(tag,'rx',0) or 0)
    if rx <= 0:
        return [[(x,y),(x+w,y),(x+w,y+h),(x,y+h),(x,y)]]
    pts, n = [], 8
    for cx, cy, a0 in ((x+w-rx,y+rx,-math.pi/2),(x+w-rx,y+h-rx,0),(x+rx,y+h-rx,math.pi/2),(x+rx,y+rx,math.pi)):
        for i in range(n+1):
            a = a0 + (math.pi/2)*i/n
            pts.append((cx+rx*math.cos(a), cy+rx*math.sin(a)))
    pts.append(pts[0])
    return [pts]

def circle_subpath(tag):
    cx, cy, r = float(attr(tag,'cx',0)), float(attr(tag,'cy',0)), float(attr(tag,'r',0))
    pts = [(cx+r*math.cos(2*math.pi*i/48), cy+r*math.sin(2*math.pi*i/48)) for i in range(49)]
    return [pts]

def poly_subpath(tag, close):
    nums = [float(v) for v in re.findall(r'-?\d*\.?\d+', attr(tag,'points',''))]
    pts = list(zip(nums[0::2], nums[1::2]))
    if close and pts: pts.append(pts[0])
    return [pts]

def inside(subs, px, py, evenodd):
    if evenodd:
        c = False
        for pts in subs:
            for i in range(len(pts)-1):
                (x1,y1),(x2,y2) = pts[i], pts[i+1]
                if (y1 > py) != (y2 > py):
                    xin = x1 + (py-y1)*(x2-x1)/(y2-y1)
                    if px < xin: c = not c
        return c
    w = 0
    for pts in subs:
        for i in range(len(pts)-1):
            (x1,y1),(x2,y2) = pts[i], pts[i+1]
            if y1 <= py < y2 and (x2-x1)*(py-y1)-(px-x1)*(y2-y1) > 0: w += 1
            elif y2 <= py < y1 and (x2-x1)*(py-y1)-(px-x1)*(y2-y1) < 0: w -= 1
    return w != 0

def dist_to(subs, px, py):
    best = 1e9
    for pts in subs:
        for i in range(len(pts)-1):
            x1,y1 = pts[i]; x2,y2 = pts[i+1]
            dx, dy = x2-x1, y2-y1
            L = dx*dx+dy*dy
            t = 0 if L == 0 else max(0, min(1, ((px-x1)*dx+(py-y1)*dy)/L))
            best = min(best, math.hypot(px-(x1+t*dx), py-(y1+t*dy)))
    return best

def render(path, cols=64, invert=False):
    src = open(path).read()
    vb = re.search(r'viewBox\s*=\s*"([^"]*)"', src)
    vx, vy, vw, vh = [float(v) for v in re.split(r'[\s,]+', vb.group(1).strip())]
    root = src[:src.index('>')+1]
    root_stroke_w = attr(root, 'stroke-width')
    root_fill = attr(root, 'fill')

    layers = []
    # inherit stroke-width / fill from enclosing <g>
    for m in re.finditer(r'<(rect|circle|path|polygon|polyline|g)\b[^>]*>', src):
        tag, name = m.group(0), m.group(1)
        if name == 'g':
            layers.append(('g', tag, m.end()))
            continue
        # find nearest open g before this element
        ctx = ''
        for kind, gtag, pos in layers:
            if kind == 'g' and pos < m.start(): ctx = gtag
        if name == 'rect': subs = rect_subpath(tag)
        elif name == 'circle': subs = circle_subpath(tag)
        elif name in ('polygon','polyline'): subs = poly_subpath(tag, name=='polygon')
        else: subs = path_to_subpaths(attr(tag,'d',''))
        fill = attr(tag,'fill') or attr(ctx,'fill') or root_fill or 'black'
        stroke = attr(tag,'stroke') or attr(ctx,'stroke')
        sw = attr(tag,'stroke-width') or attr(ctx,'stroke-width') or root_stroke_w or '1'
        eo = (attr(tag,'fill-rule') or attr(ctx,'fill-rule') or '') == 'evenodd'
        layers.append(('shape', (subs, fill, stroke, float(sw), eo), m.end()))

    rows = int(cols*vh/vw/2)*2
    grid = [[0]*cols for _ in range(rows)]
    for kind, data, _ in layers:
        if kind != 'shape': continue
        subs, fill, stroke, sw, eo = data
        on = 0 if (fill and fill.lower() in ('#0d1117','#000','#000000','black')) else 1
        for r in range(rows):
            py = vy + (r+0.5)*vh/rows
            for c in range(cols):
                px = vx + (c+0.5)*vw/cols
                hit = False
                if fill and fill != 'none' and inside(subs, px, py, eo): hit = True
                if stroke and stroke != 'none' and dist_to(subs, px, py) <= sw/2: hit = True; on = 1
                if hit: grid[r][c] = on
    if invert:
        grid = [[1-v for v in row] for row in grid]
    out = []
    for r in range(0, rows, 2):
        line = ''
        for c in range(cols):
            t, b = grid[r][c], grid[r+1][c] if r+1 < rows else 0
            line += ' ▄▀█'[(t<<1)|b]
        out.append(line)
    return '\n'.join(out)

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    cols = int(args[1]) if len(args) > 1 else 64
    print(render(args[0], cols, '--invert' in sys.argv))
