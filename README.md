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
- **Markdown Support** - Rich formatting in practice notes

### ⌨️ Power User Features

- **Comprehensive Keyboard Shortcuts** - Navigate without touching mouse
- **Drag-and-Drop** - Reorder playlists within collections
- **Keyboard Navigation** - Arrow keys, Home/End, Enter in all dialogs
- **Help Card** - Press `/` or `?` for full shortcut reference
- **Quick Actions** - `n` for new, `e` for edit, `p` for playlists, Delete to remove

### 🔐 Security & Auth

- **Firebase Authentication** - Google OAuth sign-in
- **Email Allowlist** - Restrict access to approved users
- **Secure API** - All endpoints require valid Firebase token
- **Audit Logging** - Track collection access and modifications

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

### Frontend Architecture (Modular JavaScript)

**Pattern:** Manager objects with `init()`, public methods, window exports. No frameworks - pure vanilla JS for simplicity and performance.

```javascript
// Each manager follows this pattern:
const ManagerName = {
    // Private state
    someState: null,

    // Initialization
    init() {
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
    },

    // Public methods
    async doSomething() { ... },

    // Helper methods
    helperFunction() { ... }
};

// Export to window for cross-module access
window.ManagerName = ManagerName;
```

**Key Managers:**

- **AuthManager** - Firebase authentication, sign in/out flows, authorization checks
- **CollectionsManager** - Collections CRUD, rendering, collaboration requests, keyboard navigation
- **PlaylistManager** - Playlist dialog, import/link/unlink, drag-and-drop reordering, keyboard nav
- **ViewManager** - SPA view switching (collections/songs/player), song list rendering, state management
- **PlayerManager** - Song playback UI, lyrics/notes editing, BPM detection, autosave
- **SpotifyPlayer** - Spotify Web Playback SDK integration, OAuth flow, playback controls

**State Management:** Global variables + localStorage for persistence. Simple and effective for this scale.

**Event Handling:** Mix of inline `onclick` (for clarity in HTML) and programmatic `addEventListener` (for complex logic).

### Backend Architecture (Flask Services)

**Pattern:** Service layer with clear separation of concerns. Each service handles one domain.

```python
# Service pattern:
class SomeServiceV3:
    def __init__(self, firestore_client):
        self.db = firestore_client

    def do_something(self, user_id: str, data: dict):
        # Business logic
        # Firestore operations
        # Return results
```

**Service Responsibilities:**

- **auth_service_v3** - Firebase token validation + email allowlist enforcement
- **user_service_v3** - User profile CRUD, initialization on first login
- **collections_service_v3** - Collection CRUD, collaboration logic, access control
- **songs_service_v3** - Song CRUD, BPM management, lazy lyrics flag
- **playlist_service_v3** - Spotify playlist import, playlist-collection linking
- **lyrics_service_v3** - Genius API integration, lyrics fetching, ScraperAPI proxy
- **spotify_service_v3** - Spotify OAuth, basic API calls (playlists, tracks, metadata)
- **spotify_playback_service_v3** - Web Playback SDK token management, refresh logic

**API Routes:** RESTful endpoints in `app.py` with `@require_auth` decorator on all routes.

### CSS Architecture

**Modular approach:** Each view has its own stylesheet, shared base provides consistency.

- **base.css** - CSS variables (colors, spacing, typography), reset, utility classes, common components (buttons, inputs, dialogs, toasts)
- **home.css** - Collections grid, collection cards, collaboration UI, keyboard help card
- **songs.css** - Song list, song cards, playlist sections
- **player.css** - Song player layout, lyrics display, notes editor, Spotify playback controls
- **auth.css** - Sign-in page, Firebase UI customization

**Design System:** CSS custom properties for theming, consistent spacing scale, mobile-first responsive design.

## 🔧 Configuration

### Environment Variables (Local Development)

Create `.env` file in project root:

```bash
# GCP Project
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-west1

# Spotify API (required)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8080/api/v3/spotify/callback

# Genius API (required for lyrics)
GENIUS_ACCESS_TOKEN=your_genius_access_token

# Firebase Auth (required)
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-firebase-project-id

# User Access Control (required)
ALLOWED_USERS=user1@gmail.com,user2@gmail.com

# Flask
SECRET_KEY=your-random-secret-key-min-32-chars
FLASK_ENV=development

# Optional APIs
GETSONGBPM_API_KEY=your_getsongbpm_key  # BPM detection
SCRAPER_API_KEY=your_scraperapi_key     # Genius scraping proxy
```

**Production:** Secrets stored in Google Secret Manager, managed by Terraform. Never commit secrets to Git.

## 📚 Usage Guide

### Getting Started

