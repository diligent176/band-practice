# CLAUDE.md - AI Assistant Context Guide

## Project Overview

**Band Practice App** is a full-stack web application for managing song lyrics and practice notes during band practice sessions. The app enables users to import Spotify playlists, fetch lyrics automatically, organize songs into collections, and add line-specific notes with real-time cloud synchronization.

**Core Value Proposition**: Streamline band practice by combining Spotify playback, automatic lyrics, and collaborative note-taking in one mobile-responsive interface.

## Technology Stack

### Backend

- **Language**: Python 3.11
- **Framework**: Flask 3.1.2 (lightweight web framework)
- **Application Server**: Gunicorn 23.0.0 (WSGI HTTP server)
- **Authentication**: Firebase Authentication (Google OAuth 2.0)
- **Database**: Google Firestore (NoSQL, real-time document database)

### Frontend

- **Pure JavaScript** (no frameworks like React/Vue)
- HTML5 & CSS3
- Mobile-responsive design
- No build process - static files served directly

### Infrastructure & DevOps

- **Hosting**: Google Cloud Run (serverless containers)
- **IaC**: Terraform for infrastructure management
- **CI/CD**: GitHub Actions (automated Docker build & deploy)
- **Container**: Docker (Python 3.11-slim base)
- **Secrets**: Google Secret Manager

### External APIs

- **Spotify API**: `spotipy` 2.24.0 (playlist import, playback control)
- **Genius API**: `lyricsgenius` 3.0.1 (lyrics fetching)
- Optional: GetSongBPM, ScraperAPI

## Architecture

### Layered Architecture

```
Frontend (HTML/CSS/JS) ← viewer.html, app.js, style.css
         ↓
API Routes (Flask) ← app.py (REST endpoints)
         ↓
Business Logic (Services) ← firestore_service, lyrics_service, etc.
         ↓
Cloud Backend ← Firestore, Firebase Auth, Spotify API
```

### Service-Oriented Design

Each service encapsulates specific domain logic:

- `firestore_service.py` (929 lines) - CRUD operations for songs, collections, playlists
- `lyrics_service.py` (1015 lines) - Lyrics fetching, parsing, and customization
- `spotify_auth_service.py` - OAuth 2.0 flow and token management
- `auth_service.py` - Firebase authentication & token verification
- `user_service.py` - User profile management and admin operations
- `audit_service.py` - Action logging and monitoring

### Data Model (Firestore Collections)

- `users` - User profiles (uid, email, is_admin, last_login_at)
- `collections_v2` - Song collections/projects with sharing settings
- `songs_v2` - Individual songs with metadata, lyrics, notes, BPM
- `playlist_memory_v2` - Spotify playlist references and last-accessed tracking
- `oauth_state` - Transient OAuth CSRF tokens

**Relationships**:

```
User (1) ├─> Collections (Many) │ └─> Songs (Many) [via collection_id]
         └─> Playlists (Many)
```

## Project Structure

```
c:\github\band-practice/
├── webapp_v2/              # Main Flask application
│   ├── app.py              # Primary routes & handlers (1297 lines)
│   ├── services/           # Business logic layer
│   ├── templates/          # HTML templates (viewer.html, admin.html)
│   └── static/             # Frontend assets (js/css/images)
├── terraform/              # Infrastructure as Code (Cloud Run, Firestore, IAM)
├── .github/workflows/      # CI/CD pipelines (deploy.yml, terraform.yml)
├── .docs/                  # Comprehensive documentation
│   ├── DEPLOYMENT.md       # Complete deployment guide
│   ├── API_SETUP.md        # API configuration guide
│   ├── AUTHENTICATION.md   # Firebase auth details
│   ├── TROUBLESHOOTING.md  # Common issues & fixes
│   └── USER_SERVICE_README.md
├── requirements.txt        # Python dependencies
├── Dockerfile              # Container configuration
├── .env.example            # Configuration template
└── README.md               # Main project documentation
```

## Key Files & Their Purpose

