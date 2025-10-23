# Band Practice App

A web application for managing song lyrics and practice notes during band practice. Import Spotify playlists, auto-fetch lyrics, organize into collections, and add line-specific notes that sync in real-time to the cloud.

## Features

- **Spotify Integration** - Import playlists and play songs in-browser (Premium required)
- **Auto Lyrics** - Fetches lyrics from Genius automatically
- **BPM Detection** - Optional automatic tempo detection
- **Collections** - Organize songs by band or project
- **Practice Notes** - Add line-specific notes with highlighting
- **Real-Time Sync** - Cloud-hosted with instant save to Firestore
- **Mobile Ready** - Responsive design works on any device
- **Authentication** - Firebase auth with user whitelist

## Quick Start

### Local Development

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys (see .docs/API_SETUP.md)

# 3. Run locally
.\run-local.bat  # Windows

# Access at http://127.0.0.1:8080
```

### Production Deployment

Deploy to Google Cloud Run using GitHub Actions (fully automated):

1. Follow [.docs/DEPLOYMENT.md](.docs/DEPLOYMENT.md) for initial setup
2. Configure API keys - see [.docs/API_SETUP.md](.docs/API_SETUP.md)
3. Push to `main` branch - GitHub Actions handles the rest

**Deployment is automatic** - no manual cloud operations needed!

## Project Structure

```
webapp/              # Flask application
├── app.py           # API routes
├── services/        # Business logic
│   ├── firestore_service.py
│   ├── lyrics_service.py
│   ├── spotify_auth_service.py
│   └── auth_service.py
├── templates/       # HTML
└── static/          # CSS and JavaScript

terraform/           # Infrastructure as Code
├── main.tf          # GCP resources
├── firestore.tf     # Database indexes
├── cloud_run.tf     # Service definition
├── secrets.tf       # Secret Manager
└── variables.tf     # Configuration

.github/workflows/   # CI/CD
├── deploy.yml       # Application deployment
└── terraform.yml    # Infrastructure deployment
```

## Configuration

Create `.env` file (for local development only):

```bash
# GCP
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-west1

# Spotify API
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8080/api/spotify/callback

# Genius API
GENIUS_ACCESS_TOKEN=your_genius_token

# Firebase Auth
FIREBASE_API_KEY=your_firebase_key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id

# User Access (comma-separated emails)
ALLOWED_USERS=user1@gmail.com,user2@gmail.com

# Flask
SECRET_KEY=your-random-secret-key

# Optional APIs
GETSONGBPM_API_KEY=your_bpm_key
SCRAPER_API_KEY=your_scraper_key
```

**Production secrets** are stored in Google Secret Manager and managed by Terraform/GitHub Actions.

## Usage

1. **Sign In** - Authenticate with Google (must be in ALLOWED_USERS)
2. **Create Collection** - Organize songs by band/project
3. **Import Playlist** - Paste Spotify playlist URL and select songs
4. **View Lyrics** - Lyrics load automatically when you open a song
5. **Add Notes** - Use `Line 12:` syntax to reference specific lyrics
6. **Play Music** - Press spacebar to play in-browser (Premium required)

### Debug Mode

Debug logging is automatically enabled on localhost and disabled in production. To manually toggle debug logs in production (for troubleshooting):

```javascript
// In browser console
localStorage.setItem('debugMode', 'true')   // Enable debug logs
localStorage.setItem('debugMode', 'false')  // Disable debug logs
// Refresh the page
```

## Documentation

- **[DEPLOYMENT.md](.docs/DEPLOYMENT.md)** - Complete deployment guide
- **[API_SETUP.md](.docs/API_SETUP.md)** - Configure Spotify, Genius, and optional APIs
- **[AUTHENTICATION.md](.docs/AUTHENTICATION.md)** - Firebase auth setup details
- **[TROUBLESHOOTING.md](.docs/TROUBLESHOOTING.md)** - Common issues and solutions

## Tech Stack

- **Backend**: Flask (Python)
- **Database**: Google Firestore (NoSQL)
- **Hosting**: Google Cloud Run (Serverless)
- **Auth**: Firebase Authentication
- **Frontend**: Vanilla JavaScript + CSS
- **APIs**: Spotify, Genius, GetSongBPM (optional), ScraperAPI (optional)
- **Infrastructure**: Terraform
- **CI/CD**: GitHub Actions

## Cost

With GCP free tier:
- Cloud Run: 2M requests/month FREE
- Firestore: 50K reads, 20K writes/day FREE
- Cloud Build: 120 build-minutes/day FREE

**Typical monthly cost: $0 - $5**

## Development Workflow

```bash
# Make changes
# Test locally
.\run-local.bat

# Deploy to production
git add .
git commit -m "Your changes"
git push origin main
# GitHub Actions automatically deploys
```

## Infrastructure Changes

If modifying Terraform configuration:

```bash
cd terraform
terraform plan
terraform apply
```

Then redeploy the application (push to main).

## Security

- Firebase Authentication on all endpoints
- User whitelist via `ALLOWED_USERS`
- All secrets in Google Secret Manager
- HTTPS enforced (Cloud Run default)
- Terraform-managed IAM permissions

## License

MIT
