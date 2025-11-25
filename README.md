# Band Practice Pro v3

A modern web application for managing band practice sessions. Import Spotify playlists, auto-fetch lyrics from Genius, organize songs into collaborative collections, add practice notes with line-specific highlighting, and play music directly in your browser.

**Production-ready single-page application** with real-time cloud sync, Spotify Web Playback integration, collaborative features, and comprehensive keyboard shortcuts.

## ✨ Features

### 🎵 Music Management

- **Spotify Playlist Import** - Paste a playlist URL, select songs, instant import
- **Auto-Fetch Lyrics** - Genius API integration with lazy loading for performance
- **Spotify Web Playback** - Play songs directly in browser (Premium required)
- **BPM Detection** - Manual tap-to-detect BPM with visual metronome
- **Smart Song Grouping** - Organize by collections (bands, projects, setlists)

### 🤝 Collaboration

- **Multi-User Collections** - Share collections with bandmates
- **Access Requests** - Request access to others' collections
- **Collaborator Management** - Add/remove collaborators with role display
- **Real-Time Sync** - Changes saved instantly to Firestore

### 📝 Practice Tools

- **Line-Specific Notes** - Reference lyrics with `Line 12:` syntax
- **Custom Lyrics** - Edit/customize lyrics when auto-fetch misses
- **Lyrics Protection** - Confirmation dialog prevents accidental overwrite
- **Note Highlighting** - Visual connection between notes and lyric lines

### ⌨️ Power User Features

- **Comprehensive Keyboard Shortcuts** - Navigate without touching mouse
- **Drag-and-Drop** - Reorder playlists within collections
- **Keyboard Navigation** - Arrow keys, Home/End, Enter in all dialogs
- **Help Card** - Press `/` or `?` for full shortcut reference
- **Quick Actions** - `n` for new, `e` for edit, `p` for playlists, Delete to remove

## 🚀 Quick Start

### Local Development

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys and allowed user emails

# 3. Run the app
cd webapp_v3
python app.py

# 4. Access at http://127.0.0.1:8080
```

### Production Deployment

**Fully automated via GitHub Actions:**

```bash
# Initial setup (one-time)
# 1. Follow .docs/DEPLOYMENT.md
# 2. Configure Terraform backend and GCP project
# 3. Set up GitHub secrets

# Deploy to production
git add .
git commit -m "Your changes"
git push origin main
# GitHub Actions automatically builds Docker image and deploys to Cloud Run
```

## 📁 Project Architecture

### High-Level Structure

```
webapp_v3/                    # Main application (v3 = current production)
├── app.py                    # Flask application with API routes
├── services/                 # Backend business logic
│   ├── auth_service_v3.py           # Firebase token validation + allowlist
│   ├── user_service_v3.py           # User profile management
│   ├── collections_service_v3.py    # Collections CRUD + collaboration
│   ├── songs_service_v3.py          # Song management + BPM
│   ├── playlist_service_v3.py       # Playlist import/linking
│   ├── lyrics_service_v3.py         # Genius API + lyrics fetching
│   ├── spotify_service_v3.py        # Spotify OAuth + basic API
│   └── spotify_playback_service_v3.py  # Web Playback SDK token mgmt
├── templates/                # Jinja2 HTML templates
│   └── home.html                    # Main SPA template (941 lines, mostly HTML)
└── static/                   # Frontend assets
    ├── css/                  # Modular stylesheets
    │   ├── base.css                 # Variables, reset, typography, utilities
    │   ├── home.css                 # Collections view styling
    │   ├── songs.css                # Songs list view styling
    │   ├── player.css               # Player view styling
    │   └── auth.css                 # Authentication UI
    └── js/                   # Modular JavaScript (4,768 total lines)
        ├── common.js                # Utilities (dialogs, API calls, toasts) - 364 lines
        ├── authManager.js           # Firebase auth + sign in/out - 240 lines
        ├── collectionsManager.js    # Collections CRUD + keyboard nav - 969 lines
        ├── playlistManager.js       # Playlist dialog + drag-drop - 506 lines
        ├── viewManager.js           # SPA view switching + songs list - 650 lines
        ├── player.js                # Song player + lyrics/notes editor - 1,549 lines
        └── spotify_player.js        # Spotify Web Playback SDK - 490 lines

terraform/                    # Infrastructure as Code
├── main.tf                   # GCP provider + backend config
├── firestore.tf              # Database indexes (critical for query performance)
├── cloud_run.tf              # Serverless service definition
├── secrets.tf                # Secret Manager resources
├── iam.tf                    # Service accounts + permissions
├── artifact_registry.tf      # Docker image repository
└── variables.tf              # Configuration inputs

.github/workflows/            # CI/CD automation
└── deploy.yml                # Build Docker → Deploy Cloud Run
```
