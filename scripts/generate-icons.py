"""
NexVault 3D Icon Generator
==========================
Generates ALL icons from the reference design using PIL + numpy.
Dark holographic quantum aesthetic. 512x512 per icon, 1284x2778 splash.
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops
import numpy as np
import math, os, random

# ── Output dirs ───────────────────────────────────────────────────────────────
# Output goes into nexvault-assets/ next to this script
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(_SCRIPT_DIR, "..", "nexvault-assets")
BASE = os.path.normpath(BASE)

DIRS = {
    "app":      os.path.join(BASE, "app"),
    "nav":      os.path.join(BASE, "icons", "nav"),
    "create":   os.path.join(BASE, "icons", "create"),
    "interact": os.path.join(BASE, "icons", "interact"),
    "state":    os.path.join(BASE, "icons", "state"),
    "data":     os.path.join(BASE, "icons", "data"),
    "splash":   os.path.join(BASE, "splash"),
}
for d in DIRS.values():
    os.makedirs(d, exist_ok=True)

# ── Fonts — auto-detects macOS, Linux, Windows ───────────────────────────────
def _find_font(bold=True):
    candidates = []
    if bold:
        candidates = [
            # macOS
            "/System/Library/Fonts/Helvetica.ttc",
            "/System/Library/Fonts/SFNSDisplay-Bold.otf",
            "/Library/Fonts/Arial Bold.ttf",
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            # Linux
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            # Windows
            "C:/Windows/Fonts/arialbd.ttf",
        ]
    else:
        candidates = [
            "/System/Library/Fonts/Helvetica.ttc",
            "/Library/Fonts/Arial.ttf",
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "C:/Windows/Fonts/arial.ttf",
        ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return None

def fnt(size, bold=True):
    path = _find_font(bold)
    try:
        if path:
            return ImageFont.truetype(path, size)
    except Exception:
        pass
    return ImageFont.load_default(size)

# ── Palette ───────────────────────────────────────────────────────────────────
CYAN    = (0, 209, 255)
CYAN_B  = (0, 160, 220)
CYAN_D  = (0, 80,  140)
BLUE    = (0,  60, 200)
PURPLE  = (100, 30, 255)
WHITE   = (255,255,255)
BG      = (3,   8,  18)

S = 512   # icon canvas size
CX = CY = S // 2

# ── Core helpers ──────────────────────────────────────────────────────────────

def new_canvas(w=S, h=S, bg=BG):
    img = Image.new("RGBA", (w, h), bg + (255,))
    return img, ImageDraw.Draw(img)

def arr(img):
    return np.array(img, dtype=np.float32)

def from_arr(a):
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")

def radial_gradient(w, h, cx, cy, r_inner, r_outer, color_in, color_out):
    """Create RGBA radial gradient image."""
    a = np.zeros((h, w, 4), dtype=np.float32)
    Y, X = np.mgrid[0:h, 0:w]
    dist = np.sqrt((X - cx)**2 + (Y - cy)**2)
    t = np.clip((dist - r_inner) / max(r_outer - r_inner, 1), 0, 1)
    for i in range(4):
        a[:,:,i] = color_in[i] * (1 - t) + color_out[i] * t
    return from_arr(a)

def add_glow(base, blur_radius=20):
    """Bloom / glow pass."""
    glow = base.filter(ImageFilter.GaussianBlur(blur_radius))
    return Image.alpha_composite(base, glow)

def draw_glow_line(img, p1, p2, color, width=3, blur=12):
    layer = Image.new("RGBA", img.size, (0,0,0,0))
    d = ImageDraw.Draw(layer)
    d.line([p1, p2], fill=color, width=width)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    layer2 = Image.new("RGBA", img.size, (0,0,0,0))
    d2 = ImageDraw.Draw(layer2)
    d2.line([p1, p2], fill=color, width=max(1, width//2))
    return Image.alpha_composite(Image.alpha_composite(img, layer), layer2)

def draw_glow_circle(img, cx, cy, r, color, width=3, blur=14):
    layer = Image.new("RGBA", img.size, (0,0,0,0))
    d = ImageDraw.Draw(layer)
    d.ellipse([cx-r, cy-r, cx+r, cy+r], outline=color, width=width)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    layer2 = Image.new("RGBA", img.size, (0,0,0,0))
    d2 = ImageDraw.Draw(layer2)
    d2.ellipse([cx-r, cy-r, cx+r, cy+r], outline=color, width=max(1, width//2))
    return Image.alpha_composite(Image.alpha_composite(img, layer), layer2)

def draw_glow_arc(img, bbox, start, end, color, width=3, blur=12):
    layer = Image.new("RGBA", img.size, (0,0,0,0))
    d = ImageDraw.Draw(layer)
    d.arc(bbox, start, end, fill=color, width=width)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    layer2 = Image.new("RGBA", img.size, (0,0,0,0))
    d2 = ImageDraw.Draw(layer2)
    d2.arc(bbox, start, end, fill=color, width=max(1, width//2))
    return Image.alpha_composite(Image.alpha_composite(img, layer), layer2)

def glow_dot(img, x, y, r, color, blur=8):
    layer = Image.new("RGBA", img.size, (0,0,0,0))
    d = ImageDraw.Draw(layer)
    d.ellipse([x-r, y-r, x+r, y+r], fill=color)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    layer2 = Image.new("RGBA", img.size, (0,0,0,0))
    d2 = ImageDraw.Draw(layer2)
    d2.ellipse([x-r//2, y-r//2, x+r//2, y+r//2], fill=color)
    return Image.alpha_composite(Image.alpha_composite(img, layer), layer2)

def scatter_particles(img, count, seed=42, alpha_max=180, max_r=3):
    rng = random.Random(seed)
    layer = Image.new("RGBA", img.size, (0,0,0,0))
    d = ImageDraw.Draw(layer)
    for _ in range(count):
        x = rng.randint(0, img.width)
        y = rng.randint(0, img.height)
        r = rng.uniform(0.5, max_r)
        a = rng.randint(20, alpha_max)
        d.ellipse([x-r, y-r, x+r, y+r], fill=CYAN+(a,))
    return Image.alpha_composite(img, layer)

def save(img, path, label=""):
    img.convert("RGB").save(path, quality=96)
    rel = path.replace(BASE+"/","")
    print(f"  ✓ {rel}{' — '+label if label else ''}")

def bg_with_glow(w=S, h=S, glow_r=200, glow_alpha=60):
    img = Image.new("RGBA", (w, h), BG+(255,))
    # subtle central glow
    g = radial_gradient(w, h, w//2, h//2, 0, glow_r,
                        CYAN+(glow_alpha,), CYAN+(0,))
    return Image.alpha_composite(img, g)

# ─────────────────────────────────────────────────────────────────────────────
# 1. MAIN APP ICON — swirling vortex
# ─────────────────────────────────────────────────────────────────────────────
def gen_app_icon():
    img = Image.new("RGBA", (S, S), (0,0,0,255))

    # Deep space gradient
    g = radial_gradient(S, S, CX, CY, 0, S*0.7,
                        (10,20,45,255), (0,0,0,255))
    img = Image.alpha_composite(img, g)

    # Star field
    rng = random.Random(7)
    sl = Image.new("RGBA", (S,S), (0,0,0,0))
    sd = ImageDraw.Draw(sl)
    for _ in range(200):
        x,y = rng.randint(0,S), rng.randint(0,S)
        r = rng.uniform(0.3, 1.5)
        a = rng.randint(60,200)
        sd.ellipse([x-r,y-r,x+r,y+r], fill=WHITE+(a,))
    img = Image.alpha_composite(img, sl)

    # Multiple spiral arms
    rng2 = random.Random(42)
    for arm in range(5):
        base_angle = arm * (2*math.pi / 5)
        pl = Image.new("RGBA", (S,S), (0,0,0,0))
        pd = ImageDraw.Draw(pl)
        pts = []
        for t in range(120):
            tt = t / 120
            angle = base_angle + tt * math.pi * 2.2
            r = 15 + tt * 210
            px = CX + math.cos(angle) * r
            py = CY + math.sin(angle) * r
            pts.append((px, py))
        # Draw with fading color
        for i in range(len(pts)-1):
            t = i/len(pts)
            a = int(40 + t * 180)
            thick = max(1, int(4*(1-t*0.6)))
            pd.line([pts[i], pts[i+1]], fill=CYAN+(a,), width=thick)
        pl = pl.filter(ImageFilter.GaussianBlur(3))
        img = Image.alpha_composite(img, pl)

    # Particle dots along spirals
    pl2 = Image.new("RGBA", (S,S), (0,0,0,0))
    pd2 = ImageDraw.Draw(pl2)
    for _ in range(150):
        angle = rng2.uniform(0, math.pi*2)
        dist  = rng2.uniform(30, 220)
        px = CX + math.cos(angle)*dist
        py = CY + math.sin(angle)*dist
        r = rng2.uniform(1, 4)
        a = rng2.randint(100, 255)
        pd2.ellipse([px-r, py-r, px+r, py+r], fill=CYAN+(a,))
    pl2 = pl2.filter(ImageFilter.GaussianBlur(2))
    img = Image.alpha_composite(img, pl2)

    # Concentric rings
    for r, a, w in [(200,50,2),(165,70,2),(130,90,2),(95,110,2),(62,130,3)]:
        img = draw_glow_circle(img, CX, CY, r, CYAN+(a,), w, 18)

    # Core bright point
    for r, col in [(60, CYAN+(120,)),(35, CYAN+(200,)),(18, WHITE+(230,)),(8, WHITE+(255,))]:
        g = radial_gradient(S, S, CX, CY, 0, r, col, (0,0,0,0))
        img = Image.alpha_composite(img, g)

    # iOS rounded corners mask
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0,0,S,S], radius=110, fill=255)
    img.putalpha(mask)

    save(img, f"{DIRS['app']}/icon.png", "App Icon 512x512")

    # Also save 1024x1024
    big = img.resize((1024,1024), Image.LANCZOS)
    save(big, f"{DIRS['app']}/icon-1024.png", "App Icon 1024x1024")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 2. QUANTUM SPHERE (Atom/Planet)
# ─────────────────────────────────────────────────────────────────────────────
def gen_quantum_sphere():
    img = bg_with_glow(glow_r=180, glow_alpha=30)

    # Planet/sphere glow
    g = radial_gradient(S, S, CX, CY-10, 0, 130,
                        CYAN+(180,), CYAN+(0,))
    img = Image.alpha_composite(img, g)

    # Orbital ring (ellipse)
    img = draw_glow_arc(img, [CX-200, CY-40, CX+200, CY+40], 0, 360,
                        CYAN+(200,), 4, 16)

    # Second orbital (tilted)
    layer = Image.new("RGBA", (S,S), (0,0,0,0))
    d = ImageDraw.Draw(layer)
    d.arc([CX-160, CY-100, CX+160, CY+100], 0, 360, fill=CYAN+(120,), width=3)
    layer = layer.filter(ImageFilter.GaussianBlur(10))
    img = Image.alpha_composite(img, layer)

    # Core sphere
    for r, col in [(90, BLUE+(80,)),(70, CYAN+(100,)),(48, CYAN+(180,)),
                   (28, WHITE+(200,)),(12, WHITE+(255,))]:
        g = radial_gradient(S, S, CX, CY, 0, r, col, (0,0,0,0))
        img = Image.alpha_composite(img, g)

    # Sphere highlight (top-left shimmer)
    g2 = radial_gradient(S, S, CX-35, CY-38, 0, 45,
                         WHITE+(120,), WHITE+(0,))
    img = Image.alpha_composite(img, g2)

    # Particle ring scatter
    rng = random.Random(13)
    pl = Image.new("RGBA", (S,S), (0,0,0,0))
    pd = ImageDraw.Draw(pl)
    for _ in range(60):
        angle = rng.uniform(0, math.pi*2)
        rx, ry = 200, 40
        px = CX + math.cos(angle)*rx + rng.uniform(-8,8)
        py = CY + math.sin(angle)*ry + rng.uniform(-8,8)
        r = rng.uniform(1,3.5)
        pd.ellipse([px-r,py-r,px+r,py+r], fill=CYAN+(rng.randint(80,220),))
    pl = pl.filter(ImageFilter.GaussianBlur(1.5))
    img = Image.alpha_composite(img, pl)

    save(img, f"{DIRS['app']}/quantum-sphere.png", "Quantum Sphere")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 3. VAULT ICON — 3D holographic cube + lock
# ─────────────────────────────────────────────────────────────────────────────
def gen_vault():
    img = bg_with_glow(glow_r=200, glow_alpha=25)

    # 3D cube wireframe
    # Front face corners
    fl = 130  # front face half-size
    off = 80  # perspective offset
    f = [(CX-fl, CY-fl), (CX+fl, CY-fl), (CX+fl, CY+fl), (CX-fl, CY+fl)]
    b = [(p[0]+off, p[1]-off) for p in f]  # back face

    def draw_edge(img, p1, p2, a=180):
        return draw_glow_line(img, p1, p2, CYAN+(a,), 3, 14)

    # Back face
    for i in range(4):
        img = draw_edge(img, b[i], b[(i+1)%4], 80)
    # Connecting edges
    for i in range(4):
        img = draw_edge(img, f[i], b[i], 100)
    # Front face
    for i in range(4):
        img = draw_edge(img, f[i], f[(i+1)%4], 220)

    # Frosted glass fill on front face
    poly_layer = Image.new("RGBA", (S,S), (0,0,0,0))
    ImageDraw.Draw(poly_layer).polygon(f, fill=(0,150,220,18))
    img = Image.alpha_composite(img, poly_layer)

    # Right face fill
    right = [f[1], b[1], b[2], f[2]]
    poly_layer2 = Image.new("RGBA", (S,S), (0,0,0,0))
    ImageDraw.Draw(poly_layer2).polygon(right, fill=(0,120,200,12))
    img = Image.alpha_composite(img, poly_layer2)

    # Top face fill
    top = [f[0], f[1], b[1], b[0]]
    poly_layer3 = Image.new("RGBA", (S,S), (0,0,0,0))
    ImageDraw.Draw(poly_layer3).polygon(top, fill=(0,180,255,15))
    img = Image.alpha_composite(img, poly_layer3)

    # Grid lines on front face
    gl = Image.new("RGBA", (S,S), (0,0,0,0))
    gd = ImageDraw.Draw(gl)
    for step in range(1, 4):
        t = step / 4
        # horizontal
        p1 = (f[0][0] + (f[3][0]-f[0][0])*t, f[0][1] + (f[3][1]-f[0][1])*t)
        p2 = (f[1][0] + (f[2][0]-f[1][0])*t, f[1][1] + (f[2][1]-f[1][1])*t)
        gd.line([p1, p2], fill=CYAN+(25,), width=1)
        # vertical
        p3 = (f[0][0] + (f[1][0]-f[0][0])*t, f[0][1] + (f[1][1]-f[0][1])*t)
        p4 = (f[3][0] + (f[2][0]-f[3][0])*t, f[3][1] + (f[2][1]-f[3][1])*t)
        gd.line([p3, p4], fill=CYAN+(25,), width=1)
    img = Image.alpha_composite(img, gl)

    # Lock dial on front face center
    lx, ly = CX - 10, CY + 5
    img = draw_glow_circle(img, lx, ly, 55, CYAN+(180,), 3, 16)
    img = draw_glow_circle(img, lx, ly, 30, CYAN+(140,), 2, 10)
    img = draw_glow_circle(img, lx, ly, 12, CYAN+(200,), 2, 8)

    # Tick marks
    tl = Image.new("RGBA", (S,S), (0,0,0,0))
    td = ImageDraw.Draw(tl)
    for i in range(10):
        a = i * 36 * math.pi / 180
        x1 = lx + math.cos(a)*35; y1 = ly + math.sin(a)*35
        x2 = lx + math.cos(a)*52; y2 = ly + math.sin(a)*52
        td.line([(x1,y1),(x2,y2)], fill=CYAN+(160,), width=2)
    tl = tl.filter(ImageFilter.GaussianBlur(2))
    img = Image.alpha_composite(img, tl)

    save(img, f"{DIRS['nav']}/vault.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 4. RESEARCH ICON — Microscope + data streams
# ─────────────────────────────────────────────────────────────────────────────
def gen_research():
    img = bg_with_glow(glow_r=190, glow_alpha=20)
    bx, by = CX - 50, CY

    def line(img, p1, p2, a=200, w=4):
        return draw_glow_line(img, p1, p2, CYAN+(a,), w, 12)

    # Stage base
    img = line(img, (bx-90, by+130), (bx+90, by+130), 200, 5)
    # Stage arm up
    img = line(img, (bx, by+130), (bx, by-60), 200, 4)
    # Stage plate
    img = line(img, (bx-55, by+30), (bx+55, by+30), 180, 3)
    img = line(img, (bx-55, by+55), (bx+55, by+55), 160, 2)
    # Head
    img = line(img, (bx-40, by-60), (bx+40, by-60), 200, 4)
    # Eyepiece arm
    img = line(img, (bx+30, by-60), (bx+30, by-130), 200, 4)
    # Eyepiece
    img = draw_glow_circle(img, bx+30, by-145, 22, CYAN+(200,), 3, 12)
    # Lens
    img = draw_glow_circle(img, bx, by-10, 38, CYAN+(180,), 3, 14)
    g = radial_gradient(S, S, bx, by-10, 0, 35, CYAN+(40,), CYAN+(0,))
    img = Image.alpha_composite(img, g)
    # Lens glow
    img = draw_glow_circle(img, bx, by-10, 22, CYAN+(120,), 2, 8)

    # Data stream lines (right of microscope)
    dl = Image.new("RGBA", (S,S), (0,0,0,0))
    dd = ImageDraw.Draw(dl)
    widths = [80,110,65,90,50,75,40,60]
    for i, w in enumerate(widths):
        y = by - 80 + i*30
        x0 = bx + 65
        dd.line([(x0, y), (x0+w, y)], fill=CYAN+(int(180-i*10),), width=3)
    dl = dl.filter(ImageFilter.GaussianBlur(3))
    img = Image.alpha_composite(img, dl)

    # Glowing dots at end of lines
    for i, w in enumerate(widths):
        y = by - 80 + i*30
        x0 = bx + 65 + w
        img = glow_dot(img, int(x0), int(y), 5, CYAN+(200,), 8)

    save(img, f"{DIRS['nav']}/research.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 5. HOME — Holographic wireframe house
# ─────────────────────────────────────────────────────────────────────────────
def gen_home():
    img = bg_with_glow(glow_r=180, glow_alpha=20)

    # House shape
    roof_top  = (CX, CY - 165)
    roof_left = (CX - 145, CY - 50)
    roof_right= (CX + 145, CY - 50)
    wall_bl   = (CX - 120, CY + 150)
    wall_br   = (CX + 120, CY + 150)

    def l(img, p1, p2, a=200, w=4):
        return draw_glow_line(img, p1, p2, CYAN+(a,), w, 14)

    # Roof
    img = l(img, roof_top, roof_left, 220, 5)
    img = l(img, roof_top, roof_right, 220, 5)
    img = l(img, roof_left, roof_right, 160, 3)

    # Walls
    img = l(img, roof_left, wall_bl, 200, 4)
    img = l(img, roof_right, wall_br, 200, 4)
    img = l(img, wall_bl, wall_br, 200, 4)

    # Subtle fill
    poly = Image.new("RGBA", (S,S), (0,0,0,0))
    ImageDraw.Draw(poly).polygon([roof_top, roof_right, wall_br, wall_bl, roof_left],
                                  fill=(0,150,220,12))
    img = Image.alpha_composite(img, poly)

    # Windows
    img = l(img, (CX-90, CY+10), (CX-20, CY+10), 180, 3)
    img = l(img, (CX-90, CY+70), (CX-20, CY+70), 180, 3)
    img = l(img, (CX-90, CY+10), (CX-90, CY+70), 180, 3)
    img = l(img, (CX-20, CY+10), (CX-20, CY+70), 180, 3)
    img = l(img, (CX-55, CY+10), (CX-55, CY+70), 120, 2)
    img = l(img, (CX-90, CY+40), (CX-20, CY+40), 120, 2)

    img = l(img, (CX+20, CY+10), (CX+90, CY+10), 180, 3)
    img = l(img, (CX+20, CY+70), (CX+90, CY+70), 180, 3)
    img = l(img, (CX+20, CY+10), (CX+20, CY+70), 180, 3)
    img = l(img, (CX+90, CY+10), (CX+90, CY+70), 180, 3)
    img = l(img, (CX+55, CY+10), (CX+55, CY+70), 120, 2)
    img = l(img, (CX+20, CY+40), (CX+90, CY+40), 120, 2)

    # Door
    img = l(img, (CX-35, CY+150), (CX-35, CY+80), 180, 3)
    img = l(img, (CX+35, CY+150), (CX+35, CY+80), 180, 3)
    img = l(img, (CX-35, CY+80), (CX+35, CY+80), 180, 3)

    # Scan lines on house
    hl = Image.new("RGBA", (S,S), (0,0,0,0))
    hd = ImageDraw.Draw(hl)
    for y in range(CY-50, CY+150, 25):
        hd.line([(CX-120, y), (CX+120, y)], fill=CYAN+(18,), width=1)
    img = Image.alpha_composite(img, hl)

    save(img, f"{DIRS['nav']}/home.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 6. BACK — Glowing curved arrow
# ─────────────────────────────────────────────────────────────────────────────
def gen_back():
    img = bg_with_glow(glow_r=180, glow_alpha=20)

    # Build arc as polyline
    pl = Image.new("RGBA", (S,S), (0,0,0,0))
    pd = ImageDraw.Draw(pl)
    pts = []
    for t in range(100):
        a = math.pi * 0.9 + (t/99) * math.pi * 1.15
        rx, ry = 155, 130
        px = CX + 20 + math.cos(a)*rx
        py = CY + 20 + math.sin(a)*ry
        pts.append((px, py))
    for i in range(len(pts)-1):
        t = i/len(pts)
        a = int(80 + t*160)
        thick = 5 + int(t*3)
        pd.line([pts[i], pts[i+1]], fill=CYAN+(a,), width=thick)
    pl = pl.filter(ImageFilter.GaussianBlur(6))
    img = Image.alpha_composite(img, pl)

    # Sharp arc on top
    pl2 = Image.new("RGBA", (S,S), (0,0,0,0))
    pd2 = ImageDraw.Draw(pl2)
    for i in range(len(pts)-1):
        a = int(140 + (i/len(pts))*80)
        pd2.line([pts[i], pts[i+1]], fill=CYAN+(a,), width=3)
    img = Image.alpha_composite(img, pl2)

    # Arrowhead at start of arc
    tip = pts[0]
    dx1, dy1 = -35, -50
    dx2, dy2 = 40, -35
    ah = Image.new("RGBA", (S,S), (0,0,0,0))
    ad = ImageDraw.Draw(ah)
    ad.line([(tip[0], tip[1]), (tip[0]+dx1, tip[1]+dy1)], fill=CYAN+(230,), width=6)
    ad.line([(tip[0], tip[1]), (tip[0]+dx2, tip[1]+dy2)], fill=CYAN+(230,), width=6)
    ah = ah.filter(ImageFilter.GaussianBlur(5))
    img = Image.alpha_composite(img, ah)

    ah2 = Image.new("RGBA", (S,S), (0,0,0,0))
    ad2 = ImageDraw.Draw(ah2)
    ad2.line([(tip[0], tip[1]), (tip[0]+dx1, tip[1]+dy1)], fill=CYAN+(255,), width=3)
    ad2.line([(tip[0], tip[1]), (tip[0]+dx2, tip[1]+dy2)], fill=CYAN+(255,), width=3)
    img = Image.alpha_composite(img, ah2)

    save(img, f"{DIRS['nav']}/back.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 7. CALIBRATION — Finger touching glowing slider
# ─────────────────────────────────────────────────────────────────────────────
def gen_calibration():
    img = bg_with_glow(glow_r=160, glow_alpha=18)

    # Bar track
    bx, by, bw, bh = CX-170, CY-18, 340, 22
    bar = Image.new("RGBA", (S,S), (0,0,0,0))
    ImageDraw.Draw(bar).rounded_rectangle([bx,by,bx+bw,by+bh], radius=11,
                                           outline=CYAN+(80,), width=2)
    bar = bar.filter(ImageFilter.GaussianBlur(2))
    img = Image.alpha_composite(img, bar)

    # Filled portion (~60%)
    fill_pct = 0.58
    fl = Image.new("RGBA", (S,S), (0,0,0,0))
    fd = ImageDraw.Draw(fl)
    fd.rounded_rectangle([bx+2, by+2, bx+int(bw*fill_pct)-2, by+bh-2],
                          radius=9, fill=CYAN+(160,))
    fl = fl.filter(ImageFilter.GaussianBlur(3))
    fl2 = Image.new("RGBA", (S,S), (0,0,0,0))
    ImageDraw.Draw(fl2).rounded_rectangle([bx+2, by+2, bx+int(bw*fill_pct)-2, by+bh-2],
                                           radius=9, fill=CYAN+(120,))
    img = Image.alpha_composite(Image.alpha_composite(img, fl), fl2)

    # Touch point
    fx = bx + int(bw*fill_pct)
    fy = by + bh//2
    for r, a in [(45,30),(30,60),(18,120),(8,255)]:
        g = radial_gradient(S, S, fx, fy, 0, r, CYAN+(a,), CYAN+(0,))
        img = Image.alpha_composite(img, g)

    # 3D hand / finger
    hand_layer = Image.new("RGBA", (S,S), (0,0,0,0))
    hd = ImageDraw.Draw(hand_layer)
    hx, hy = fx, fy + 18

    # Finger tip down
    hd.ellipse([hx-22, hy, hx+22, hy+44], fill=(160,100,70,180), outline=CYAN+(80,), width=1)
    # Finger body
    hd.rectangle([hx-18, hy+22, hx+18, hy+90], fill=(150,90,60,160))
    # Palm
    hd.polygon([(hx-70, hy+90), (hx+70, hy+90), (hx+60, hy+180), (hx-60, hy+180)],
                fill=(140,85,55,150))
    # Finger knuckle lines
    for y in [hy+50, hy+65]:
        hd.line([(hx-16, y), (hx+16, y)], fill=(100,60,40,100), width=2)

    hand_layer = hand_layer.filter(ImageFilter.GaussianBlur(2))

    # Outline glow on hand
    hand_out = Image.new("RGBA", (S,S), (0,0,0,0))
    ho = ImageDraw.Draw(hand_out)
    ho.polygon([(hx-70, hy+90),(hx+70, hy+90),(hx+60, hy+180),(hx-60, hy+180)],
                outline=CYAN+(80,), width=2)
    hand_out = hand_out.filter(ImageFilter.GaussianBlur(3))
    img = Image.alpha_composite(img, hand_layer)
    img = Image.alpha_composite(img, hand_out)

    # Down arrow above finger
    ay = hy - 40
    al = Image.new("RGBA", (S,S), (0,0,0,0))
    ImageDraw.Draw(al).line([(hx, ay-30),(hx, ay)], fill=CYAN+(200,), width=3)
    ImageDraw.Draw(al).polygon([(hx-12,ay-10),(hx+12,ay-10),(hx,ay+5)], fill=CYAN+(220,))
    al = al.filter(ImageFilter.GaussianBlur(3))
    img = Image.alpha_composite(img, al)

    save(img, f"{DIRS['interact']}/calibration.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 8. IDENTITY — Fingerprint on grid
# ─────────────────────────────────────────────────────────────────────────────
def gen_identity():
    img = Image.new("RGBA", (S,S), BG+(255,))

    # Dark card
    card = Image.new("RGBA", (S,S), (0,0,0,0))
    ImageDraw.Draw(card).rounded_rectangle([CX-195, CY-195, CX+195, CY+195],
                                            radius=22, fill=(8,14,28,255),
                                            outline=CYAN+(40,), width=2)
    img = Image.alpha_composite(img, card)

    # Grid
    gl = Image.new("RGBA", (S,S), (0,0,0,0))
    gd = ImageDraw.Draw(gl)
    for x in range(CX-195, CX+195, 26):
        gd.line([(x, CY-195), (x, CY+195)], fill=WHITE+(12,), width=1)
    for y in range(CY-195, CY+195, 26):
        gd.line([(CX-195, y), (CX+195, y)], fill=WHITE+(12,), width=1)
    img = Image.alpha_composite(img, gl)

    # Fingerprint — concentric ellipses with breaks
    fl = Image.new("RGBA", (S,S), (0,0,0,0))
    fd = ImageDraw.Draw(fl)
    rng = random.Random(5)
    for i in range(1, 11):
        rx = 14 + i*17
        ry = 16 + i*14
        # Draw arc segments with small gaps (fingerprint look)
        for seg in range(6):
            gap = rng.uniform(8, 20)
            start = seg * 60 + rng.uniform(-5, 5)
            end   = start + 60 - gap
            fd.arc([CX-rx, CY-ry, CX+rx, CY+ry],
                   int(start), int(end), fill=WHITE+(180,), width=3)
    fl = fl.filter(ImageFilter.GaussianBlur(1.5))
    img = Image.alpha_composite(img, fl)

    # Core
    for r, a in [(18,220),(10,255),(5,255)]:
        g = radial_gradient(S, S, CX, CY, 0, r, WHITE+(a,), WHITE+(0,))
        img = Image.alpha_composite(img, g)

    # Corner scan brackets
    bl = Image.new("RGBA", (S,S), (0,0,0,0))
    bd = ImageDraw.Draw(bl)
    corners = [(CX-180, CY-180), (CX+180, CY-180),
               (CX-180, CY+180), (CX+180, CY+180)]
    arm = 35
    for cx2, cy2 in corners:
        sx = 1 if cx2 < CX else -1
        sy = 1 if cy2 < CY else -1
        bd.line([(cx2, cy2), (cx2+sx*arm, cy2)], fill=CYAN+(180,), width=3)
        bd.line([(cx2, cy2), (cx2, cy2+sy*arm)], fill=CYAN+(180,), width=3)
    bl = bl.filter(ImageFilter.GaussianBlur(3))
    img = Image.alpha_composite(img, bl)

    save(img, f"{DIRS['interact']}/identity.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 9. QUANTUM ISLAND IDLE — Glass pill/capsule
# ─────────────────────────────────────────────────────────────────────────────
def gen_quantum_idle():
    img = bg_with_glow(glow_r=160, glow_alpha=20)

    # Capsule dimensions
    pw, ph = 90, 185
    # Glass body fill
    pill = Image.new("RGBA", (S,S), (0,0,0,0))
    pd = ImageDraw.Draw(pill)
    pd.rounded_rectangle([CX-pw, CY-ph, CX+pw, CY+ph], radius=pw,
                          fill=(10,50,80,45), outline=CYAN+(180,), width=4)
    pill = pill.filter(ImageFilter.GaussianBlur(2))
    img = Image.alpha_composite(img, pill)

    # Sharp outline
    pill2 = Image.new("RGBA", (S,S), (0,0,0,0))
    ImageDraw.Draw(pill2).rounded_rectangle([CX-pw, CY-ph, CX+pw, CY+ph],
                                             radius=pw, outline=CYAN+(200,), width=3)
    img = Image.alpha_composite(img, pill2)

    # Inner glow gradient
    g = radial_gradient(S, S, CX, CY-30, 0, 130, CYAN+(50,), CYAN+(0,))
    img = Image.alpha_composite(img, g)

    # Highlight shimmer top-left of pill
    hl = radial_gradient(S, S, CX-28, CY-ph+50, 0, 45, WHITE+(90,), WHITE+(0,))
    img = Image.alpha_composite(img, hl)

    # Scan lines inside capsule
    sl = Image.new("RGBA", (S,S), (0,0,0,0))
    sd = ImageDraw.Draw(sl)
    for y in range(CY-ph+10, CY+ph, 28):
        sd.line([(CX-pw+8, y), (CX+pw-8, y)], fill=CYAN+(20,), width=1)
    img = Image.alpha_composite(img, sl)

    # Floating particles around capsule
    rng = random.Random(77)
    pl = Image.new("RGBA", (S,S), (0,0,0,0))
    pd2 = ImageDraw.Draw(pl)
    for _ in range(25):
        angle = rng.uniform(0, math.pi*2)
        dist  = rng.uniform(110, 160)
        px = CX + math.cos(angle)*dist
        py = CY + math.sin(angle)*dist*(1.8)
        r = rng.uniform(1,4)
        pd2.ellipse([px-r, py-r, px+r, py+r], fill=CYAN+(rng.randint(60,180),))
    pl = pl.filter(ImageFilter.GaussianBlur(2))
    img = Image.alpha_composite(img, pl)

    save(img, f"{DIRS['interact']}/quantum-idle.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 10. NEW MEMO — Microphone in glass orb
# ─────────────────────────────────────────────────────────────────────────────
def gen_new_memo():
    img = bg_with_glow(glow_r=200, glow_alpha=25)

    # Outer glass sphere
    sphere_r = 185
    # Glass sphere body
    g = radial_gradient(S, S, CX, CY, sphere_r-40, sphere_r+20,
                        (0,30,60,180), (0,0,0,0))
    img = Image.alpha_composite(img, g)
    img = draw_glow_circle(img, CX, CY, sphere_r, CYAN+(120,), 3, 20)

    # Inner sphere glow
    g2 = radial_gradient(S, S, CX, CY, 0, sphere_r-30, CYAN+(15,), CYAN+(0,))
    img = Image.alpha_composite(img, g2)

    # Sphere highlight
    hl = radial_gradient(S, S, CX-60, CY-70, 0, 70, WHITE+(80,), WHITE+(0,))
    img = Image.alpha_composite(img, hl)

    # Microphone capsule (rounded rect)
    ml = Image.new("RGBA", (S,S), (0,0,0,0))
    md = ImageDraw.Draw(ml)
    mw, mh = 55, 115
    mx1, my1 = CX-mw, CY-130
    mx2, my2 = CX+mw, CY-130+mh
    md.rounded_rectangle([mx1, my1, mx2, my2], radius=mw,
                          fill=(15,80,120,100), outline=CYAN+(200,), width=4)
    ml = ml.filter(ImageFilter.GaussianBlur(2))
    ml2 = Image.new("RGBA", (S,S), (0,0,0,0))
    ImageDraw.Draw(ml2).rounded_rectangle([mx1, my1, mx2, my2], radius=mw,
                                           outline=CYAN+(220,), width=3)
    img = Image.alpha_composite(Image.alpha_composite(img, ml), ml2)

    # Mic body lines (horizontal strips)
    for y in range(my1+20, my2-20, 20):
        ll = Image.new("RGBA", (S,S), (0,0,0,0))
        ImageDraw.Draw(ll).line([(mx1+8, y), (mx2-8, y)], fill=CYAN+(50,), width=1)
        img = Image.alpha_composite(img, ll)

    # Stand arc
    stand_r = 90
    al = Image.new("RGBA", (S,S), (0,0,0,0))
    ad = ImageDraw.Draw(al)
    ad.arc([CX-stand_r, my2-20, CX+stand_r, my2+90], 0, 180, fill=CYAN+(200,), width=4)
    al = al.filter(ImageFilter.GaussianBlur(5))
    img = Image.alpha_composite(img, al)
    al2 = Image.new("RGBA", (S,S), (0,0,0,0))
    ImageDraw.Draw(al2).arc([CX-stand_r, my2-20, CX+stand_r, my2+90],
                             0, 180, fill=CYAN+(200,), width=3)
    img = Image.alpha_composite(img, al2)

    # Pole and base
    img = draw_glow_line(img, (CX, my2+35), (CX, my2+95), CYAN+(200,), 4, 8)
    img = draw_glow_line(img, (CX-50, my2+95), (CX+50, my2+95), CYAN+(180,), 4, 10)

    save(img, f"{DIRS['create']}/new-memo.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 11. SAVE — Download arrow into glowing cylinder
# ─────────────────────────────────────────────────────────────────────────────
def gen_save():
    img = bg_with_glow(glow_r=180, glow_alpha=22)

    # Cylinder
    cw, ch = 130, 80
    cy_top = CY + 30
    cy_bot = cy_top + 110

    # Cylinder top ellipse
    img = draw_glow_arc(img, [CX-cw, cy_top-ch//2, CX+cw, cy_top+ch//2],
                        0, 360, CYAN+(180,), 4, 16)
    # Fill top
    ell = Image.new("RGBA", (S,S), (0,0,0,0))
    ImageDraw.Draw(ell).ellipse([CX-cw, cy_top-ch//2, CX+cw, cy_top+ch//2],
                                 fill=(0,50,100,60))
    img = Image.alpha_composite(img, ell)

    # Cylinder body
    img = draw_glow_line(img, (CX-cw, cy_top), (CX-cw, cy_bot), CYAN+(150,), 4, 12)
    img = draw_glow_line(img, (CX+cw, cy_top), (CX+cw, cy_bot), CYAN+(150,), 4, 12)

    # Cylinder bottom ellipse
    img = draw_glow_arc(img, [CX-cw, cy_bot-ch//2, CX+cw, cy_bot+ch//2],
                        0, 360, CYAN+(180,), 4, 16)
    # Side fill
    side = Image.new("RGBA", (S,S), (0,0,0,0))
    sd = ImageDraw.Draw(side)
    sd.rectangle([CX-cw, cy_top, CX+cw, cy_bot], fill=(0,30,70,40))
    img = Image.alpha_composite(img, side)

    # Scan lines on cylinder
    for y in range(cy_top+15, cy_bot, 22):
        sl = Image.new("RGBA", (S,S), (0,0,0,0))
        ImageDraw.Draw(sl).line([(CX-cw+4, y), (CX+cw-4, y)], fill=CYAN+(18,), width=1)
        img = Image.alpha_composite(img, sl)

    # Down arrow
    arrow_top = CY - 185
    arrow_bot = cy_top - 20
    img = draw_glow_line(img, (CX, arrow_top), (CX, arrow_bot), CYAN+(230,), 6, 14)

    # Arrowhead
    ah = Image.new("RGBA", (S,S), (0,0,0,0))
    ad = ImageDraw.Draw(ah)
    aw = 50
    ad.polygon([(CX-aw, arrow_bot-28),(CX+aw, arrow_bot-28),(CX, arrow_bot+5)],
                fill=CYAN+(240,))
    ah = ah.filter(ImageFilter.GaussianBlur(4))
    img = Image.alpha_composite(img, ah)
    ah2 = Image.new("RGBA", (S,S), (0,0,0,0))
    ImageDraw.Draw(ah2).polygon([(CX-aw, arrow_bot-28),(CX+aw, arrow_bot-28),(CX, arrow_bot+5)],
                                 fill=CYAN+(220,))
    img = Image.alpha_composite(img, ah2)

    # Particle dots above arrow
    for dx in [-55, -20, 20, 55]:
        img = glow_dot(img, CX+dx, arrow_top-25, 8, CYAN+(220,), 12)

    save(img, f"{DIRS['create']}/save.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 12. CREATE ENTRY — Glowing plus with corner brackets
# ─────────────────────────────────────────────────────────────────────────────
def gen_create_entry():
    img = bg_with_glow(glow_r=180, glow_alpha=20)

    arm = 145
    thick = 22

    # Glow layers for plus
    for blur, width, a in [(28, thick+16, 60), (16, thick+8, 100), (8, thick+2, 200)]:
        pl = Image.new("RGBA", (S,S), (0,0,0,0))
        pd = ImageDraw.Draw(pl)
        pd.line([(CX-arm, CY), (CX+arm, CY)], fill=CYAN+(a,), width=width)
        pd.line([(CX, CY-arm), (CX, CY+arm)], fill=CYAN+(a,), width=width)
        pl = pl.filter(ImageFilter.GaussianBlur(blur))
        img = Image.alpha_composite(img, pl)

    # Core plus
    core = Image.new("RGBA", (S,S), (0,0,0,0))
    ImageDraw.Draw(core).line([(CX-arm, CY), (CX+arm, CY)], fill=CYAN+(255,), width=thick)
    ImageDraw.Draw(core).line([(CX, CY-arm), (CX, CY+arm)], fill=CYAN+(255,), width=thick)
    img = Image.alpha_composite(img, core)

    # Corner brackets
    bd = 175
    barm = 45
    corners = [(CX-bd, CY-bd), (CX+bd, CY-bd),
               (CX-bd, CY+bd), (CX+bd, CY+bd)]
    bl = Image.new("RGBA", (S,S), (0,0,0,0))
    bld = ImageDraw.Draw(bl)
    for cx2, cy2 in corners:
        sx = 1 if cx2 < CX else -1
        sy = 1 if cy2 < CY else -1
        bld.line([(cx2, cy2), (cx2+sx*barm, cy2)], fill=CYAN+(200,), width=4)
        bld.line([(cx2, cy2), (cx2, cy2+sy*barm)], fill=CYAN+(200,), width=4)
        bld.ellipse([cx2-8,cy2-8,cx2+8,cy2+8], fill=CYAN+(200,))
    bl = bl.filter(ImageFilter.GaussianBlur(4))
    img = Image.alpha_composite(img, bl)

    bl2 = Image.new("RGBA", (S,S), (0,0,0,0))
    bl2d = ImageDraw.Draw(bl2)
    for cx2, cy2 in corners:
        sx = 1 if cx2 < CX else -1
        sy = 1 if cy2 < CY else -1
        bl2d.line([(cx2, cy2), (cx2+sx*barm, cy2)], fill=CYAN+(230,), width=3)
        bl2d.line([(cx2, cy2), (cx2, cy2+sy*barm)], fill=CYAN+(230,), width=3)
    img = Image.alpha_composite(img, bl2)

    save(img, f"{DIRS['create']}/create-entry.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 13. LISTENING — Sound wave bars in glass cube
# ─────────────────────────────────────────────────────────────────────────────
def gen_listening():
    img = bg_with_glow(glow_r=170, glow_alpha=18)

    # Glass cube frame
    cx2 = CX; cy2 = CY
    hw = 175; hh = 155; off = 55

    front = [(cx2-hw, cy2-hh), (cx2+hw, cy2-hh), (cx2+hw, cy2+hh), (cx2-hw, cy2+hh)]
    back  = [(p[0]+off, p[1]-off) for p in front]

    def edge(img, p1, p2, a=100, w=2):
        return draw_glow_line(img, p1, p2, CYAN+(a,), w, 10)

    for i in range(4):
        img = edge(img, back[i], back[(i+1)%4], 60, 2)
    for i in range(4):
        img = edge(img, front[i], back[i], 80, 2)
    for i in range(4):
        img = edge(img, front[i], front[(i+1)%4], 150, 3)

    # Glass fill
    gf = Image.new("RGBA", (S,S), (0,0,0,0))
    ImageDraw.Draw(gf).polygon(front, fill=(0,80,140,18))
    img = Image.alpha_composite(img, gf)

    # Sound wave bars
    bar_heights = [55, 88, 115, 145, 100, 145, 115, 88, 55]
    n = len(bar_heights)
    bw2 = 22; gap = 14
    total_w = n * (bw2+gap) - gap
    sx = cx2 - total_w//2

    for i, bh2 in enumerate(bar_heights):
        x = sx + i*(bw2+gap)
        y_top = cy2 - bh2//2
        y_bot = cy2 + bh2//2
        is_center = (i == n//2)

        # Gradient bar
        bl = Image.new("RGBA", (S,S), (0,0,0,0))
        bd = ImageDraw.Draw(bl)
        if is_center:
            top_col = (150, 80, 255, 220)
            bot_col = (80, 0, 200, 160)
        else:
            top_col = (0, 200, 255, 200)
            bot_col = (0, 80, 200, 130)
        for yy in range(y_top, y_bot):
            t = (yy - y_top) / max(bh2, 1)
            r2 = int(top_col[0]*(1-t) + bot_col[0]*t)
            g2 = int(top_col[1]*(1-t) + bot_col[1]*t)
            b2 = int(top_col[2]*(1-t) + bot_col[2]*t)
            a2 = int(top_col[3]*(1-t) + bot_col[3]*t)
            bd.line([(x, yy), (x+bw2, yy)], fill=(r2,g2,b2,a2), width=1)

        bl = bl.filter(ImageFilter.GaussianBlur(2))
        img = Image.alpha_composite(img, bl)

    save(img, f"{DIRS['state']}/listening.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 14. PROCESSING — Galaxy vortex spiral
# ─────────────────────────────────────────────────────────────────────────────
def gen_processing():
    img = bg_with_glow(glow_r=200, glow_alpha=25)

    rng = random.Random(33)

    # Multiple spiral arms (galaxy-like)
    for arm in range(4):
        base = arm * (math.pi / 2)
        pl = Image.new("RGBA", (S,S), (0,0,0,0))
        pd = ImageDraw.Draw(pl)
        pts = []
        for t in range(150):
            tt = t/149
            angle = base + tt * math.pi * 2.5
            r = 10 + tt**0.7 * 210
            px = CX + math.cos(angle)*r
            py = CY + math.sin(angle)*r
            pts.append((px, py))
        for i in range(len(pts)-1):
            t2 = i/len(pts)
            a2 = int(30 + t2*200)
            pd.line([pts[i], pts[i+1]], fill=CYAN+(a2,), width=max(1,int(4-t2*2)))
        pl = pl.filter(ImageFilter.GaussianBlur(4))
        img = Image.alpha_composite(img, pl)

    # Particle cloud
    pl2 = Image.new("RGBA", (S,S), (0,0,0,0))
    pd2 = ImageDraw.Draw(pl2)
    for _ in range(120):
        a3 = rng.uniform(0, math.pi*2)
        d  = rng.uniform(8, 215)
        px = CX + math.cos(a3)*d
        py = CY + math.sin(a3)*d
        r2 = rng.uniform(0.8, 4)
        pd2.ellipse([px-r2,py-r2,px+r2,py+r2], fill=CYAN+(rng.randint(80,220),))
    pl2 = pl2.filter(ImageFilter.GaussianBlur(1.5))
    img = Image.alpha_composite(img, pl2)

    # Outer ring
    img = draw_glow_circle(img, CX, CY, 215, CYAN+(80,), 2, 20)

    # Core
    for r, a in [(35,200),(20,240),(8,255)]:
        g = radial_gradient(S, S, CX, CY, 0, r, CYAN+(a,), CYAN+(0,))
        img = Image.alpha_composite(img, g)
    g2 = radial_gradient(S, S, CX, CY, 0, 10, WHITE+(255,), WHITE+(0,))
    img = Image.alpha_composite(img, g2)

    save(img, f"{DIRS['state']}/processing.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 15. GRAB — 3D Hand holding glowing orb
# ─────────────────────────────────────────────────────────────────────────────
def gen_grab():
    img = bg_with_glow(glow_r=180, glow_alpha=20)

    hx, hy = CX + 30, CY + 10

    # Floating glow particle (being grabbed)
    fx, fy = CX - 150, CY - 100
    for r, a in [(70,20),(50,40),(30,80),(15,150),(6,255)]:
        g = radial_gradient(S, S, fx, fy, 0, r, CYAN+(a,), CYAN+(0,))
        img = Image.alpha_composite(img, g)
    img = glow_dot(img, fx, fy, 8, WHITE+(230,), 12)

    # Particle trail from orb to hand
    rng = random.Random(88)
    for _ in range(20):
        t = rng.uniform(0, 1)
        tx = int(fx + (hx-fx)*t + rng.uniform(-20,20))
        ty = int(fy + (hy-fy)*t + rng.uniform(-20,20))
        r = rng.uniform(1, 4)
        img = glow_dot(img, tx, ty, int(r), CYAN+(rng.randint(60,160),), 6)

    # Hand — stylized 3D
    hand_l = Image.new("RGBA", (S,S), (0,0,0,0))
    hd = ImageDraw.Draw(hand_l)

    # Palm
    palm_pts = [(hx-95, hy+20),(hx-90, hy+110),(hx-50, hy+165),
                (hx+60, hy+165),(hx+105, hy+110),(hx+105, hy+20)]
    hd.polygon(palm_pts, fill=(120,75,50,190), outline=CYAN+(80,), width=2)

    # Fingers (4)
    for i, (fx2, fw) in enumerate([(hx-80,28),(hx-40,28),(hx+5,28),(hx+50,26)]):
        tip_y = hy - 80 - (i%2)*20
        hd.rounded_rectangle([fx2, tip_y, fx2+fw, hy+25], radius=fw//2,
                               fill=(130,82,55,185), outline=CYAN+(60,), width=1)

    # Thumb
    hd.ellipse([hx-130, hy-30, hx-75, hy+55], fill=(125,78,52,180), outline=CYAN+(50,))

    hand_l = hand_l.filter(ImageFilter.GaussianBlur(1.5))
    img = Image.alpha_composite(img, hand_l)

    # Glow outline on hand
    out_l = Image.new("RGBA", (S,S), (0,0,0,0))
    od = ImageDraw.Draw(out_l)
    od.polygon(palm_pts, outline=CYAN+(100,), width=2)
    out_l = out_l.filter(ImageFilter.GaussianBlur(4))
    img = Image.alpha_composite(img, out_l)

    save(img, f"{DIRS['state']}/grab.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 16. DATA AGE — Particle cloud dispersion
# ─────────────────────────────────────────────────────────────────────────────
def gen_data_age():
    img = bg_with_glow(glow_r=160, glow_alpha=15)

    rng = random.Random(11)
    pl = Image.new("RGBA", (S,S), (0,0,0,0))
    pd = ImageDraw.Draw(pl)
    for i in range(350):
        t = i/350
        # Denser near center, sparser + bluer outward
        dist = rng.betavariate(1.2, 1.5) * 220
        angle = rng.uniform(0, math.pi*2)
        px = CX + math.cos(angle)*dist
        py = CY + math.sin(angle)*dist*0.9
        r = max(0.5, (1-t)*7 + rng.uniform(0,2))
        a = int((1-t)*210 + 20)
        # Color shift: white-cyan near center, blue outward
        blue_t = min(1, dist/180)
        rc = int(0*(1-blue_t) + 0*blue_t)
        gc = int(200*(1-blue_t) + 100*blue_t)
        bc = int(255*(1-blue_t) + 200*blue_t)
        pd.ellipse([px-r, py-r, px+r, py+r], fill=(rc,gc,bc,a))
    pl = pl.filter(ImageFilter.GaussianBlur(1))
    img = Image.alpha_composite(img, pl)

    # Dense bright core
    for r, a in [(30,180),(18,220),(8,255)]:
        g = radial_gradient(S, S, CX, CY, 0, r, WHITE+(a,), WHITE+(0,))
        img = Image.alpha_composite(img, g)

    save(img, f"{DIRS['data']}/data-age.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 17. ITEM IMPORTANCE — Starburst explosion
# ─────────────────────────────────────────────────────────────────────────────
def gen_item_importance():
    img = bg_with_glow(glow_r=200, glow_alpha=20)

    rng = random.Random(22)

    # Ray bursts
    rays = 12
    pl = Image.new("RGBA", (S,S), (0,0,0,0))
    pd = ImageDraw.Draw(pl)
    for i in range(rays):
        angle = i * (math.pi*2/rays)
        inner = 30
        outer = 155 + (i%2)*45
        width = 8 - (i%2)*3
        x1 = CX + math.cos(angle)*inner; y1 = CY + math.sin(angle)*inner
        x2 = CX + math.cos(angle)*outer; y2 = CY + math.sin(angle)*outer
        a = 180 + (i%2)*60
        pd.line([(x1,y1),(x2,y2)], fill=CYAN+(a,), width=width)
    pl = pl.filter(ImageFilter.GaussianBlur(8))
    img = Image.alpha_composite(img, pl)

    # Sharp rays on top
    pl2 = Image.new("RGBA", (S,S), (0,0,0,0))
    pd2 = ImageDraw.Draw(pl2)
    for i in range(rays):
        angle = i*(math.pi*2/rays)
        inner, outer = 30, 155+(i%2)*45
        x1 = CX+math.cos(angle)*inner; y1 = CY+math.sin(angle)*inner
        x2 = CX+math.cos(angle)*outer; y2 = CY+math.sin(angle)*outer
        pd2.line([(x1,y1),(x2,y2)], fill=CYAN+(220,), width=max(1,4-(i%2)*2))
    img = Image.alpha_composite(img, pl2)

    # Spark flares at ray tips
    for i in range(rays):
        angle = i*(math.pi*2/rays)
        outer = 155+(i%2)*45
        tx = int(CX + math.cos(angle)*outer)
        ty = int(CY + math.sin(angle)*outer)
        img = glow_dot(img, tx, ty, 10, CYAN+(220,), 15)

    # Core explosion
    for r, col, a in [(80, CYAN, 60),(55, CYAN, 100),(30, WHITE, 160),
                      (15, WHITE, 230),(6, WHITE, 255)]:
        g = radial_gradient(S, S, CX, CY, 0, r, col+(a,), col+(0,))
        img = Image.alpha_composite(img, g)

    # Particle sparks
    pl3 = Image.new("RGBA", (S,S), (0,0,0,0))
    pd3 = ImageDraw.Draw(pl3)
    for _ in range(40):
        a2 = rng.uniform(0, math.pi*2)
        d  = rng.uniform(50, 180)
        px, py = CX+math.cos(a2)*d, CY+math.sin(a2)*d
        r2 = rng.uniform(1, 4)
        pd3.ellipse([px-r2,py-r2,px+r2,py+r2], fill=CYAN+(rng.randint(120,255),))
    pl3 = pl3.filter(ImageFilter.GaussianBlur(1.5))
    img = Image.alpha_composite(img, pl3)

    save(img, f"{DIRS['data']}/item-importance.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 18. GESTURE TRAIL — Gloved hand with motion streak
# ─────────────────────────────────────────────────────────────────────────────
def gen_gesture_trail():
    img = bg_with_glow(glow_r=170, glow_alpha=18)

    # Motion trail (sweeping from left)
    tl = Image.new("RGBA", (S,S), (0,0,0,0))
    td = ImageDraw.Draw(tl)
    trail_pts = []
    for t in range(80):
        tt = t/79
        tx = int(CX - 200 + tt*200)
        ty = int(CY + 10 + math.sin(tt*math.pi)*30)
        trail_pts.append((tx, ty))

    for i, (tx, ty) in enumerate(trail_pts):
        t2 = i/len(trail_pts)
        r2 = int(2 + t2*25)
        a2 = int(t2*160)
        td.ellipse([tx-r2, ty-r2, tx+r2, ty+r2], fill=CYAN+(a2,))
    tl = tl.filter(ImageFilter.GaussianBlur(5))
    img = Image.alpha_composite(img, tl)

    # Trail sparkles
    rng = random.Random(44)
    sp = Image.new("RGBA", (S,S), (0,0,0,0))
    sd = ImageDraw.Draw(sp)
    for tx, ty in trail_pts[40:]:
        if rng.random() > 0.5:
            r3 = rng.uniform(2,6)
            sd.ellipse([tx-r3,ty-r3,tx+r3,ty+r3], fill=CYAN+(rng.randint(100,220),))
    sp = sp.filter(ImageFilter.GaussianBlur(2))
    img = Image.alpha_composite(img, sp)

    # Gloved hand (right side)
    hx, hy = CX + 50, CY

    hl = Image.new("RGBA", (S,S), (0,0,0,0))
    hd = ImageDraw.Draw(hl)
    # Glove color - slightly blue-tinted dark
    glove_col = (30, 50, 70, 200)
    glove_out = CYAN + (100,)

    # Palm
    hd.polygon([(hx-75, hy+15),(hx-70, hy+105),(hx-30, hy+155),
                (hx+55, hy+155),(hx+100, hy+105),(hx+100, hy+15)],
                fill=glove_col, outline=glove_out, width=2)

    # Fingers
    for i, (fx2, fw2, tip) in enumerate([
        (hx-65, 26, hy-90), (hx-30, 28, hy-110), (hx+10, 28, hy-108),
        (hx+52, 26, hy-88)]):
        hd.rounded_rectangle([fx2, tip, fx2+fw2, hy+15], radius=13,
                               fill=glove_col, outline=glove_out, width=2)

    # Thumb
    hd.ellipse([hx-115, hy-20, hx-62, hy+55], fill=glove_col, outline=glove_out, width=2)

    # Highlight sheen on glove
    hl2 = Image.new("RGBA", (S,S), (0,0,0,0))
    hl2d = ImageDraw.Draw(hl2)
    hl2d.polygon([(hx-30, hy-100),(hx+10, hy-108),(hx+10, hy-50),(hx-30, hy-50)],
                  fill=(0,200,255,25))

    hl = hl.filter(ImageFilter.GaussianBlur(1))
    img = Image.alpha_composite(img, hl)
    img = Image.alpha_composite(img, hl2)

    save(img, f"{DIRS['data']}/gesture-trail.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 19. HAPTIC MORSE — Dots and dashes
# ─────────────────────────────────────────────────────────────────────────────
def gen_haptic_morse():
    img = bg_with_glow(glow_r=150, glow_alpha=15)

    # SOS morse: . . .  - - -  . . .
    pattern = ["d","d","d","s","d","s","-","-","-","s","d","s","d","d","d"]
    dot_r = 18; dash_w = 70; dash_h = 35; gap = 22

    # Calculate total width
    items = [p for p in pattern if p != "s"]
    total = 0
    for p in items:
        total += dot_r*2 if p == "d" else dash_w
    total += gap * (len(items)-1)

    x = CX - total//2

    pl = Image.new("RGBA", (S,S), (0,0,0,0))
    pd = ImageDraw.Draw(pl)

    def draw_symbol(x, sym):
        if sym == "d":
            pd.ellipse([x, CY-dot_r, x+dot_r*2, CY+dot_r], fill=CYAN+(230,))
            return x + dot_r*2 + gap
        elif sym == "-":
            pd.rounded_rectangle([x, CY-dash_h//2, x+dash_w, CY+dash_h//2],
                                   radius=dash_h//2, fill=CYAN+(220,))
            return x + dash_w + gap
        return x

    spacing_x = x
    for sym in items:
        spacing_x = draw_symbol(int(spacing_x), sym)

    pl = pl.filter(ImageFilter.GaussianBlur(5))
    img = Image.alpha_composite(img, pl)

    # Sharp pass
    pl2 = Image.new("RGBA", (S,S), (0,0,0,0))
    pd2 = ImageDraw.Draw(pl2)
    spacing_x = x
    for sym in items:
        if sym == "d":
            pd2.ellipse([spacing_x, CY-dot_r, spacing_x+dot_r*2, CY+dot_r], fill=CYAN+(210,))
            spacing_x += dot_r*2 + gap
        elif sym == "-":
            pd2.rounded_rectangle([spacing_x, CY-dash_h//2, spacing_x+dash_w, CY+dash_h//2],
                                    radius=dash_h//2, fill=CYAN+(200,))
            spacing_x += dash_w + gap
    img = Image.alpha_composite(img, pl2)

    # Ripple rings
    for r, a in [(80,25),(115,18),(150,12)]:
        img = draw_glow_circle(img, CX, CY, r, CYAN+(a,), 1, 8)

    # vibration lines
    for dy in [-70, 70]:
        vl = Image.new("RGBA", (S,S), (0,0,0,0))
        vd = ImageDraw.Draw(vl)
        pts = []
        for t in range(40):
            tt = t/39
            vx = CX - 200 + tt*400
            vy = CY + dy + math.sin(tt*math.pi*6)*12
            pts.append((vx, vy))
        for i in range(len(pts)-1):
            vd.line([pts[i], pts[i+1]], fill=CYAN+(50,), width=1)
        vl = vl.filter(ImageFilter.GaussianBlur(2))
        img = Image.alpha_composite(img, vl)

    save(img, f"{DIRS['data']}/haptic-morse.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 20. ADAPTIVE ICON (Android)
# ─────────────────────────────────────────────────────────────────────────────
def gen_adaptive_icon():
    img = Image.new("RGBA", (S, S), (0,0,0,255))
    g = radial_gradient(S, S, CX, CY, 0, S*0.6,
                        (10,22,48,255), (0,0,0,255))
    img = Image.alpha_composite(img, g)

    img = scatter_particles(img, 150, 12, 120, 1.5)

    rng = random.Random(55)
    for arm in range(4):
        base = arm*(math.pi/2)
        pl = Image.new("RGBA", (S,S), (0,0,0,0))
        pd = ImageDraw.Draw(pl)
        pts = []
        for t in range(100):
            tt = t/99
            angle = base + tt*math.pi*2
            r = 12 + tt*170
            pts.append((CX+math.cos(angle)*r, CY+math.sin(angle)*r))
        for i in range(len(pts)-1):
            t2 = i/len(pts)
            pd.line([pts[i],pts[i+1]], fill=CYAN+(int(30+t2*180),), width=max(1,int(3-t2)))
        pl = pl.filter(ImageFilter.GaussianBlur(3))
        img = Image.alpha_composite(img, pl)

    for r, a in [(160,50),(120,70),(85,90),(55,120)]:
        img = draw_glow_circle(img, CX, CY, r, CYAN+(a,), 2, 14)

    for r, col, a in [(45,CYAN,120),(25,CYAN,200),(12,WHITE,230),(5,WHITE,255)]:
        g = radial_gradient(S, S, CX, CY, 0, r, col+(a,), col+(0,))
        img = Image.alpha_composite(img, g)

    save(img, f"{DIRS['app']}/adaptive-icon.png")

    # 1024 version
    big = img.resize((1024,1024), Image.LANCZOS)
    save(big, f"{DIRS['app']}/adaptive-icon-1024.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 21. FAVICON
# ─────────────────────────────────────────────────────────────────────────────
def gen_favicon():
    sz = 96
    img = Image.new("RGBA", (sz,sz), (0,0,0,255))
    g = radial_gradient(sz, sz, sz//2, sz//2, 0, sz*0.6, CYAN+(60,), CYAN+(0,))
    img = Image.alpha_composite(img, g)
    f = Image.new("RGBA", (sz,sz), (0,0,0,0))
    ImageDraw.Draw(f).text((sz//2-10, sz//2-14), "N", fill=CYAN+(240,),
                             font=fnt(42))
    f = f.filter(ImageFilter.GaussianBlur(2))
    img = Image.alpha_composite(img, f)
    save(img, f"{DIRS['app']}/favicon.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 22. NOTIFICATION ICON
# ─────────────────────────────────────────────────────────────────────────────
def gen_notification_icon():
    sz = 192
    img = Image.new("RGBA", (sz,sz), (0,0,0,0))
    ImageDraw.Draw(img).text((sz//2-18, sz//2-28), "N",
                              fill=WHITE+(255,), font=fnt(100))
    save(img, f"{DIRS['app']}/notification-icon.png")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# 23. FULL SCREEN SPLASH  1284 x 2778
# ─────────────────────────────────────────────────────────────────────────────
def gen_splash():
    W, H = 1284, 2778
    img = Image.new("RGBA", (W, H), (0, 0, 0, 255))

    # Gradient bg
    bg = radial_gradient(W, H, W//2, H//2, 0, H*0.6,
                         (8, 18, 40, 255), (0,0,0,255))
    img = Image.alpha_composite(img, bg)

    # Star field
    img = scatter_particles(img, 400, 99, 160, 1.5)

    cx, cy = W//2, H//2

    # Outer vortex rings
    for r, a in [(500,30),(420,45),(340,60),(265,80),(195,100),(130,130)]:
        img = draw_glow_circle(img, cx, cy, r, CYAN+(a,), 3, 25)

    # Spiral vortex
    rng = random.Random(42)
    for arm in range(6):
        base = arm * (math.pi / 3)
        pl = Image.new("RGBA", (W,H), (0,0,0,0))
        pd = ImageDraw.Draw(pl)
        pts = []
        for t in range(200):
            tt = t/199
            angle = base + tt*math.pi*2.5
            r = 20 + tt**0.6 * 480
            pts.append((cx+math.cos(angle)*r, cy+math.sin(angle)*r))
        for i in range(len(pts)-1):
            t2 = i/len(pts)
            a2 = int(20 + t2*160)
            pd.line([pts[i], pts[i+1]], fill=CYAN+(a2,), width=max(1,int(5-t2*3)))
        pl = pl.filter(ImageFilter.GaussianBlur(4))
        img = Image.alpha_composite(img, pl)

    # Particle field around vortex
    pl2 = Image.new("RGBA", (W,H), (0,0,0,0))
    pd2 = ImageDraw.Draw(pl2)
    for _ in range(300):
        a3 = rng.uniform(0, math.pi*2)
        d  = rng.uniform(50, 480)
        px = cx + math.cos(a3)*d
        py = cy + math.sin(a3)*d
        r2 = rng.uniform(1, 5)
        pd2.ellipse([px-r2,py-r2,px+r2,py+r2], fill=CYAN+(rng.randint(60,200),))
    pl2 = pl2.filter(ImageFilter.GaussianBlur(2))
    img = Image.alpha_composite(img, pl2)

    # Core
    for r, col, a in [(200,CYAN,80),(120,CYAN,140),(60,WHITE,180),(25,WHITE,240),(8,WHITE,255)]:
        g = radial_gradient(W, H, cx, cy, 0, r, col+(a,), col+(0,))
        img = Image.alpha_composite(img, g)

    # NEXVAULT text
    f1 = fnt(140, True)
    f2 = fnt(44, False)
    f3 = fnt(32, False)

    # Text glow
    tl = Image.new("RGBA", (W,H), (0,0,0,0))
    td = ImageDraw.Draw(tl)
    text = "NEXVAULT"
    bbox = td.textbbox((0,0), text, font=f1)
    tw = bbox[2]-bbox[0]
    tx = cx - tw//2
    ty = cy + 430

    td.text((tx, ty), text, fill=WHITE+(240,), font=f1)
    tl_blur = tl.filter(ImageFilter.GaussianBlur(15))
    img = Image.alpha_composite(img, tl_blur)

    # Sharp text
    tl2 = Image.new("RGBA", (W,H), (0,0,0,0))
    ImageDraw.Draw(tl2).text((tx, ty), text, fill=WHITE+(255,), font=f1)
    img = Image.alpha_composite(img, tl2)

    # Tagline
    tag = "Quantum Spatial Research Interface"
    tl3 = Image.new("RGBA", (W,H), (0,0,0,0))
    td3 = ImageDraw.Draw(tl3)
    bbox2 = td3.textbbox((0,0), tag, font=f2)
    tw2 = bbox2[2]-bbox2[0]
    td3.text((cx - tw2//2, ty+155), tag, fill=CYAN+(140,), font=f2)
    img = Image.alpha_composite(img, tl3)

    # Watermark
    wm = "✦  NexVault  ✦"
    tl4 = Image.new("RGBA", (W,H), (0,0,0,0))
    td4 = ImageDraw.Draw(tl4)
    bbox3 = td4.textbbox((0,0), wm, font=f3)
    tw3 = bbox3[2]-bbox3[0]
    td4.text((cx-tw3//2, H-100), wm, fill=CYAN+(70,), font=f3)
    img = Image.alpha_composite(img, tl4)

    # Also a centered version for expo-splash-screen (square-ish safe zone)
    splash_icon = img.crop((cx-400, cy-400, cx+400, cy+400)).resize((512,512), Image.LANCZOS)
    save(splash_icon, f"{DIRS['app']}/splash-icon.png", "Splash center icon")

    save(img, f"{DIRS['splash']}/splash.png", "Full splash 1284x2778")
    save(img, f"{DIRS['app']}/splash.png", "Full splash copy")
    return img

# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n╔══════════════════════════════════════════════╗")
    print("║   NexVault 3D Icon Generator — All Assets   ║")
    print("╚══════════════════════════════════════════════╝\n")

    print("── App Icons ─────────────────────────────────")
    gen_app_icon()
    gen_adaptive_icon()
    gen_quantum_sphere()
    gen_favicon()
    gen_notification_icon()

    print("\n── Navigation Icons ──────────────────────────")
    gen_vault()
    gen_research()
    gen_home()
    gen_back()

    print("\n── Interaction Icons ─────────────────────────")
    gen_calibration()
    gen_identity()
    gen_quantum_idle()

    print("\n── Creation Icons ────────────────────────────")
    gen_new_memo()
    gen_save()
    gen_create_entry()

    print("\n── State Icons ───────────────────────────────")
    gen_listening()
    gen_processing()
    gen_grab()

    print("\n── Data / Visual Icons ───────────────────────")
    gen_data_age()
    gen_item_importance()
    gen_gesture_trail()
    gen_haptic_morse()

    print("\n── Splash Screens ────────────────────────────")
    gen_splash()

    print("\n╔══════════════════════════════════════════════╗")
    print("║  ✓  21 icons + splash screens generated!    ║")
    print("╚══════════════════════════════════════════════╝")
    print(f"\nOutput: {BASE}/")
    print("  app/           → icon, adaptive-icon, quantum-sphere, favicon,")
    print("                    notification-icon, splash, splash-icon")
    print("  icons/nav/     → vault, research, home, back")
    print("  icons/create/  → new-memo, save, create-entry")
    print("  icons/interact/→ calibration, identity, quantum-idle")
    print("  icons/state/   → listening, processing, grab")
    print("  icons/data/    → data-age, item-importance, gesture-trail, haptic-morse")
    print("  splash/        → splash.png (1284x2778)\n")
    print("app.json paths:")
    print('  "icon": "./nexvault-assets/app/icon.png"')
    print('  "splash.image": "./nexvault-assets/app/splash-icon.png"')
    print('  "android.adaptiveIcon.foregroundImage": "./nexvault-assets/app/adaptive-icon.png"')
