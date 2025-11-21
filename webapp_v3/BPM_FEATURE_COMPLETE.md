# BPM Feature Complete - Band Practice Pro v3

## Overview

Successfully integrated automatic BPM (tempo) fetching and visual metronome indicator into v3, improving upon the v2 implementation with cleaner design and better UX.

## Implementation Summary

### Backend (Completed)

- **Service**: `webapp_v3/services/lyrics_service_v3.py`
- **Methods Added**:
  - `_fetch_bpm()` - Fetches BPM from GetSongBPM API
  - `fetch_and_update_song_bpm()` - Single song BPM update
  - `batch_fetch_bpm_for_collection()` - Bulk BPM processing for entire collections
- **Integration**: BPM fetching runs in background thread during playlist import (after lyrics fetch)
- **API**: GetSongBPM API with `GETSONGBPM_API_KEY` environment variable

### Frontend (Completed)

#### Visual Design

- **Component**: Drum icon (`fa-solid fa-drum`) + BPM value in animated container
- **Precision**: Displays BPM to 1 decimal place (e.g., "88.2")
- **Animation**: CSS-based pulsing background that alternates on/off at song tempo
- **Styling**:
  - Green accent (`rgba(45, 122, 74, *)`) matching app theme
  - Smooth hover effects with elevation
  - Disabled state for songs without BPM
  - Glowing pulse animation synchronized to beat

#### Functionality

- **Toggle**: Press `I` key or click indicator to enable/disable metronome
- **Persistence**: On/off state saved in `localStorage` (`v3_bpmIndicatorEnabled`)
- **Default**: Starts enabled (shows animation by default)
- **Feedback**: Toast notifications when toggling ("BPM Metronome Enabled/Disabled")
- **Independence**: Metronome runs independently of music playback (always-on metronome for band practice)
- **Auto-Update**: Updates automatically when switching songs

#### Files Modified

1. **`webapp_v3/templates/home.html`** (lines 265-270)

   - Replaced simple BPM text with drum icon indicator block
   - Structure: `<div id="bpm-indicator-block">` with drum icon + value span

2. **`webapp_v3/static/css/player.css`** (lines ~138-220)

   - Added `.bpm-indicator-block` styling (clickable container)
   - Added `@keyframes bpm-block-pulse` animation (50% on, 50% off)
   - Added `.disabled` state for songs without BPM
   - Removed old `.bpm-flasher` styles

3. **`webapp_v3/static/js/player.js`**

   - **`renderTopNav()`** - Display BPM with `.toFixed(1)`, update indicator state
   - **`startBpmFlasher()`** - CSS animation-based (replaced interval approach)
   - **`stopBpmFlasher()`** - Removes animation class
   - **`toggleBpmIndicator()`** - Toggle with toast notifications
   - **Event Listener** - Click handler on `#bpm-indicator-block`

4. **`webapp_v3/static/js/viewManager.js`** (line 640)

   - `'i': () => PlayerManager.toggleBpmIndicator()` already mapped

5. **Help Card** - Already documented (line 391-395 of home.html)

## Improvements Over v2

1. **Batch Processing**: BPM fetched during playlist import (not on-demand when opening song)

   - **Result**: Zero waiting time when loading songs
   - **Efficiency**: One-time bulk operation vs. lazy loading

2. **Cleaner Animation**: CSS-based instead of JavaScript intervals

   - **Performance**: Hardware-accelerated, no JS overhead
   - **Precision**: More accurate timing with `animation-duration` dynamically set

3. **Better UX**:

   - Single clickable block (not separate button)
   - Clear disabled state for songs without BPM
   - Toast feedback on toggle
   - Persistent state across sessions

4. **Visual Polish**:
   - Drum icon instead of generic circle
   - 1 decimal precision (more accurate)
   - Glowing pulse effect (not just opacity fade)
   - Better color scheme (green accent vs. old design)

## User Experience Flow

1. **Import Playlist** → Backend fetches lyrics + BPM in background
2. **Open Song** → BPM already populated, indicator shows immediately
3. **Metronome Auto-Starts** → If enabled (default), pulsing animation synced to tempo
4. **Toggle with 'I' Key** → Turn on/off without affecting playback
5. **Visual Feedback** → Container "lights up" at song tempo
6. **Band Practice** → Use as reference metronome for keeping time

## Technical Details

### Animation Math

```javascript
const beatDuration = 60 / bpm; // Seconds per beat
const animationDuration = beatDuration * 2; // Double for on/off cycle
```

Example: 120 BPM

- Beat duration: 60 / 120 = 0.5 seconds
- Animation duration: 0.5 \* 2 = 1 second
- Pulse pattern: 0.5s ON → 0.5s OFF → repeat

### CSS Animation

```css
animation-timing-function: steps(1, jump-none);  /* Instant transitions */
0-50%: Bright green (ON)
51-100%: Dim green (OFF)
```

### LocalStorage Keys

- `v3_bpmIndicatorEnabled` - Boolean (default: true)
- `v3_playerColumnMode` - Lyrics columns
- `v3_playerFontSize` - Font size multiplier

## Configuration

### Environment Variables

```bash
GETSONGBPM_API_KEY=your_api_key_here
```

### Firestore Schema

```javascript
songs_v3: {
  bpm: "88.2" | "N/A" | "NOT_FOUND",
  bpm_manual: false,  // Future: manual BPM override
  // ... other fields
}
```

## Future Enhancements (Not Implemented)

1. **Manual BPM Override**: Allow users to set custom BPM (v2 had this, v3 doesn't yet)
2. **BPM Tap Trainer**: Tap to detect BPM manually (v2 had dialog, v3 has placeholder)
3. **BPM Range Filter**: Filter songs by tempo range
4. **Subdivisions**: Show half-time or double-time variants

## Testing Checklist

- [x] BPM fetching during playlist import
- [x] BPM values saved to Firestore
- [x] BPM displayed with 1 decimal precision
- [x] 'I' key toggles indicator
- [x] Click indicator toggles animation
- [x] State persists across page refreshes
- [x] Animation syncs correctly to various tempos (60-180 BPM)
- [x] Disabled state shown for songs without BPM
- [x] Toast notifications on toggle
- [x] Help card documents 'I' key

## Verification Commands

```powershell
# Check BPM values in Firestore
gcloud firestore query songs_v3 --filter="bpm!=N/A" --limit=10

# Test local implementation
.\run-local.bat
# Import playlist → Check BPM values → Press 'I' key
```

## Completion Date

November 20, 2025

## Related Files

- `/webapp_v3/services/lyrics_service_v3.py` (BPM fetching logic)
- `/webapp_v3/app.py` (Playlist import endpoint with background thread)
- `/webapp_v3/templates/home.html` (BPM indicator HTML)
- `/webapp_v3/static/css/player.css` (BPM indicator styles)
- `/webapp_v3/static/js/player.js` (BPM indicator logic)
- `/webapp_v3/static/js/viewManager.js` (Keyboard handler)

---

**Status**: ✅ Feature Complete
