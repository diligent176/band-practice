# Smart BPM Dialog - Band Practice Pro v3

## Overview

Unified BPM dialog combining tap training and manual adjustment into a single smart interface. Accessed via the `.` (period) key.

## Features

### 1. Pre-Initialization

- **Opens with current BPM**: Dialog auto-loads the song's existing BPM value (if available)
- **Ready to adjust**: User can immediately use arrow keys to fine-tune
- **Or reset and tap**: Clear existing value and tap to train a new BPM

### 2. Tap Training

- **Key**: `.` (period) - Tap along with the music
- **Averaging**: Uses rolling average of last 16 taps for accurate detection
- **Real-time display**: BPM updates instantly with each tap
- **Visual feedback**: Display pulses briefly on each tap
- **Precision**: Shows BPM to 1 decimal place (e.g., 88.2)

### 3. Manual Adjustment

- **Fine-tune**: `↑` / `↓` arrow keys adjust by **±0.1 BPM**
- **Coarse adjust**: `Ctrl` + `↑` / `↓` adjust by **±1.0 BPM**
- **Range**: Constrained to 30-300 BPM (reasonable tempo range)
- **Hybrid workflow**: Tap to get close, then arrow keys to perfect the value

### 4. Smart State Management

- **Reset button**: Restores original song BPM (or clears if none)
- **Save button**: Always enabled (no "need 4 taps" restriction)
- **ESC key**: Closes dialog without saving
- **Enter key**: Quick-save shortcut

## User Workflow Examples

### Scenario 1: Song has no BPM yet

1. Press `.` → Dialog opens with `--.-`
2. Tap `.` along with music → BPM appears (e.g., 120.0)
3. Use `↑` / `↓` to fine-tune → 119.7
4. Press `Enter` or click Save

### Scenario 2: Song has BPM, need to adjust

1. Press `.` → Dialog opens with current value (e.g., 88.2)
2. Use `Ctrl` + `↑` twice → 90.2
3. Use `↓` five times → 89.7
4. Press `Enter` or click Save

### Scenario 3: Re-train existing BPM

1. Press `.` → Dialog opens with current value
2. Click Reset → Clears to `--.-`
3. Tap `.` to train new BPM
4. Save

### Scenario 4: Start with guess, refine by tapping

1. Press `.` → Dialog opens
2. `Ctrl` + `↑` repeatedly → Get to ~120 BPM
3. Tap `.` along with music → BPM auto-corrects to actual tempo
4. Save

## Keyboard Shortcuts

| Key                | Action                        |
| ------------------ | ----------------------------- |
| `.`                | Open dialog / Tap to beat     |
| `↑` / `↓`          | Adjust ±0.1 BPM               |
| `Ctrl` + `↑` / `↓` | Adjust ±1.0 BPM               |
| `Enter`            | Save BPM                      |
| `ESC`              | Cancel (close without saving) |
| Reset button       | Restore original BPM          |

## Implementation Details

### Files Modified

1. **`webapp_v3/templates/home.html`** (lines ~735-760)

   - Replaced `bpm-tap-dialog` with `bpm-dialog`
   - Simplified UI: One display, two buttons
   - Updated help text to show all controls

2. **`webapp_v3/static/js/viewManager.js`** (lines ~569-606)

   - Updated keyboard handler for `bpm-dialog` (not `bpm-tap-dialog`)
   - Added arrow key handlers (with Ctrl detection for 1.0 increments)
   - Added Enter key for quick save

3. **`webapp_v3/static/js/player.js`** (lines ~1306-1449)

   - `openBpmDialog()` - Initialize with current song BPM
   - `resetBpmDialog()` - Restore original BPM
   - `updateBpmDisplay()` - Refresh UI (display + status text)
   - `handleBpmTap()` - Record tap, calculate average, update display
   - `adjustBpmValue(delta)` - Arrow key adjustment with range limits
   - `saveBpm()` - Save to database with `bpm_manual: true` flag

4. **`webapp_v3/static/css/player.css`** (line ~674)
   - Added `transition: transform 0.1s ease` to `.bpm-display-large`
   - Enables smooth pulse animation on tap

### API Integration

Saves BPM to backend with decimal precision:

```javascript
PUT /api/v3/songs/{song_id}
{
  "bpm": "88.2",
  "bpm_manual": true
}
```

The `bpm_manual` flag distinguishes user-set BPM from auto-fetched values.

### State Management

```javascript
PlayerManager = {
  tapTimes: [], // Array of timestamps for tap detection
  detectedBpm: null, // Current BPM value (number or null)
  // ...
};
```

### Calculation Logic

**Tap detection**:

```javascript
// Average interval between last N taps
const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

// Convert to BPM (60000 ms per minute / interval ms)
const bpm = 60000 / avgInterval;

// Round to 1 decimal place
this.detectedBpm = Math.round(bpm * 10) / 10;
```

**Arrow key adjustment**:

```javascript
const increment = e.ctrlKey ? 1.0 : 0.1;
const direction = e.key === "ArrowUp" ? 1 : -1;
this.detectedBpm += increment * direction;

// Clamp to 30-300 BPM range
this.detectedBpm = Math.max(30.0, Math.min(300.0, this.detectedBpm));
```

## UI/UX Improvements Over v2

| Aspect             | v2                       | v3                               |
| ------------------ | ------------------------ | -------------------------------- |
| **Initialization** | Always starts blank      | Pre-loads current BPM            |
| **Adjustment**     | Arrow keys ±0.1 only     | Arrow keys ±0.1, Ctrl+Arrow ±1.0 |
| **Workflow**       | Tap OR adjust (not both) | Tap THEN adjust (hybrid)         |
| **Save button**    | Disabled until 4 taps    | Always enabled if BPM set        |
| **Help text**      | Multiple separate hints  | Single unified instruction line  |
| **Icon**           | Hand pointer             | Drum (matches metronome)         |

## Testing Checklist

- [x] Press `.` opens dialog
- [x] Dialog shows current BPM (if exists)
- [x] Tap `.` updates BPM display
- [x] Visual pulse on each tap
- [x] `↑` / `↓` adjusts by 0.1
- [x] `Ctrl` + `↑` / `↓` adjusts by 1.0
- [x] Enter key saves BPM
- [x] ESC key closes dialog
- [x] Reset button restores original
- [x] BPM saved with 1 decimal precision
- [x] `bpm_manual: true` flag set
- [x] Metronome restarts with new BPM
- [x] Help card updated

## Future Enhancements

1. **Tap tempo indicator**: Show real-time milliseconds between taps
2. **BPM history**: Show last 5 detected BPM values from taps
3. **Confidence meter**: Visual indicator of tap consistency
4. **Tempo markings**: Show musical tempo terms (Andante, Allegro, etc.)
5. **Half/Double buttons**: Quick multiply/divide by 2 for time signature changes

---

**Status**: ✅ Complete  
**Completion Date**: November 20, 2025
