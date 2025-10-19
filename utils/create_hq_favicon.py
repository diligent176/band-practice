#!/usr/bin/env python3
"""Create high-quality favicon with reggae guitar icon"""

from PIL import Image, ImageDraw, ImageFont
import math

def create_guitar_icon(size=256):
    """Create a high-quality guitar icon at the specified size"""
    
    # Create image with transparency
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Scale factors for different sizes
    scale = size / 256
    
    # Define colors
    bg_color = (26, 26, 26, 255)  # Dark background
    red = (220, 20, 60, 255)       # Reggae red
    yellow = (255, 215, 0, 255)    # Reggae yellow/gold
    green = (29, 185, 84, 255)     # Reggae green
    wood = (139, 69, 19, 255)      # Wood brown
    dark_wood = (101, 67, 33, 255) # Darker wood
    gold_metal = (255, 215, 0, 255) # Gold for hardware
    silver = (224, 224, 224, 224)  # Silver for strings (semi-transparent)
    
    # FULL SIZE CIRCLE - 100% of the space with reggae gradient
    # Create a radial gradient from red (top) -> yellow (middle) -> green (bottom)
    for y in range(size):
        for x in range(size):
            # Calculate distance from center
            dx = x - size / 2
            dy = y - size / 2
            distance = math.sqrt(dx * dx + dy * dy)
            
            # Only draw within circle
            if distance <= size / 2:
                # Vertical gradient based on y position
                ratio = y / size
                
                if ratio < 0.33:
                    # Red to yellow
                    local_ratio = ratio / 0.33
                    r = int(red[0] + (yellow[0] - red[0]) * local_ratio)
                    g = int(red[1] + (yellow[1] - red[1]) * local_ratio)
                    b = int(red[2] + (yellow[2] - red[2]) * local_ratio)
                elif ratio < 0.66:
                    # Yellow to green
                    local_ratio = (ratio - 0.33) / 0.33
                    r = int(yellow[0] + (green[0] - yellow[0]) * local_ratio)
                    g = int(yellow[1] + (green[1] - yellow[1]) * local_ratio)
                    b = int(yellow[2] + (green[2] - yellow[2]) * local_ratio)
                else:
                    # More green
                    local_ratio = (ratio - 0.66) / 0.34
                    r = int(green[0] * (1 - local_ratio * 0.2))
                    g = int(green[1] * (1 - local_ratio * 0.2))
                    b = int(green[2] * (1 - local_ratio * 0.2))
                
                draw.point((x, y), fill=(r, g, b, 255))
    
    # NOW DRAW MASSIVE GUITAR ON TOP - 98% of height!
    center = size // 2
    
    # Guitar dimensions - FUCKING LARGE AND TALL
    # Use 98% of the height for guitar from headstock to bridge
    guitar_height_ratio = 0.98
    guitar_top = int(size * (1 - guitar_height_ratio) / 2)  # 1% margin top
    guitar_bottom = int(size * (1 - (1 - guitar_height_ratio) / 2))  # 1% margin bottom
    total_guitar_height = guitar_bottom - guitar_top
    
    # Proportions for a realistic acoustic guitar
    headstock_height = int(total_guitar_height * 0.08)
    neck_height = int(total_guitar_height * 0.40)
    body_height = int(total_guitar_height * 0.52)
    
    neck_width = int(size * 0.12)  # 12% of width
    body_width = int(size * 0.45)   # 45% of width for body
    
    # Calculate positions
    headstock_top = guitar_top
    headstock_bottom = headstock_top + headstock_height
    
    neck_top = headstock_bottom
    neck_bottom = neck_top + neck_height
    
    body_top = neck_bottom - int(headstock_height * 0.5)  # Overlap slightly
    body_bottom = guitar_bottom
    
    neck_left = center - neck_width // 2
    neck_right = center + neck_width // 2
    
    body_left = center - body_width // 2
    body_right = center + body_width // 2
    
    # DRAW HEADSTOCK - top of guitar
    headstock_width = int(neck_width * 1.4)
    headstock_left = center - headstock_width // 2
    headstock_right = center + headstock_width // 2
    headstock_rect = [headstock_left, headstock_top, headstock_right, headstock_bottom]
    draw.rounded_rectangle(headstock_rect, radius=int(3 * scale), 
                          fill=dark_wood, outline=wood, width=max(1, int(2 * scale)))
    
    # Draw tuning pegs on headstock (3 per side)
    peg_radius = max(2, int(3 * scale))
    peg_offset = int(headstock_width * 0.2)
    peg_spacing = headstock_height // 4
    for i in range(3):
        y = headstock_top + peg_spacing + i * peg_spacing
        # Left side pegs
        left_peg_x = headstock_left + peg_offset
        draw.ellipse([left_peg_x - peg_radius, y - peg_radius,
                     left_peg_x + peg_radius, y + peg_radius], 
                    fill=gold_metal, outline=dark_wood, width=1)
        # Right side pegs
        right_peg_x = headstock_right - peg_offset
        draw.ellipse([right_peg_x - peg_radius, y - peg_radius,
                     right_peg_x + peg_radius, y + peg_radius], 
                    fill=gold_metal, outline=dark_wood, width=1)
    
    # DRAW GUITAR NECK - long and narrow
    neck_rect = [neck_left, neck_top, neck_right, neck_bottom]
    draw.rounded_rectangle(neck_rect, radius=int(3 * scale), 
                          fill=dark_wood, outline=wood, width=max(1, int(2 * scale)))
    
    # Draw frets across neck
    num_frets = 8
    for i in range(1, num_frets + 1):
        fret_y = neck_top + int((i / num_frets) * neck_height)
        draw.line([neck_left + 2, fret_y, neck_right - 2, fret_y], 
                 fill=silver, width=max(1, int(1 * scale)))
    
    # DRAW GUITAR BODY - large acoustic shape
    # Upper bout (smaller upper curve)
    upper_bout_height = int(body_height * 0.35)
    upper_bout = [body_left + int(body_width * 0.1), body_top, 
                  body_right - int(body_width * 0.1), body_top + upper_bout_height]
    draw.ellipse(upper_bout, fill=wood, outline=dark_wood, width=max(2, int(3 * scale)))
    
    # Lower bout (larger lower curve) - classic acoustic shape
    lower_bout_top = body_top + int(upper_bout_height * 0.4)
    lower_bout = [body_left, lower_bout_top, body_right, body_bottom]
    draw.ellipse(lower_bout, fill=wood, outline=dark_wood, width=max(2, int(3 * scale)))
    
    # Draw sound hole - positioned in upper part of body
    sound_hole_center_y = body_top + int(upper_bout_height * 0.6)
    sound_hole_radius = int(body_width * 0.12)
    sound_hole_bbox = [center - sound_hole_radius, sound_hole_center_y - sound_hole_radius,
                      center + sound_hole_radius, sound_hole_center_y + sound_hole_radius]
    draw.ellipse(sound_hole_bbox, fill=(42, 26, 15, 255))
    
    # Sound hole decoration rings
    ring_width = max(1, int(2 * scale))
    for ring_offset in [int(3 * scale), int(5 * scale)]:
        ring_bbox = [center - sound_hole_radius - ring_offset, 
                    sound_hole_center_y - sound_hole_radius - ring_offset,
                    center + sound_hole_radius + ring_offset, 
                    sound_hole_center_y + sound_hole_radius + ring_offset]
        draw.arc(ring_bbox, start=0, end=360, fill=gold_metal, width=ring_width)
    
    # Draw guitar strings (6 strings from headstock to bridge)
    string_positions = []
    for i in range(6):
        x = neck_left + int((i + 1) * neck_width / 7)
        string_positions.append(x)
    
    # Draw bridge at bottom of body
    bridge_top = body_bottom - int(body_height * 0.15)
    bridge_height = max(4, int(body_height * 0.04))
    bridge_width = int(body_width * 0.35)
    bridge_rect = [center - bridge_width//2, bridge_top,
                  center + bridge_width//2, bridge_top + bridge_height]
    draw.rounded_rectangle(bridge_rect, radius=max(1, int(2 * scale)), 
                          fill=dark_wood, outline=gold_metal, width=max(1, int(1 * scale)))
    
    # Draw bridge pins where strings attach
    pin_radius = max(1, int(2 * scale))
    for x in string_positions:
        pin_y = bridge_top + bridge_height // 2
        draw.ellipse([x - pin_radius, pin_y - pin_radius,
                     x + pin_radius, pin_y + pin_radius], fill=gold_metal)
    
    # Now draw strings on top of everything
    for i, x in enumerate(string_positions):
        # Strings get slightly thicker from high to low
        thickness = max(1, int((i * 0.4 + 0.8) * scale))
        draw.line([x, headstock_bottom, x, bridge_top], 
                 fill=silver, width=thickness)
    
    # Add subtle highlight/shine to guitar body for depth
    highlight_center_y = body_top + int(upper_bout_height * 0.7)
    highlight_width = int(body_width * 0.3)
    highlight_height = int(body_height * 0.25)
    highlight_bbox = [center - highlight_width//2, highlight_center_y - highlight_height//2,
                     center + highlight_width//2, highlight_center_y + highlight_height//2]
    overlay = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.ellipse(highlight_bbox, fill=(255, 255, 255, 35))
    img = Image.alpha_composite(img, overlay)
    
    return img

def create_multi_size_favicon():
    """Create favicon files in multiple formats and sizes"""
    
    print("🎸 Creating high-quality reggae guitar favicon...")
    
    # Create master image at highest resolution
    master_size = 512
    master_img = create_guitar_icon(master_size)
    
    # Save PNG versions at different sizes
    png_sizes = [512, 256, 192, 180, 152, 144, 128, 96, 72, 64, 48, 32, 16]
    
    print(f"\n📐 Creating PNG files...")
    for png_size in png_sizes:
        if png_size == master_size:
            img = master_img
        else:
            img = master_img.resize((png_size, png_size), Image.Resampling.LANCZOS)
        
        # Save primary sizes
        if png_size == 32:
            img.save('webapp/static/favicon-32x32.png', 'PNG', optimize=True)
            print(f"  ✓ favicon-32x32.png")
        elif png_size == 16:
            img.save('webapp/static/favicon-16x16.png', 'PNG', optimize=True)
            print(f"  ✓ favicon-16x16.png")
        elif png_size == 192:
            img.save('webapp/static/android-chrome-192x192.png', 'PNG', optimize=True)
            print(f"  ✓ android-chrome-192x192.png")
        elif png_size == 512:
            img.save('webapp/static/android-chrome-512x512.png', 'PNG', optimize=True)
            print(f"  ✓ android-chrome-512x512.png")
        elif png_size == 180:
            img.save('webapp/static/apple-touch-icon.png', 'PNG', optimize=True)
            print(f"  ✓ apple-touch-icon.png (180x180)")
    
    # Save main favicon.png at high quality
    master_img.resize((64, 64), Image.Resampling.LANCZOS).save(
        'webapp/static/favicon.png', 'PNG', optimize=True
    )
    print(f"  ✓ favicon.png (64x64)")
    
    # Create multi-resolution ICO file (for maximum browser compatibility)
    print(f"\n💾 Creating favicon.ico with multiple resolutions...")
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    ico_images = []
    for ico_size in ico_sizes:
        resized = master_img.resize(ico_size, Image.Resampling.LANCZOS)
        ico_images.append(resized)
    
    # Save ICO with all sizes embedded
    ico_images[0].save(
        'webapp/static/favicon.ico', 
        format='ICO', 
        sizes=ico_sizes,
        append_images=ico_images[1:]
    )
    print(f"  ✓ favicon.ico (16, 24, 32, 48, 64, 128, 256)")
    
    # Create SVG version (scalable, best quality)
    print(f"\n🎨 Creating SVG favicon...")
    create_svg_favicon()
    
    # Create site.webmanifest for PWA support
    print(f"\n📱 Creating site.webmanifest...")
    create_webmanifest()
    
    print("\n✅ High-quality favicon created successfully!")
    print("\n📝 Files created:")
    print("   - favicon.ico (multi-resolution)")
    print("   - favicon.png (64x64)")
    print("   - favicon-16x16.png")
    print("   - favicon-32x32.png")
    print("   - apple-touch-icon.png (180x180)")
    print("   - android-chrome-192x192.png")
    print("   - android-chrome-512x512.png")
    print("   - favicon.svg")
    print("   - site.webmanifest")
    print("\n💡 Update your HTML to include:")
    print('   <link rel="icon" type="image/x-icon" href="/static/favicon.ico">')
    print('   <link rel="icon" type="image/png" sizes="32x32" href="/static/favicon-32x32.png">')
    print('   <link rel="icon" type="image/png" sizes="16x16" href="/static/favicon-16x16.png">')
    print('   <link rel="apple-touch-icon" sizes="180x180" href="/static/apple-touch-icon.png">')
    print('   <link rel="manifest" href="/static/site.webmanifest">')

def create_svg_favicon():
    """Create an SVG version for perfect scaling"""
    svg_content = '''<?xml version="1.0" encoding="UTF-8"?>
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Reggae gradient for full circle background -->
    <linearGradient id="reggaeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#dc143c;stop-opacity:1" />
      <stop offset="33%" style="stop-color:#ffd700;stop-opacity:1" />
      <stop offset="66%" style="stop-color:#1db954;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#158f3f;stop-opacity:1" />
    </linearGradient>
    <!-- Wood gradient for guitar body -->
    <radialGradient id="bodyGradient" cx="50%" cy="35%">
      <stop offset="0%" style="stop-color:rgb(160,90,30);stop-opacity:1" />
      <stop offset="100%" style="stop-color:rgb(139,69,19);stop-opacity:1" />
    </radialGradient>
  </defs>
  
  <!-- MASSIVE Full circle with reggae gradient -->
  <circle cx="128" cy="128" r="128" fill="url(#reggaeGradient)"/>
  
  <!-- MASSIVE GUITAR overlaid on top - 98% height -->
  
  <!-- Headstock -->
  <rect x="108" y="3" width="40" height="20" rx="3" fill="#654321" stroke="#8b4513" stroke-width="2"/>
  
  <!-- Tuning pegs (left) -->
  <circle cx="115" cy="8" r="3" fill="#ffd700" stroke="#654321" stroke-width="1"/>
  <circle cx="115" cy="13" r="3" fill="#ffd700" stroke="#654321" stroke-width="1"/>
  <circle cx="115" cy="18" r="3" fill="#ffd700" stroke="#654321" stroke-width="1"/>
  
  <!-- Tuning pegs (right) -->
  <circle cx="141" cy="8" r="3" fill="#ffd700" stroke="#654321" stroke-width="1"/>
  <circle cx="141" cy="13" r="3" fill="#ffd700" stroke="#654321" stroke-width="1"/>
  <circle cx="141" cy="18" r="3" fill="#ffd700" stroke="#654321" stroke-width="1"/>
  
  <!-- Guitar neck - TALL -->
  <rect x="118" y="23" width="20" height="102" rx="3" fill="#654321" stroke="#8b4513" stroke-width="2"/>
  
  <!-- Frets -->
  <line x1="120" y1="35" x2="136" y2="35" stroke="#e0e0e0" stroke-width="1.5" opacity="0.8"/>
  <line x1="120" y1="48" x2="136" y2="48" stroke="#e0e0e0" stroke-width="1.5" opacity="0.8"/>
  <line x1="120" y1="61" x2="136" y2="61" stroke="#e0e0e0" stroke-width="1.5" opacity="0.8"/>
  <line x1="120" y1="74" x2="136" y2="74" stroke="#e0e0e0" stroke-width="1.5" opacity="0.8"/>
  <line x1="120" y1="87" x2="136" y2="87" stroke="#e0e0e0" stroke-width="1.5" opacity="0.8"/>
  <line x1="120" y1="100" x2="136" y2="100" stroke="#e0e0e0" stroke-width="1.5" opacity="0.8"/>
  <line x1="120" y1="113" x2="136" y2="113" stroke="#e0e0e0" stroke-width="1.5" opacity="0.8"/>
  
  <!-- Upper bout -->
  <ellipse cx="128" cy="132" rx="50" ry="40" fill="url(#bodyGradient)" stroke="#654321" stroke-width="3"/>
  
  <!-- Lower bout - LARGE -->
  <ellipse cx="128" cy="190" rx="58" ry="62" fill="url(#bodyGradient)" stroke="#654321" stroke-width="3"/>
  
  <!-- Sound hole -->
  <circle cx="128" cy="145" r="18" fill="#2a1a0f"/>
  <circle cx="128" cy="145" r="21" fill="none" stroke="#ffd700" stroke-width="2" opacity="0.8"/>
  <circle cx="128" cy="145" r="24" fill="none" stroke="#ffd700" stroke-width="1.5" opacity="0.6"/>
  
  <!-- Bridge -->
  <rect x="106" y="235" width="44" height="10" rx="2" fill="#654321" stroke="#ffd700" stroke-width="1"/>
  
  <!-- Guitar strings running full length -->
  <line x1="121" y1="23" x2="121" y2="235" stroke="#e0e0e0" stroke-width="1" opacity="0.7"/>
  <line x1="124" y1="23" x2="124" y2="235" stroke="#e0e0e0" stroke-width="1.2" opacity="0.7"/>
  <line x1="128" y1="23" x2="128" y2="235" stroke="#e0e0e0" stroke-width="1.4" opacity="0.7"/>
  <line x1="132" y1="23" x2="132" y2="235" stroke="#e0e0e0" stroke-width="1.6" opacity="0.7"/>
  <line x1="135" y1="23" x2="135" y2="235" stroke="#e0e0e0" stroke-width="1.8" opacity="0.7"/>
  
  <!-- Bridge pins -->
  <circle cx="121" cy="240" r="2" fill="#ffd700"/>
  <circle cx="124" cy="240" r="2" fill="#ffd700"/>
  <circle cx="128" cy="240" r="2" fill="#ffd700"/>
  <circle cx="132" cy="240" r="2" fill="#ffd700"/>
  <circle cx="135" cy="240" r="2" fill="#ffd700"/>
  
  <!-- Highlight for depth on body -->
  <ellipse cx="128" cy="145" rx="25" ry="35" fill="white" opacity="0.12"/>
</svg>'''
    
    with open('webapp/static/favicon.svg', 'w', encoding='utf-8') as f:
        f.write(svg_content)
    print(f"  ✓ favicon.svg (scalable)")

def create_webmanifest():
    """Create a web manifest for PWA support"""
    manifest_content = '''{
  "name": "Band Practice PRO",
  "short_name": "Band Practice",
  "description": "Manage band practice songs with lyrics, notes, and BPM",
  "icons": [
    {
      "src": "/static/android-chrome-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/static/android-chrome-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "theme_color": "#1a1a1a",
  "background_color": "#1a1a1a",
  "display": "standalone",
  "start_url": "/",
  "scope": "/"
}'''
    
    with open('webapp/static/site.webmanifest', 'w', encoding='utf-8') as f:
        f.write(manifest_content)
    print(f"  ✓ site.webmanifest")

if __name__ == '__main__':
    create_multi_size_favicon()
