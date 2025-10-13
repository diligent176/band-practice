# GetSongBPM API Setup Guide

## Why GetSongBPM?

**Spotify deprecated their `audio_features` API endpoint in November 2024**, blocking all new applications from accessing BPM data. This app now uses GetSongBPM as an alternative.

## Overview

GetSongBPM provides a Web API that gives access to their extensive BPM database containing tempo information for millions of songs.

## Getting Your API Key

### Step 1: Register Your Application

1. Go to https://getsongbpm.com/api
2. Fill out the registration form with:
   - Your name
   - Valid email address
   - Application name (e.g., "Band Practice Pro")
   - Application description
   - Website URL (if you have one)

### Step 2: Receive Your API Key

After registration, you'll receive an API key via email that looks like:
```
abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

### Step 3: Add to Environment Variables

Add your API key to your `.env` file:

```bash
GETSONGBPM_API_KEY=your_api_key_here
```

## Important Requirements

### Mandatory Backlink

GetSongBPM API is **free but requires a backlink** to GetSongBPM.com:

- Add a link on your website or app store listing
- Link text: "BPM data provided by GetSongBPM.com"
- Link URL: https://getsongbpm.com/

**Warning:** Failure to include the backlink may result in account suspension without notice.

### Rate Limits

- The free tier has reasonable rate limits for personal use
- For high-volume applications, contact GetSongBPM for commercial options

## How It Works

The app automatically fetches BPM data when:

1. **Syncing a playlist** - Each song's BPM is fetched during sync
2. **Importing selected songs** - BPM is included with imported songs
3. **Viewing playlist details** - BPM is shown in the preview before import

### API Endpoint Used

The app uses the search endpoint:

```
GET https://api.getsongbpm.com/search/
```

**Parameters:**
- `api_key` - Your API key
- `type` - "song"
- `lookup` - "{Artist Name} {Song Title}"

**Response Example:**
```json
{
  "search": [
    {
      "id": "abc123",
      "song_title": "Master of Puppets",
      "artist": {
        "name": "Metallica"
      },
      "tempo": "220",
      "time_sig": "4/4"
    }
  ]
}
```

## Fallback Behavior

If the GetSongBPM API:
- Key is not configured
- Returns no results
- Times out or errors

The app will set BPM to `'N/A'` and continue processing the song normally.

## Testing Your API Key

Test your API key with this curl command:

```bash
curl -X GET "https://api.getsongbpm.com/search/?api_key=YOUR_API_KEY&type=song&lookup=Metallica Master of Puppets"
```

Expected response: JSON data with tempo information

## Troubleshooting

### BPM Shows 'N/A' for All Songs

**Possible Causes:**
1. API key not set in `.env` file
2. Invalid API key
3. Account suspended (missing backlink)
4. Rate limit exceeded

**Solutions:**
1. Check `.env` file has `GETSONGBPM_API_KEY=...`
2. Verify API key is correct
3. Add required backlink to GetSongBPM.com
4. Check Cloud Run logs for specific errors:
   ```bash
   gcloud run logs tail band-practice-pro --region=us-west1
   ```

### Some Songs Have BPM, Others Don't

This is normal - GetSongBPM may not have data for all songs, especially:
- Very new releases
- Obscure or indie tracks
- Songs with unusual titles/artists

The app will show 'N/A' for songs not in their database.

### API Request Failed

Check logs for specific error messages:

```bash
# Local development
# Check terminal output for "Error fetching BPM..." messages

# Cloud Run production
gcloud run logs read band-practice-pro --region=us-west1 --limit=50 | grep -i "bpm"
```

## Cost

**FREE** with mandatory backlink requirement

For commercial applications or high-volume use, contact GetSongBPM for pricing.

## API Documentation

Full API documentation: https://getsongbpm.com/api

## Alternative: Manual BPM Entry

If you prefer not to use the GetSongBPM API, you can:

1. Leave `GETSONGBPM_API_KEY` unset in `.env`
2. BPM will default to 'N/A'
3. Manually look up BPM values at https://getsongbpm.com/
4. (Future feature) Add manual BPM editing in the app UI

## Related Documentation

- [WEBAPP_DEPLOYMENT.md](WEBAPP_DEPLOYMENT.md) - Main deployment guide
- [GENIUS-API.md](GENIUS-API.md) - Lyrics fetching setup
- [lyrics_service.py](../webapp/services/lyrics_service.py) - Implementation code
