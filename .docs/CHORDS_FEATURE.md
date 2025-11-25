# Chord Diagram Feature - Implementation Documentation

## Solution Overview

The chord diagram feature displays guitar chord fingering diagrams alongside lyrics in the Player view. It uses a **curated fingering database + PIL rendering** approach for maximum reliability and Python 3.13 compatibility.

## Architecture

### Components

1. **Chord Fingering Database** (`webapp_v3/services/chord_fingerings_db.json`)

   - JSON file with 58 common guitar chords
   - Format: `{"fingers": [2,4,4,2,2,2], "baseFret": 1, "barres": [1]}`
   - Covers major, minor, 7th, maj7, m7, sus2, sus4 variations
   - Easily extensible by adding more chord definitions

2. **Chord Service** (`webapp_v3/services/chord_service_v3.py`)

   - Extracts chord names from `{{ }}` sections in lyrics
   - Looks up fingerings in database (case-insensitive)
   - Renders diagrams using PIL (Pillow library)
   - Returns base64-encoded PNG data URIs

3. **API Endpoint** (`/api/v3/songs/<song_id>/chords`)

   - GET endpoint with authentication + collection access check
   - Extracts chords from `lyrics` or `lyrics_numbered` field
   - Returns JSON: `{"chords": [{"name": "Bm", "image": "data:image/png;..."}]}`

4. **Frontend Display** (`webapp_v3/static/js/player.js`)

   - `loadChords()` - Fetches diagrams when song loads
   - `renderChords()` - Creates DOM elements with images
   - `toggleChords()` - Shows/hides with 'H' key (persists to localStorage)
   - Filters `{{ }}` lines from lyrics display

5. **Styling** (`webapp_v3/static/css/player.css`)
   - Fixed position container on right edge
   - Scrollable when multiple chords present
   - Backdrop blur effect for readability

## Database Format

```json
{
  "Bm": {
    "fingers": [2, 2, 4, 4, 3, 2],
    "baseFret": 1,
    "barres": [1]
  }
}
```

- **fingers**: Array of 6 integers (low E to high E string)
  - `0` = open string
  - `-1` = muted string (not played)
  - `1-12` = fret number
- **baseFret**: Lowest fret shown in diagram (1 = open position)
- **barres**: Array of fret numbers with barre (index finger across strings)

## Chord Diagram Rendering

Generated using PIL primitives:

- **Frets**: Horizontal lines (thicker for nut)
- **Strings**: Vertical lines
- **Open strings**: Circle above nut
- **Muted strings**: X above nut
- **Finger positions**: Black dots at fret intersections
- **Barres**: Rounded rectangles spanning multiple strings

## Adding New Chords

Edit `chord_fingerings_db.json` and add entry:

```json
"Cadd9": {
  "fingers": [0, 3, 2, 0, 3, 0],
  "baseFret": 1,
  "barres": []
}
```

No code changes needed - service loads database on initialization.

## Usage in Lyrics

Add chord section anywhere in lyrics:

```
Line 1: Oh baby, baby
{{ Bm F# D Em F#m }}
Line 2: How was I supposed to know
```

- Chords extracted from **all** `{{ }}` sections (can have multiple)
- Whitespace-separated chord names
- Duplicates automatically removed
- `{{ }}` lines hidden from lyrics display

## Frontend Integration

### Keyboard Shortcuts

- **H key**: Toggle chord diagrams on/off
- State persists across page loads (localStorage)

### State Management

- `currentSongChords` - Array of loaded chord objects
- `chordsVisible` - Boolean flag for toggle state
- Auto-loads chords when song changes

## Testing

```powershell
# Test chord extraction and rendering
python test_chord_service_db.py

# Generate visual diagrams for inspection
python save_chord_diagrams_db.py
```

## Dependencies

- **Pillow** (11.0.0): PIL fork for image generation
- **No external chord libraries needed**

## Covered Chords (58 total)

**Root notes**: A, B, C, C#, D, E, F, F#, G, Ab, Bb, Eb

**Qualities**: Major, Minor, 7th, Maj7, M7, Sus2, Sus4, add9

See `chord_fingerings_db.json` for complete list.

## Limitations & Future Enhancements

### Current Limitations

1. **58 chords covered** - Common pop/rock chords only
2. **Standard tuning only** - No alternate tunings
3. **First position bias** - Some higher position variants missing
4. **No capo support** - Doesn't adjust for capo position

### Possible Enhancements

1. **Expand database** to 200+ chords (add 9ths, 11ths, 13ths, dim, aug)
2. **Multiple voicings** per chord (user selectable)
3. **Capo transposition** - Adjust diagrams based on capo fret
4. **Left-handed mode** - Mirror diagrams for lefty players
5. **Alternate tunings** - Drop D, DADGAD, etc.
6. **Interactive diagrams** - Clickable for audio playback
7. **Chord suggestions** - Recommend alternate voicings
8. **Custom fingerings** - User-editable database entries

## Troubleshooting

**No chords showing:**

- Check browser console for API errors
- Verify lyrics contain `{{ }}` sections
- Check Flask logs for extraction errors

**Wrong chord displayed:**

- Verify chord name spelling matches database keys
- Check for case sensitivity (F# vs f#)
- See logs for "not found in database" warnings

**Blurry diagrams:**

- PIL renders at 200x240px
- Increase resolution in `_draw_chord_diagram()`

## Performance Notes

- Diagrams generated on-demand (not cached in Firestore)
- Base64 encoding adds ~33% overhead vs raw PNG
- Average diagram size: 2KB per chord
- 5 chords = ~10KB total payload
- Negligible impact on load times
