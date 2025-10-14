# Band Practice App - AI Coding Agent Instructions

## Project Overview

Flask web app for managing band practice songs with lyrics, notes, and BPM. Users import Spotify playlists, auto-fetch lyrics from Genius, organize songs into Collections (bands/groupings), and add line-specific practice notes. Deployed to Google Cloud Run with Firestore database.

## Critical Architecture Patterns

### Composite Document IDs (Collections Feature)

Song IDs follow format `{collection_id}__{artist}__{title}` (see `lyrics_service.py:_create_song_id()`). This allows the same song to exist in multiple collections with independent notes/lyrics/BPM. **Never** generate IDs manually - always use `_create_song_id()` to maintain this pattern.

### Lazy Loading Pattern

Lyrics are NOT fetched during playlist import. Songs are created with `lyrics_fetched: false` flag, then lyrics load in background when user first opens a song (see `.docs/LAZY_LYRICS_LOADING.md`). This reduces import time from 40s to 5s for 6 songs. When modifying import logic, preserve this pattern.

### Firebase Authentication with User Allowlist

All API endpoints use `@require_auth` decorator. Authentication checks both Firebase token validity AND email allowlist (`ALLOWED_USERS` env var). The `g.user` object contains authenticated user info. Never bypass this - it's the security model.

### Server-Sent Events for Streaming Progress

Playlist imports use SSE (not WebSockets) to stream real-time progress. See `app.py:import_playlist()` using `Response(stream_with_context(...))` and frontend `handleServerSentEvents()` in `app.js`. Use this pattern for any long-running operations.

## File Organization

### Backend Service Layer Pattern

- `webapp/services/firestore_service.py` - ALL Firestore operations (CRUD for songs, collections, playlist memory)
- `webapp/services/lyrics_service.py` - External API integration (Spotify, Genius, GetSongBPM). **Does NOT** directly access Firestore - always calls `self.firestore.*` methods
- `webapp/services/auth_service.py` - Firebase token verification + allowlist checking
- `webapp/app.py` - Only routes/endpoints. Business logic stays in services

### Frontend Architecture

Single-page vanilla JS app (`webapp/static/js/app.js`, 2600+ lines) with no framework. State management via global variables:

- `currentSong` - Currently viewed song object
- `allSongs` - Full song list (filtered by current collection)
- `currentCollection` - Active collection object
- `authenticatedApiCall()` - Function injected from `viewer.html` that adds Firebase token to all API calls

## Development Workflow

### Running Locally

```powershell
# Windows (recommended)
.\run-local.bat  # Activates venv, sets env vars from .env, runs Flask on port 8080

# Manual activation
.\venv\Scripts\Activate.ps1
cd webapp
python app.py
```

**Debug endpoint**: Flask runs on `http://127.0.0.1:8080`. Browser must load `viewer.html` first to initialize Firebase Auth.

### Environment Variables

Copy `.env.example` to `.env` and populate ALL values. Critical ones:

- `ALLOWED_USERS` - Comma-separated emails (security gate)
- `GCP_PROJECT_ID` - Must match Firebase project
- `SPOTIFY_CLIENT_*` and `GENIUS_ACCESS_TOKEN` - Required for core features
- `FLASK_ENV=development` - Enables local Firebase credentials via `GOOGLE_APPLICATION_CREDENTIALS`

### Deployment (Automatic via GitHub Actions)

- Push to `main` branch → `.github/workflows/deploy.yml` triggers
- Builds Docker image → Pushes to Artifact Registry → Deploys to Cloud Run
- Secrets injected via Google Secret Manager (configured in `terraform/secrets.tf`)
- **Never commit secrets** - they're stored in GCP Secret Manager

## Common Development Tasks

### Adding New API Endpoint

1. Create method in appropriate service (`firestore_service.py` or `lyrics_service.py`)
2. Add route in `app.py` with `@require_auth` decorator
3. Add frontend function in `app.js` using `authenticatedApiCall(endpoint, options)`
4. If querying Firestore by new field, add index in `terraform/firestore.tf`