1. **Sign In** - Click "Sign in with Google", authenticate via Firebase
2. **Create Collection** - Click "New Collection", name it (e.g., "Jazz Band Setlist")
3. **Import Playlist** - Click "Playlists" button on collection, paste Spotify URL
4. **Open Song** - Click any song to view lyrics and player
5. **Add Notes** - Reference lyrics with `Line 12: Watch the timing here`
6. **Play Music** - Connect Spotify (Premium required), press spacebar to play

### Keyboard Shortcuts

**Collections View:**

- `/` or `?` - Toggle help card
- `n` - New collection
- `e` - Edit selected collection
- `p` - Open playlists dialog
- `Delete` - Delete selected collection
- Arrow keys - Navigate collection grid
- `Home`/`End` - Jump to first/last
- `Enter` - Open selected collection

**Playlist Dialog:**

- Arrow Up/Down - Navigate playlists
- `Enter` - Link/unlink selected playlist
- `Tab` - Switch between input and list
- `Home`/`End` - Jump to first/last
- `Escape` - Close dialog

**Player View:**

- `Space` - Play/pause (Spotify Premium)
- `Escape` - Return to collections

### Collaboration Workflow

1. **Create Collection** - Owner creates collection
2. **Request Access** - Collaborator clicks "Request Access" in collections list
3. **Approve Request** - Owner opens "Collaboration Requests" dialog, clicks "Accept"
4. **Collaborate** - Both users can now add playlists and edit songs
5. **Manage** - Owner can remove collaborators via "Manage Collaborators" dialog

## 🏗️ Tech Stack

| Layer                | Technology                         | Purpose                                      |
| -------------------- | ---------------------------------- | -------------------------------------------- |
| **Backend**          | Flask (Python 3.11)                | RESTful API server                           |
| **Database**         | Google Firestore                   | NoSQL document store, real-time sync         |
| **Hosting**          | Google Cloud Run                   | Serverless container platform                |
| **Auth**             | Firebase Authentication            | Google OAuth + token validation              |
| **Frontend**         | Vanilla JavaScript                 | 4,768 lines across 7 modular files           |
| **Styling**          | CSS3                               | 5 modular stylesheets, CSS custom properties |
| **Music API**        | Spotify Web API + Web Playback SDK | Playlist import + in-browser playback        |
| **Lyrics API**       | Genius API                         | Automated lyrics fetching                    |
| **IaC**              | Terraform                          | Infrastructure as Code                       |
| **CI/CD**            | GitHub Actions                     | Automated build + deploy                     |
| **Containerization** | Docker                             | Cloud Run deployment                         |

**No frameworks on frontend** - Modular vanilla JS for simplicity, maintainability, and zero build step.

## 💰 Cost Estimate

**Google Cloud Platform (with free tier):**

- Cloud Run: 2M requests/month FREE, then $0.00002400/request
- Firestore: 50K reads, 20K writes/day FREE, then $0.06/$0.18 per 100K
- Cloud Build: 120 build-minutes/day FREE
- Secret Manager: 6 secrets FREE

**Typical monthly cost: $0 - $5** for personal/small band use.

## 📖 Documentation

Comprehensive guides in `.docs/`:

- **[DEPLOYMENT.md](.docs/DEPLOYMENT.md)** - Complete deployment walkthrough
- **[FIREBASE_SETUP.md](.docs/FIREBASE_SETUP.md)** - Firebase project configuration
- **[AUTHENTICATION.md](.docs/AUTHENTICATION.md)** - Auth implementation details
- **[GENIUS-API.md](.docs/GENIUS-API.md)** - Genius API setup
- **[SPOTIFY_API.md](.docs/SPOTIFY_API.md)** - Spotify developer setup
- **[COLLECTIONS_DESIGN.md](.docs/COLLECTIONS_DESIGN.md)** - Architecture decisions
- **[LAZY_LYRICS_LOADING.md](.docs/LAZY_LYRICS_LOADING.md)** - Performance optimization

## 🛠️ Development Workflow

### Making Changes

**Benefits:**

- ✅ Maintainable - Each file has clear responsibility
- ✅ Testable - Managers can be unit tested
- ✅ Debuggable - Clear stack traces, modular breakpoints
- ✅ Scalable - Easy to add features without conflicts
- ✅ Readable - Comments, consistent patterns, logical organization

## 🤝 Contributing

This is a personal/small team project. If you fork it:

1. Update `ALLOWED_USERS` in `.env`
2. Set up your own GCP project + Firebase
3. Configure Terraform backend for your GCP bucket
4. Update GitHub secrets for your project
5. Deploy and enjoy!

## 📝 License

MIT - Use freely, attribution appreciated

---

**Built with ❤️ for musicians who code (or coders who make music)**
