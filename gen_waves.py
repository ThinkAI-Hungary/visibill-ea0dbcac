import math, random

random.seed(42)

lines = []

# Helper: generate a wave path with given params
def wave_path(y_center, amplitude, frequency, phase, x_start=-100, x_end=2020, points=8):
    """Generate cubic bezier wave path string"""
    step = (x_end - x_start) / (points - 1)
    pts = []
    for i in range(points):
        x = x_start + i * step
        y = y_center + amplitude * math.sin(frequency * (x / 1920 * math.pi * 2) + phase)
        pts.append((x, y))
    
    # Build SVG path with cubic beziers
    d = f"M{pts[0][0]:.0f},{pts[0][1]:.0f}"
    for i in range(1, len(pts)):
        # Simple smooth curve through points
        x0, y0 = pts[i-1]
        x1, y1 = pts[i]
        cx1 = x0 + (x1 - x0) * 0.4
        cx2 = x1 - (x1 - x0) * 0.4
        # Add some curvature
        cy1 = y0 + (y1 - y0) * 0.1
        cy2 = y1 - (y1 - y0) * 0.1
        d += f" C{cx1:.0f},{cy1:.0f} {cx2:.0f},{cy2:.0f} {x1:.0f},{y1:.0f}"
    return d

def wave_path_anim(y_center, amplitude, frequency, phase, amp_delta=20, phase_delta=0.3):
    """Generate path + animated variant"""
    d1 = wave_path(y_center, amplitude, frequency, phase)
    d2 = wave_path(y_center, amplitude - amp_delta, frequency, phase + phase_delta)
    return d1, d2

# Color palette
colors = ["#5eead4", "#2dd4bf", "#14b8a6", "#0d9488", "#99f6e4", "#ccfbf1"]
bright_colors = ["#5eead4", "#2dd4bf", "#99f6e4"]
mid_colors = ["#14b8a6", "#0d9488"]
dim_colors = ["#0d9488", "#115e59"]

svg_paths = []

# ═══════════════════════════════════════════
# BUNDLE A — Primary center band (32 lines)
# ═══════════════════════════════════════════
bundle_a_count = 32
for i in range(bundle_a_count):
    t = i / (bundle_a_count - 1)  # 0..1
    y_offset = -40 + 80 * t  # spread from -40 to +40 around center
    y_center = 530 + y_offset
    amp = 120 + 30 * math.sin(t * math.pi)  # varying amplitude
    freq = 1.8 + 0.4 * math.sin(t * math.pi * 2)
    phase = t * 1.5
    dur = 6.5 + t * 3  # 6.5s to 9.5s
    sw = 0.4 + 0.8 * (1 - abs(t - 0.5) * 2)  # thicker in center
    op = 0.3 + 0.6 * (1 - abs(t - 0.5) * 2)  # more opaque in center
    color = bright_colors[i % len(bright_colors)] if t > 0.3 and t < 0.7 else mid_colors[i % len(mid_colors)]
    
    d1, d2 = wave_path_anim(y_center, amp, freq, phase)
    svg_paths.append(f'    <path d="{d1}" fill="none" stroke="{color}" stroke-width="{sw:.1f}" opacity="{op:.2f}">'
                     f'\n      <animate attributeName="d" dur="{dur:.1f}s" repeatCount="indefinite" values="{d1};{d2};{d1}"/>'
                     f'\n    </path>')

# ═══════════════════════════════════════════
# BUNDLE B — Counter-wave (24 lines)
# ═══════════════════════════════════════════
bundle_b_count = 24
for i in range(bundle_b_count):
    t = i / (bundle_b_count - 1)
    y_offset = -30 + 60 * t
    y_center = 520 + y_offset
    amp = 100 + 20 * math.sin(t * math.pi)
    freq = 1.6 + 0.3 * t
    phase = math.pi + t * 1.2  # opposite phase to A
    dur = 7.5 + t * 3
    sw = 0.3 + 0.6 * (1 - abs(t - 0.5) * 2)
    op = 0.2 + 0.5 * (1 - abs(t - 0.5) * 2)
    color = bright_colors[i % len(bright_colors)] if t > 0.25 and t < 0.75 else dim_colors[i % len(dim_colors)]
    
    d1, d2 = wave_path_anim(y_center, amp, freq, phase, amp_delta=15)
    svg_paths.append(f'    <path d="{d1}" fill="none" stroke="{color}" stroke-width="{sw:.1f}" opacity="{op:.2f}">'
                     f'\n      <animate attributeName="d" dur="{dur:.1f}s" repeatCount="indefinite" values="{d1};{d2};{d1}"/>'
                     f'\n    </path>')

# ═══════════════════════════════════════════
# BUNDLE C — Upper register (20 lines)
# ═══════════════════════════════════════════
bundle_c_count = 20
for i in range(bundle_c_count):
    t = i / (bundle_c_count - 1)
    y_offset = -25 + 50 * t
    y_center = 400 + y_offset
    amp = 70 + 20 * math.sin(t * math.pi)
    freq = 2.2 + 0.5 * t
    phase = 0.5 + t * 2
    dur = 8 + t * 3
    sw = 0.3 + 0.5 * (1 - abs(t - 0.5) * 2)
    op = 0.15 + 0.35 * (1 - abs(t - 0.5) * 2)
    color = mid_colors[i % len(mid_colors)] if t < 0.3 or t > 0.7 else bright_colors[i % len(bright_colors)]
    
    d1, d2 = wave_path_anim(y_center, amp, freq, phase, amp_delta=12)
    svg_paths.append(f'    <path d="{d1}" fill="none" stroke="{color}" stroke-width="{sw:.1f}" opacity="{op:.2f}">'
                     f'\n      <animate attributeName="d" dur="{dur:.1f}s" repeatCount="indefinite" values="{d1};{d2};{d1}"/>'
                     f'\n    </path>')

