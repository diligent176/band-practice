#!/usr/bin/env python3
"""Convert favicon.svg to .ico and .png formats"""

import os
import sys
import io

try:
    from PIL import Image
    from cairosvg import svg2png
except ImportError:
    print("Installing required packages...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow", "cairosvg"])
    from PIL import Image
    from cairosvg import svg2png

# Paths
svg_path = "webapp/static/favicon.svg"
ico_path = "webapp/static/favicon.ico"
png_path = "webapp/static/favicon.png"

print(f"Converting {svg_path}...")

# Convert SVG to PNG at different sizes for ICO
sizes = [16, 32, 48, 64]
images = []

for size in sizes:
    png_data = svg2png(url=svg_path, output_width=size, output_height=size)
    img = Image.open(io.BytesIO(png_data))
    images.append(img)

# Also create a standard 32x32 PNG
png_data_32 = svg2png(url=svg_path, output_width=32, output_height=32)
with open(png_path, 'wb') as f:
    f.write(png_data_32)
print(f"Created {png_path}")

# Create ICO with multiple sizes
import io
images[0].save(ico_path, format='ICO', sizes=[(s, s) for s in sizes])
print(f"Created {ico_path}")

print("Favicon conversion complete!")
