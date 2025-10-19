# API Setup Guide

This guide covers setting up all external APIs used by the Band Practice app.

## Required APIs

### 1. Spotify API (Required)

Used for importing playlists and OAuth playback control.

#### Setup Steps

1. Go to https://developer.spotify.com/dashboard
2. Log in with your Spotify account
3. Click **Create an App**
4. Fill in details:
   - **App Name**: Band Practice
   - **App Description**: Song lyrics and practice notes manager
   - **Redirect URI**: (add after deployment - see below)
5. Click **Create**
6. Copy your **Client ID** and **Client Secret**

#### Add to GitHub Secrets

- `SPOTIFY_CLIENT_ID` → Your Client ID
- `SPOTIFY_CLIENT_SECRET` → Your Client Secret

#### Configure Redirect URIs (After Deployment)

After deploying to Cloud Run, add redirect URIs:

1. Go back to Spotify Dashboard → Your app → **Edit Settings**
2. Add these redirect URIs:
   - Local dev: `http://127.0.0.1:8080/api/spotify/callback`
   - Production: `https://YOUR-CLOUD-RUN-URL/api/spotify/callback`
3. Click **Add** → **Save**

Update GitHub Actions variable:
- `SPOTIFY_REDIRECT_URI` → `https://YOUR-CLOUD-RUN-URL/api/spotify/callback`

#### Notes

- Free tier is sufficient for personal use
- OAuth playback requires Spotify Premium account
- Playlist import works with free Spotify accounts

---

### 2. Genius API (Required)

Used for fetching song lyrics.

#### Setup Steps

1. Go to https://genius.com/api-clients
2. Sign in (or create Genius account)
3. Click **New API Client**
4. Fill in details:
   - **App Name**: Band Practice
   - **App Website URL**: Your Cloud Run URL or GitHub repo
   - **Redirect URI**: (not needed, leave blank)
5. Click **Save**
6. Click **Generate Access Token**
7. Copy the access token

#### Add to GitHub Secrets

- `GENIUS_ACCESS_TOKEN` → Your access token

#### Notes

- Free tier includes search and metadata
- Lyrics are scraped from HTML (see ScraperAPI section for IP blocking solution)
- Rate limits are generous for personal use

---

## Optional APIs

### 3. GetSongBPM API (Optional)

Used for automatic BPM detection. If not configured, BPM shows as "N/A".

#### Setup Steps

1. Go to https://getsongbpm.com/api
2. Fill out registration form:
   - Name and email
   - Application name: "Band Practice"
   - Application description
3. Receive API key via email

#### Add to GitHub Secrets

- `GETSONGBPM_API_KEY` → Your API key

#### Requirements

**IMPORTANT**: GetSongBPM requires a backlink to their website.

Add this to your app or documentation:
```
BPM data provided by GetSongBPM.com
```

Link to: https://getsongbpm.com/

Failure to include the backlink may result in account suspension.

#### Notes

- Free tier available
- Covers most popular songs
- Obscure/new tracks may not have BPM data

---

### 4. ScraperAPI (Optional)

Used to bypass IP blocking when scraping Genius lyrics. If not configured, direct requests are attempted (may fail from Cloud Run IPs).

#### Why You Need This

Genius blocks requests from some IP addresses (especially cloud providers). ScraperAPI rotates IPs and handles anti-bot measures.

#### Setup Steps

1. Go to https://www.scraperapi.com/signup
2. Sign up for free account (no credit card required)
3. Copy your API key from the dashboard

#### Add to GitHub Secrets

- `SCRAPER_API_KEY` → Your API key

#### Notes

- Free tier: 1,000 requests/month
- Each song sync = 1 request
- ~50 songs in playlist = 50 requests per sync
- Monitor usage at https://www.scraperapi.com/dashboard

#### Alternatives

If you don't want to use ScraperAPI:

1. Leave `SCRAPER_API_KEY` unset
2. App falls back to direct requests with browser headers
3. May work or may get 403 Forbidden errors
4. Local development usually works fine

---

## API Integration Details

### How APIs Are Used

```
User imports playlist
    ↓
Spotify API: Get playlist tracks
    ↓
For each song:
    ↓
    Genius API: Search for song
    ↓
    ScraperAPI (optional): Fetch lyrics page
    ↓
    Parse lyrics from HTML
    ↓
    GetSongBPM API (optional): Get tempo
    ↓
    Save to Firestore
```

### Error Handling

The app gracefully handles API failures:

- **Genius fails**: Lyrics show as "Could not retrieve lyrics"
- **GetSongBPM fails**: BPM shows as "N/A"
- **ScraperAPI fails**: Falls back to direct request
- **Spotify fails**: Shows error message, import stops

### Rate Limits

- **Spotify**: Generous, rarely hit for personal use
- **Genius**: ~100 requests per minute (unofficial)
- **GetSongBPM**: Contact provider for limits
- **ScraperAPI**: Based on plan (1,000/month free tier)

## Local Development

For local testing, create a `.env` file:

```bash
# Spotify
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8080/api/spotify/callback

# Genius
GENIUS_ACCESS_TOKEN=your_genius_token

# Optional
GETSONGBPM_API_KEY=your_bpm_key
SCRAPER_API_KEY=your_scraper_key
```

## Testing API Keys

### Test Spotify

```bash
curl -X POST "https://accounts.spotify.com/api/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"
```

Should return an access token.

### Test Genius

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  "https://api.genius.com/search?q=Metallica Master of Puppets"
```

Should return search results.

### Test GetSongBPM

```bash
curl "https://api.getsongbpm.com/search/?api_key=YOUR_API_KEY&type=song&lookup=Metallica Master of Puppets"
```

Should return tempo data.

### Test ScraperAPI

```bash
curl "http://api.scraperapi.com?api_key=YOUR_API_KEY&url=https://genius.com"
```

Should return Genius homepage HTML.

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common API issues.

## Cost Summary

| API | Free Tier | Typical Monthly Cost |
|-----|-----------|---------------------|
| Spotify | Unlimited (personal use) | $0 |
| Genius | Unlimited | $0 |
| GetSongBPM | Reasonable limits | $0 (with backlink) |
| ScraperAPI | 1,000 requests/month | $0 - $49 |

**Total: $0/month** for typical band practice use.
