# 🎸 Band Practice App

A real-time web application for managing song lyrics and practice notes during band practice.

## Features

✅ **Sync Spotify Playlists** - Import songs from any Spotify playlist
✅ **Auto-Fetch Lyrics** - Automatically downloads lyrics from Genius
✅ **Practice Notes** - Add line-specific notes that highlight when clicked
✅ **Real-Time Editing** - Edit notes during practice, auto-saves to cloud
✅ **Multi-Playlist Support** - Switch between different playlists anytime
✅ **Cloud Hosted** - Access from any device via single URL
✅ **Mobile Friendly** - Responsive design works on phones/tablets

## Quick Start

### Local Development (No Docker Required!)

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Run locally (Windows)
run-local.bat

# Or on Mac/Linux
chmod +x run-local.sh
./run-local.sh
```

Access at: http://localhost:8080

### Cloud Deployment

Deploy to Google Cloud Run (serverless, near-zero cost):

```bash
# One-command deploy (Cloud Build does everything - no local Docker!)
./deploy.sh
```

See [WEBAPP_DEPLOYMENT.md](WEBAPP_DEPLOYMENT.md) for complete deployment guide.

## Project Structure

```
webapp/              # Flask web application
├── app.py          # API routes and server
├── services/       # Business logic
│   ├── firestore_service.py   # Database operations
│   └── lyrics_service.py      # Spotify/Genius integration
├── templates/      # HTML templates
└── static/         # CSS and JavaScript

terraform/          # Infrastructure as code
├── main.tf         # GCP resources
└── variables.tf    # Configuration

deprecated/         # Old standalone scripts
```

## Configuration

Create `.env` file:

```bash
# GCP Configuration
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-west1

# Spotify API
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_PLAYLIST_URL=https://open.spotify.com/playlist/YOUR_ID

# Genius API
GENIUS_ACCESS_TOKEN=your_genius_token

# Flask
SECRET_KEY=your-random-secret-key
```

## Usage

1. **Sync Playlist**: Click "Sync Playlist" or use "Change Playlist" to import songs
2. **Select Song**: Choose from dropdown
3. **View Lyrics**: Numbered lyrics displayed on left
4. **Edit Notes**: Click "Edit" to add practice notes
5. **Link Notes to Lines**: Use `Line 12:` or `Lines 45-48:` syntax
6. **Click Notes**: Highlights referenced lyric lines
7. **Auto-Save**: Notes save instantly to Firestore

## Development

```bash
# Run locally
./run-local.sh  # or run-local.bat on Windows

# Deploy to cloud
./deploy.sh

# Infrastructure changes
cd terraform
terraform plan
terraform apply
```

## Documentation

- **[Deployment Guide](WEBAPP_DEPLOYMENT.md)** - Complete GCP deployment instructions
- **[Terraform README](terraform/README.md)** - Infrastructure documentation

## Tech Stack

- **Backend**: Flask (Python)
- **Database**: Google Firestore (NoSQL)
- **Hosting**: Google Cloud Run (Serverless)
- **Frontend**: Vanilla JavaScript + Modern CSS
- **APIs**: Spotify Web API, Genius API
- **Infrastructure**: Terraform

## Cost

Running on Google Cloud Platform:

- **Free Tier**: Covers most personal use
- **Expected Cost**: $0 - $5/month for typical band practice usage

## License

MIT

## Questions?

See [WEBAPP_DEPLOYMENT.md](WEBAPP_DEPLOYMENT.md) for detailed setup and troubleshooting.
