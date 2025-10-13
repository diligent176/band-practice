# BPM Feature Implementation Summary

## Overview

Completed implementation of BPM (beats per minute) fetching from GetSongBPM.com API with asynchronous background loading to avoid blocking the main UI.

## Changes Made

### 1. Backend - `lyrics_service.py`

- **Fixed bug**: Corrected `_fetch_bpm()` calls that were incorrectly passing Spotify URI instead of title/artist
- **Removed blocking BPM fetches**: Changed `import_selected_songs()` and `sync_playlist()` to skip BPM during import
  - Songs are now imported with `bpm: 'N/A'` initially
  - BPM is fetched asynchronously after song is displayed
- **Added new method**: `fetch_and_update_bpm(song_id, title, artist)` for background BPM fetching
  - Fetches BPM from GetSongBPM API
  - Updates Firestore with the result
  - Returns BPM value

### 2. Backend - `app.py`

- **Added new API endpoint**: `POST /api/songs/<song_id>/bpm`
  - Called asynchronously from frontend after song loads
  - Fetches and updates BPM for a single song
  - Returns success/failure status

### 3. Frontend - `app.js`

- **Modified `loadSong()` function**:
  - After song loads, checks if BPM is missing or 'N/A'
  - Triggers background BPM fetch if needed
  - Song displays immediately with lyrics, BPM loads in background
- **Added `fetchBpmInBackground()` function**:
  - Calls new `/api/songs/<song_id>/bpm` endpoint
  - Updates `currentSong.bpm` when response arrives
  - Refreshes metadata display to show new BPM
  - Silently fails if error (doesn't disturb user experience)
  - Logs progress to console for debugging

### 4. Infrastructure - Terraform

- **Added variable**: `getsongbpm_api_key` in `variables.tf`
- **Created secret**: `GETSONGBPM_API_KEY` in Google Secret Manager
- **Updated Cloud Run**: Added environment variable mapping to secret

### 5. CI/CD - GitHub Actions

- **Updated `terraform.yml`**: Added `GETSONGBPM_API_KEY` to terraform.tfvars generation
- **Updated `deploy.yml`**: Added `GETSONGBPM_API_KEY` to Cloud Run secrets list

## User Experience Flow

### Before (Blocking UI):

1. User imports playlist
2. For each song:
   - Fetch lyrics (fast)
   - Fetch BPM (slow - API call) ⏳
   - Save to database
3. User waits for entire import to complete
4. Import takes 3-5 seconds per song

### After (Non-blocking UI):

1. User imports playlist
2. For each song:
   - Fetch lyrics (fast)
   - Save to database with BPM='N/A'
3. Import completes quickly (~1-2 seconds per song)
4. User can immediately view songs
5. When song loads:
   - Display lyrics immediately
   - Show BPM as "N/A" initially
   - Fetch BPM in background
   - Update BPM display when ready (1-2 seconds later)

## API Configuration

The GetSongBPM API key is stored in:

- **Local**: `.env` file as `GETSONGBPM_API_KEY`
- **GitHub**: Repository secret `GETSONGBPM_API_KEY`
- **GCP**: Secret Manager as `GETSONGBPM_API_KEY`
- **Cloud Run**: Environment variable mounted from Secret Manager

## Testing Checklist

- [ ] Test importing a new playlist
  - Verify songs import quickly
  - Verify BPM shows as "N/A" initially
- [ ] Test viewing a song with missing BPM
  - Verify lyrics load immediately
  - Verify BPM updates within 1-2 seconds
  - Check console logs for "🎵 Fetching BPM..." and "✅ BPM updated"
- [ ] Test viewing a song that already has BPM
  - Verify no additional API call is made
  - BPM should display immediately
- [ ] Test switching between songs quickly
  - Verify BPM fetches don't interfere with each other
  - Each song should fetch its own BPM independently
- [ ] Test API errors
  - Temporarily break API key
  - Verify app doesn't crash
  - Verify BPM stays as "N/A" without error messages to user

## Deployment Steps

### 1. Deploy Infrastructure Changes

```bash
# Push to main branch - triggers terraform workflow
git add terraform/
git commit -m "Add GETSONGBPM_API_KEY to infrastructure"
git push origin main
```

### 2. Verify Secret in GCP

The Terraform workflow will create the secret, but you need to verify:

1. Go to GCP Console → Secret Manager
2. Verify `GETSONGBPM_API_KEY` exists
3. Verify it has your API key value

### 3. Deploy Application Changes

```bash
# Push to main branch - triggers deploy workflow
git add webapp/ .github/
git commit -m "Implement background BPM fetching"
git push origin main
```

### 4. Test in Production

1. Open your app at https://bandpractice.seagoat.dev
2. Import a test playlist
3. Verify songs import quickly
4. Open a song and watch BPM update in real-time
5. Check browser console for BPM fetch logs

## Benefits

1. **Faster imports**: Songs import 2-3x faster without waiting for BPM
2. **Better UX**: Users can start viewing lyrics immediately
3. **Graceful degradation**: If BPM API is down, app still works
4. **Non-blocking**: BPM fetches don't freeze the UI
5. **Independent fetches**: Each song fetches BPM independently when viewed

## Future Enhancements (Optional)

1. Add visual indicator when BPM is being fetched (small spinner next to BPM value)
2. Add "Refresh BPM" button for songs where BPM failed to fetch
3. Batch fetch BPMs for multiple songs after import completes
4. Cache BPM results to reduce API calls for re-imported songs
5. Add BPM to song search/filter criteria