# ═══════════════════════════════════════════
# BUNDLE D — Lower register (20 lines)
# ═══════════════════════════════════════════
bundle_d_count = 20
for i in range(bundle_d_count):
    t = i / (bundle_d_count - 1)
    y_offset = -25 + 50 * t
    y_center = 650 + y_offset
    amp = 65 + 15 * math.sin(t * math.pi)
    freq = 1.5 + 0.4 * t
    phase = 1.0 + t * 1.8
    dur = 9 + t * 3
    sw = 0.3 + 0.4 * (1 - abs(t - 0.5) * 2)
    op = 0.12 + 0.3 * (1 - abs(t - 0.5) * 2)
    color = dim_colors[i % len(dim_colors)] if t < 0.3 or t > 0.7 else mid_colors[i % len(mid_colors)]
    
    d1, d2 = wave_path_anim(y_center, amp, freq, phase, amp_delta=10)
    svg_paths.append(f'    <path d="{d1}" fill="none" stroke="{color}" stroke-width="{sw:.1f}" opacity="{op:.2f}">'
                     f'\n      <animate attributeName="d" dur="{dur:.1f}s" repeatCount="indefinite" values="{d1};{d2};{d1}"/>'
                     f'\n    </path>')

# ═══════════════════════════════════════════
# WIRE MESH — ultra-thin background (16 lines)
# ═══════════════════════════════════════════
mesh_count = 16
for i in range(mesh_count):
    t = i / (mesh_count - 1)
    y_center = 440 + 200 * t  # spread 440-640
    amp = 80 + 40 * random.random()
    freq = 1.2 + 1.0 * random.random()
    phase = random.random() * math.pi * 2
    dur = 10 + random.random() * 5
    sw = 0.2 + 0.3 * random.random()
    op = 0.08 + 0.15 * random.random()
    
    d1, d2 = wave_path_anim(y_center, amp, freq, phase, amp_delta=8)
    svg_paths.append(f'    <path d="{d1}" fill="none" stroke="#ccfbf1" stroke-width="{sw:.1f}" opacity="{op:.2f}">'
                     f'\n      <animate attributeName="d" dur="{dur:.1f}s" repeatCount="indefinite" values="{d1};{d2};{d1}"/>'
                     f'\n    </path>')

# ═══════════════════════════════════════════
# SPARKLES — 40 particles
# ═══════════════════════════════════════════
sparkles = []
sparkle_colors = ["#5eead4", "#2dd4bf", "#99f6e4", "#14b8a6", "#ccfbf1"]
for i in range(40):
    cx = 40 + (1840 / 39) * i + random.randint(-20, 20)
    cy = 380 + random.randint(0, 220)
    r = 0.4 + random.random() * 1.8
    dur = 1.5 + random.random() * 3
    lo = 0.1 + random.random() * 0.3
    hi = 0.7 + random.random() * 0.3
    color = sparkle_colors[i % len(sparkle_colors)]
    sparkles.append(f'    <circle cx="{cx:.0f}" cy="{cy}" r="{r:.1f}" fill="{color}">'
                    f'<animate attributeName="opacity" dur="{dur:.1f}s" repeatCount="indefinite" values="{lo:.1f};{hi:.1f};{lo:.1f}"/>'
                    f'</circle>')

# ═══════════════════════════════════════════
# ASSEMBLE SVG
# ═══════════════════════════════════════════
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="g1" cx="20%" cy="45%" r="35%">
      <stop offset="0%" stop-color="#0d9488" stop-opacity="0.5"/>
      <stop offset="60%" stop-color="#0f766e" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#042f2e" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="50%" cy="50%" r="30%">
      <stop offset="0%" stop-color="#14b8a6" stop-opacity="0.4"/>
      <stop offset="60%" stop-color="#0d9488" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#042f2e" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g3" cx="80%" cy="55%" r="35%">
      <stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.45"/>
      <stop offset="50%" stop-color="#14b8a6" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#042f2e" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="softG" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="1920" height="1080" fill="url(#g1)"/>
  <rect width="1920" height="1080" fill="url(#g2)"/>
  <rect width="1920" height="1080" fill="url(#g3)"/>

  <g filter="url(#glow)">
{chr(10).join(svg_paths)}
  </g>

  <g filter="url(#softG)" opacity="0.75">
{chr(10).join(sparkles)}
  </g>
</svg>'''

with open(r'd:\ThinkAI\Visibill\visibill-prod\public\auth-wave-lines.svg', 'w', encoding='utf-8') as f:
    f.write(svg)

total_paths = len(svg_paths)
total_sparkles = len(sparkles)
print(f"Generated {total_paths} wave paths + {total_sparkles} sparkles = {total_paths + total_sparkles} elements total")