### Modifying Song Data Structure

Song documents in Firestore have these critical fields:

```javascript
{
  id: "collection_id__artist__title",  // Composite ID
  title, artist, album, year,
  lyrics, lyrics_numbered,              // Auto-generated with line numbers
  lyrics_fetched: true/false,           // Lazy load flag
  is_customized: true/false,            // User edited lyrics
  notes: "",                            // Markdown with Line X: syntax
  bpm, bpm_manual: true/false,          // Auto-fetched or user-set
  collection_id: "abc123",              // Parent collection
  created_at, updated_at                // Timestamps
}
```

Changing schema? Update `firestore_service.py:create_or_update_song()` AND frontend `renderSong()` in `app.js`.

### Testing Changes

**No automated tests exist.** Testing is manual:

1. Import a Spotify playlist (test SSE progress, lazy lyrics)
2. Switch between collections (test localStorage persistence)
3. Edit notes/lyrics (test auto-save, customization badge)
4. Refresh lyrics (test force_overwrite confirmation flow)

## Terraform Infrastructure

All GCP resources defined in `terraform/` split across files:

- `firestore.tf` - Database + composite indexes (critical for query performance)
- `cloud_run.tf` - Service definition with env vars + secrets
- `secrets.tf` - Secret Manager resources (API keys stored here, not .env)
- `iam.tf` - Service accounts + permissions

**Run terraform manually** - not automated. Changes require:

```powershell
cd terraform
terraform plan
terraform apply  # Review plan carefully
```

### Critical Firestore Indexes

```hcl
# Required for efficient queries - missing these = slow/failed queries
collections_user_name         # Get user's collections sorted by name
songs_collection_artist_title # Get songs in collection sorted by artist/title
```

## External API Integration Patterns

### Spotify API (via spotipy library)

`lyrics_service.py` uses client credentials flow. Rate limits handled by spotipy. To add playlist support: use `spotify.playlist()` and `spotify.playlist_items()`.

### Genius API (lyrics fetching)

Two-step process:

1. Search API (`/search`) - Find song URL by title/artist
2. Web scraping (`BeautifulSoup`) - Extract lyrics HTML from song page

**ScraperAPI integration**: Optional proxy (`SCRAPER_API_KEY` env var) to bypass IP blocking. Falls back to direct requests with User-Agent headers.

### GetSongBPM API (tempo detection)

Simple REST API, key in `GETSONGBPM_API_KEY`. Fails gracefully - BPM marked as `NOT_FOUND` if lookup fails.

## Common Gotchas

### Authentication Required on ALL Endpoints

Don't forget `@require_auth` decorator. Frontend automatically adds token via `authenticatedApiCall()`. Testing locally? Get token from browser DevTools → Application → IndexedDB → firebaseLocalStorage → idToken.

### Collection-Aware Song IDs

When creating/updating songs, ALWAYS pass `collection_id` to `_create_song_id()`. Forgetting this breaks multi-collection support.

### Frontend State Sync

After updating song data via API, update BOTH `currentSong` AND `allSongs` array. Frontend renders from `currentSong`, song selector renders from `allSongs`.

### Firestore Query Limits

Firestore requires indexes for compound queries. Missing index = runtime error. Check Cloud Console → Firestore → Indexes or define in `terraform/firestore.tf`.

## Documentation

- Architecture decisions: `.docs/COLLECTIONS_FIXED_DESIGN.md`, `.docs/LAZY_LYRICS_LOADING.md`
- Deployment: `.docs/WEBAPP_DEPLOYMENT.md`
- API setup: `.docs/GENIUS-API.md`, `.docs/GETSONGBPM-API.md`, `.docs/SCRAPERAPI_SETUP.md`
- Authentication: `.docs/AUTHENTICATION.md`, `.docs/FIREBASE_SETUP.md`

## Key Commands

```powershell
# Local dev
.\run-local.bat

# Deploy (automatic)
git push origin main

# Terraform changes
cd terraform
terraform plan
terraform apply

# View logs (production)
gcloud run services logs read band-practice-pro --region=us-west1
```