| File                                      | Lines | Purpose                                                      |
| ----------------------------------------- | ----- | ------------------------------------------------------------ |
| `webapp_v2/app.py`                        | 1297  | Flask routes, request handlers, main entry point             |
| `webapp_v2/services/firestore_service.py` | 929   | All database operations (CRUD for songs, collections, users) |
| `webapp_v2/services/lyrics_service.py`    | 1015  | Lyrics fetching from Genius, parsing, and customization      |
| `webapp_v2/static/js/app.js`              | 5333  | Frontend UI logic, DOM manipulation, API calls               |
| `webapp_v2/static/css/style.css`          | 3510  | All styling (responsive design, themes, animations)          |
| `webapp_v2/templates/viewer.html`         | -     | Main application UI template                                 |
| `terraform/main.tf`                       | -     | Terraform & GCP provider configuration                       |
| `.github/workflows/deploy.yml`            | -     | CI/CD pipeline for automated deployment                      |

## Development Workflows

### Local Development

1. **Windows**: Run `run-local.bat` (creates venv, installs deps, starts Flask on port 8080)
2. **Configuration**: Copy `.env.example` to `.env` and populate with API keys
3. **Debug Mode**: In browser console: `localStorage.setItem('debugMode', 'true')`

### Making Code Changes

**Backend Changes (Python)**:

- Modify files in `webapp_v2/` (app.py or services/)
- Restart Flask server to see changes
- Test API endpoints using browser DevTools or Postman

**Frontend Changes (HTML/CSS/JS)**:

- Edit files in `webapp_v2/static/` or `webapp_v2/templates/`
- Hard refresh browser (Ctrl+F5) to bypass cache
- Check browser console for JavaScript errors

**Infrastructure Changes**:

- Modify Terraform files in `terraform/`
- Run `terraform plan` to preview changes
- Apply via GitHub Actions workflow or `terraform apply`

### Deployment Process

1. Push code to `main` branch
2. GitHub Actions triggers `.github/workflows/deploy.yml`
3. Workflow builds Docker image, pushes to Artifact Registry
4. Cloud Run service updates automatically
5. Monitor deployment at Cloud Run console

## Common Tasks

### Adding a New API Endpoint

1. Define route in `webapp_v2/app.py` (e.g., `@app.route('/api/new-endpoint', methods=['POST'])`)
2. Add business logic to appropriate service in `webapp_v2/services/`
3. Update frontend in `webapp_v2/static/js/app.js` to call new endpoint
4. Test locally before deploying

### Adding a New Firestore Collection

1. Update `webapp_v2/services/firestore_service.py` with new CRUD methods
2. Define indexes in `terraform/firestore.tf` if querying by multiple fields
3. Run `terraform apply` to create indexes
4. Update data access logic in service layer

### Modifying User Interface

1. Edit HTML in `webapp_v2/templates/viewer.html`
2. Update styles in `webapp_v2/static/css/style.css`
3. Add JavaScript logic in `webapp_v2/static/js/app.js`
4. Test responsiveness on mobile and desktop

### Adding a New External API Integration

1. Add API client library to `requirements.txt`
2. Create new service file in `webapp_v2/services/` (e.g., `new_api_service.py`)
3. Add API keys to Google Secret Manager (production) and `.env` (local)
4. Update Terraform secrets in `terraform/secrets.tf`
5. Document setup in `.docs/API_SETUP.md`

## Coding Conventions

### Python (Backend)

- **Style**: Follow PEP 8
- **Naming**: snake_case for functions/variables, PascalCase for classes
- **Services**: Each service is a class with static methods
- **Error Handling**: Return tuples `(data, status_code)` from routes
- **Logging**: Use `app.logger.info()` / `.error()` for debugging

### JavaScript (Frontend)

- **Style**: Semicolons optional, 2-space indentation
- **Naming**: camelCase for functions/variables
- **DOM Access**: Use `document.getElementById()` (no jQuery)
- **API Calls**: Use `fetch()` with async/await
- **Error Handling**: Try/catch blocks with user-friendly alerts

### CSS

- **Organization**: Grouped by component/feature
- **Naming**: Descriptive class names (e.g., `.song-card`, `.lyrics-line`)
- **Responsive**: Mobile-first approach with media queries
- **Colors**: CSS variables for theme consistency

### Git Workflow

- **Branch**: Feature branches from `main` (e.g., `feature/new-lyrics-parser`)
- **Commits**: Descriptive messages (e.g., "Add BPM detection to song import")
- **Pull Requests**: Required for production changes
- **Tagging**: Git tags for release versions

## Important Context for AI Assistants

### When Working on Backend Code

