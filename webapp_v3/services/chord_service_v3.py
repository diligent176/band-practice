"""
Band Practice Pro v3 - Chord Service
Renders guitar chord diagrams using curated fingering database + PIL
"""

import logging
import re
import io
import base64
import json
import os
from typing import List, Dict, Optional
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)

# In-memory cache for rendered chord diagrams
_chord_diagram_cache = {}


class ChordServiceV3:
    """Service for rendering guitar chord diagrams"""

    def __init__(self):
        """Load chord fingerings database on initialization"""
        db_path = os.path.join(os.path.dirname(__file__), 'chord_fingerings_db.json')
        try:
            with open(db_path, 'r') as f:
                self.chord_db = json.load(f)
            logger.info(f"✅ Loaded {len(self.chord_db)} chords from fingerings database")
        except Exception as e:
            logger.error(f"❌ Failed to load chord database: {e}")
            self.chord_db = {}

    @staticmethod
    def extract_chords_from_lyrics(lyrics: str) -> Optional[List[str]]:
        """
        Extract chord names from double curly braces in lyrics
        Example: "{{ Bm F# D Em F#m }}" -> ['Bm', 'F#', 'D', 'Em', 'F#m']
        
        Returns:
            List of chord names, or None if no chord section found
        """
        if not lyrics:
            logger.info("No lyrics provided to extract_chords_from_lyrics")
            return None

        logger.info(f"🎸 Extracting chords from lyrics (length: {len(lyrics)} chars)")
        
        # Find all {{ ... }} sections
        matches = re.findall(r'\{\{\s*(.*?)\s*\}\}', lyrics, re.DOTALL)

        logger.info(f"🎸 Found {len(matches)} chord sections: {matches}")

        if not matches:
            return None

        # Combine all matches and split on whitespace
        all_chords = []
        for match in matches:
            chords = match.strip().split()
            all_chords.extend(chords)

        logger.info(f"🎸 Extracted chord names: {all_chords}")

        # Remove duplicates while preserving order
        seen = set()
        unique_chords = []
        for chord in all_chords:
            if chord not in seen:
                seen.add(chord)
                unique_chords.append(chord)

        logger.info(f"🎸 Unique chords: {unique_chords}")
        return unique_chords if unique_chords else None

    def _draw_chord_diagram(self, chord_name: str, fingering: Dict) -> Image:
        """
        Draw a chord diagram using PIL
        
        Args:
            chord_name: Name to display at top
            fingering: Dict with {"fingers": [2,4,4,2,2,2], "baseFret": 1, "barres": [1]}
            
        Returns:
            PIL Image object
        """
        # Tight image dimensions - minimal padding
        width, height = 94, 115
        img = Image.new('RGB', (width, height), color='white')
        draw = ImageDraw.Draw(img)
        
        # Chord diagram area - shorter frets for compactness
        grid_left = 7
        grid_top = 22
        grid_width = 80
        grid_height = 90  # Significantly reduced for compact size
        fret_spacing = grid_height / 5
        string_spacing = grid_width / 5
        
        # Load fonts
        try:
            font_title = ImageFont.truetype("arialbd.ttf", 14)  # Bold, smaller
        except:
            try:
                font_title = ImageFont.truetype("arial.ttf", 14)
            except:
                font_title = ImageFont.load_default()
        
        try:
            font_label = ImageFont.truetype("arial.ttf", 8)
        except:
            font_label = ImageFont.load_default()
        
        # Draw chord name at top (minimal space, bold)
        draw.text((width // 2, 8), chord_name, fill='black', anchor='mm', font=font_title)
        
        # Draw frets (horizontal lines)
        for i in range(6):
            y = grid_top + i * fret_spacing
            thickness = 3 if i == 0 else 1  # Thicker line for nut
            draw.line([(grid_left, y), (grid_left + grid_width, y)], fill='black', width=thickness)
        
        # Draw strings (vertical lines)
        for i in range(6):
            x = grid_left + i * string_spacing
            draw.line([(x, grid_top), (x, grid_top + grid_height)], fill='black', width=1)
        
        # Draw base fret number if not first position
        base_fret = fingering.get('baseFret', 1)
        if base_fret > 1:
            draw.text((grid_left - 18, grid_top + fret_spacing / 2), f"{base_fret}fr", 
                     fill='gray', anchor='mm', font=font_label)
        
        # Draw barres (if any)
        for barre_fret in fingering.get('barres', []):
            # Find leftmost and rightmost strings that use this fret
            fingers = fingering['fingers']
            barre_strings = [i for i, f in enumerate(fingers) if f == barre_fret and f > 0]
            if len(barre_strings) > 1:
                left_string = min(barre_strings)
                right_string = max(barre_strings)
                y = grid_top + (barre_fret - 0.5) * fret_spacing
                x1 = grid_left + left_string * string_spacing
                x2 = grid_left + right_string * string_spacing
                # Draw barre as rounded rectangle
                draw.ellipse([x1 - 5, y - 5, x2 + 5, y + 5], fill='black')
        
        # Draw finger positions
        fingers = fingering['fingers']
        for string_idx, fret in enumerate(fingers):
            x = grid_left + string_idx * string_spacing
            
            if fret == 0:
                # Open string (O above nut) - 1px from nut
                draw.ellipse([x - 3, grid_top - 7, x + 3, grid_top - 1], outline='black', width=1)
            elif fret == -1:
                # Muted string (X above nut) - 1px from nut
                draw.line([(x - 3, grid_top - 7), (x + 3, grid_top - 1)], fill='black', width=1)
                draw.line([(x - 3, grid_top - 1), (x + 3, grid_top - 7)], fill='black', width=1)
            else:
                # Fretted note
                # Skip if this is part of a barre already drawn (unless it's the only occurrence)
                if fret not in fingering.get('barres', []) or fingers.count(fret) == 1:
                    y = grid_top + (fret - 0.5) * fret_spacing
                    draw.ellipse([x - 5, y - 5, x + 5, y + 5], fill='black')
        
        return img

    def render_chord_diagram(self, chord_name: str) -> Optional[str]:
        """
        Render a guitar chord diagram as base64-encoded PNG
        Uses in-memory cache to avoid re-rendering same chords
        
        Args:
            chord_name: Name of chord (e.g., "Bm", "F#", "D")
            
        Returns:
            Base64-encoded PNG data URI string, or None if chord not found
        """
        # Check cache first
        if chord_name in _chord_diagram_cache:
            logger.info(f"♻️ Using cached diagram: {chord_name}")
            return _chord_diagram_cache[chord_name]
        
        try:
            # Look up fingering in database (case-insensitive)
            fingering = self.chord_db.get(chord_name)
            if not fingering:
                # Try case variations
                for key in self.chord_db:
                    if key.lower() == chord_name.lower():
                        fingering = self.chord_db[key]
                        chord_name = key  # Use canonical name
                        break
            
            if not fingering:
                logger.warning(f"⚠️ Chord '{chord_name}' not found in database")
                return None
            
            # Draw the diagram
            img = self._draw_chord_diagram(chord_name, fingering)
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            buffer.seek(0)
            img_base64 = base64.b64encode(buffer.read()).decode('utf-8')
            
            result = f"data:image/png;base64,{img_base64}"
            
            # Cache the result
            _chord_diagram_cache[chord_name] = result
            logger.info(f"✅ Rendered and cached chord: {chord_name}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Failed to render chord {chord_name}: {e}")
            return None

    def generate_chord_data(self, lyrics: str) -> Optional[List[Dict]]:
        """
        Extract chords from lyrics and generate diagram data
        
        Args:
            lyrics: Song lyrics containing {{ chord names }}
            
        Returns:
            List of chord data dicts with 'name' and 'image' (base64 PNG),
            or None if no chords found
        """
        logger.info("=== generate_chord_data called ===")
        logger.info(f"Lyrics length: {len(lyrics) if lyrics else 0}")
        
        chord_names = self.extract_chords_from_lyrics(lyrics)

        if not chord_names:
            logger.info("No chord names extracted from lyrics")
            return None

        logger.info(f"🎸 Generating diagrams for {len(chord_names)} chords: {chord_names}")
        
        chord_data = []
        for chord_name in chord_names:
            image_base64 = self.render_chord_diagram(chord_name)
            
            if image_base64:
                chord_data.append({
                    'name': chord_name,
                    'image': image_base64
                })
            else:
                logger.warning(f"⚠️ Could not render chord: {chord_name} (not in database)")

        logger.info(f"🎸 Returning {len(chord_data)} chord diagrams")
        return chord_data if chord_data else None

