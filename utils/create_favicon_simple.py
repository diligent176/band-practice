#!/usr/bin/env python3
"""Create favicon using PIL/Pillow only"""

from PIL import Image, ImageDraw

# Create a 64x64 image
size = 64
img = Image.new('RGBA', (size, size), (26, 26, 26, 255))  # Dark background
draw = ImageDraw.Draw(img)

# Draw reggae stripes
stripe_height = 8
draw.rectangle([0, 8, 64, 16], fill=(220, 20, 60, 200))   # Red
draw.rectangle([0, 16, 64, 24], fill=(255, 215, 0, 200))  # Yellow/Gold
draw.rectangle([0, 24, 64, 32], fill=(29, 185, 84, 200))  # Green (Spotify green)

# Draw guitar body (ellipse)
body_center = (32, 38)
body_bbox = [18, 22, 46, 54]
draw.ellipse(body_bbox, fill=(139, 69, 19), outline=(101, 67, 33), width=2)

# Draw sound hole
draw.ellipse([27, 33, 37, 43], fill=(42, 26, 15))
draw.ellipse([28, 34, 36, 42], fill=None, outline=(139, 69, 19), width=1)

# Draw guitar neck
draw.rectangle([28, 10, 36, 28], fill=(101, 67, 33))

# Draw frets
for y in [14, 18, 22, 26]:
    draw.line([28, y, 36, y], fill=(212, 212, 212), width=1)

# Draw strings
for x in [30, 32, 34]:
    draw.line([x, 10, x, 50], fill=(224, 224, 224), width=1)

# Draw headstock
draw.rectangle([27, 6, 37, 11], fill=(101, 67, 33))

# Draw tuning pegs
for x in [29, 32, 35]:
    draw.ellipse([x-1.5, 6.5, x+1.5, 9.5], fill=(255, 215, 0))

# Draw bridge
draw.rectangle([28, 50, 36, 52], fill=(101, 67, 33))

# Add highlight on guitar body
draw.ellipse([24, 28, 32, 40], fill=(255, 255, 255, 38))

# Save as PNG
png_path = 'webapp/static/favicon.png'
img.save(png_path, 'PNG')
print(f"Created {png_path}")

# Create ICO with multiple sizes
sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
ico_path = 'webapp/static/favicon.ico'

# Create resized versions
icon_images = []
for icon_size in sizes:
    resized = img.resize(icon_size, Image.Resampling.LANCZOS)
    icon_images.append(resized)

# Save the largest one as ICO with all sizes embedded
icon_images[0].save(ico_path, format='ICO', sizes=sizes)
print(f"Created {ico_path}")

print("Favicon created successfully!")