- Always check if a service method already exists before creating new ones
- Firestore queries require proper indexing - check `terraform/firestore.tf`
- Firebase ID tokens must be verified on all protected endpoints
- Use `firestore_service.py` for all database operations (don't create inline queries)
- Error responses should be JSON with consistent structure: `{"error": "message"}`

### When Working on Frontend Code

- No build step means changes are instant (just refresh browser)
- All state is managed in JavaScript closures (no Redux/Vuex)
- Firebase Auth UI handles login flow (don't reinvent authentication)
- Spotify playback requires user to have Premium subscription
- Mobile responsiveness is critical - always test on small screens

### When Modifying Infrastructure

- Terraform state is stored in GCS bucket (don't run locally without backend config)
- Changes to Cloud Run require updating Docker image
- Firestore indexes can take 5-10 minutes to build
- Secret Manager updates require redeploying Cloud Run service
- Always run `terraform plan` before `apply`

### Testing Strategy

- **No automated test suite currently** - manual testing required
- Test all API endpoints with different auth states (logged in, logged out, admin)
- Test mobile UI on actual devices or Chrome DevTools device emulation
- Verify Firestore writes in Firebase Console
- Check Cloud Run logs for errors after deployment

### Performance Considerations

- Large lyrics files (5000+ lines) can slow down rendering
- Firestore has query limits (max 500 docs per query)
- Cloud Run cold starts take 2-3 seconds
- Spotify API rate limits: 180 requests per minute
- Genius API rate limits: Varies by tier

### Security Best Practices

- Never commit `.env` file or API keys to Git
- All API routes must verify Firebase ID token (except public endpoints)
- Use parameterized Firestore queries to prevent injection
- Sanitize user input before displaying (especially lyrics and notes)
- Admin operations require `is_admin=True` check

## Documentation References

For detailed guides, see the `.docs/` directory:

- **DEPLOYMENT.md** - Step-by-step GCP setup and infrastructure deployment
- **API_SETUP.md** - Configuring Spotify, Genius, and optional APIs
- **AUTHENTICATION.md** - Firebase auth setup and user allowlist
- **TROUBLESHOOTING.md** - Common issues, debugging tips, and logs
- **USER_SERVICE_README.md** - User management API and admin operations

## Debugging Tips

### Backend Debugging

- Check Cloud Run logs: `gcloud run services logs read band-practice-pro`
- Local Flask logs: Printed to console by default
- Add `app.logger.info(f"Debug: {variable}")` for inspection
- Firestore data: View in Firebase Console

### Frontend Debugging

- Enable debug mode: `localStorage.setItem('debugMode', 'true')`
- Check browser console for JavaScript errors
- Network tab in DevTools shows API calls and responses
- Firebase Auth state: Check `firebase.auth().currentUser`

### Infrastructure Debugging

- Terraform errors: Run with `-debug` flag
- Cloud Run issues: Check service configuration in GCP Console
- Firestore query errors: Verify indexes in Firebase Console
- Secret Manager: Ensure Cloud Run service account has access

## Environment Variables

Key environment variables (defined in `.env` for local, Secret Manager for production):

- `FLASK_ENV` - Set to `development` or `production`
- `GENIUS_ACCESS_TOKEN` - Genius API token for lyrics fetching
- `SPOTIPY_CLIENT_ID` - Spotify API client ID
- `SPOTIPY_CLIENT_SECRET` - Spotify API client secret
- `SPOTIPY_REDIRECT_URI` - OAuth callback URL
- `FIREBASE_SERVICE_ACCOUNT_KEY` - Path to Firebase service account JSON (local only)
- `GETSONGBPM_API_KEY` - Optional: GetSongBPM API key
- `SCRAPER_API_KEY` - Optional: ScraperAPI key

## Known Limitations & Future Improvements

### Current Limitations

- No automated testing (manual QA required)
- Spotify playback requires Premium subscription
- Lyrics fetching depends on Genius API accuracy
- No real-time collaboration (changes sync on refresh)
- Collection sharing is basic (owner + collaborators list)

### Planned Improvements

- Add unit tests for services layer
- Implement WebSocket for real-time sync
- Add rate limiting on API endpoints
- Improve lyrics parsing for non-English songs
- Add bulk song import from CSV
- Implement song versioning (track lyric changes over time)

## Contact & Contribution Guidelines

- **Issues**: GitHub Issues for bug reports and feature requests
- **Pull Requests**: Always create feature branches, never commit directly to `main`
- **Code Review**: At least one review required before merging
- **Documentation**: Update CLAUDE.md and relevant .docs/ files when changing architecture

---

**Last Updated**: 2025-10-24
**Project Version**: Production-ready (deployed to Cloud Run)
