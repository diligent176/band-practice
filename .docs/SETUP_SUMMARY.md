# 🎸 Band Practice App - Setup Summary

https://band-practice-pro-425083870011.us-west1.run.app

## What You Have

A complete, production-ready web application for managing song lyrics and practice notes.

## Changes Made

### 1. ✅ Cleaned Up Directory

- Moved all old scripts to `deprecated/` folder
- Clean project structure with only relevant files

### 2. ✅ Renamed Everything

- **Old**: "band-practice-pro"
- **New**: "band-practice-pro" (it's more than a viewer!)
- Updated in: Terraform, deploy scripts, all documentation

### 3. ✅ Changed Terminology

- **Old**: "Drummer Notes"
- **New**: "Practice Notes" (more generic, works for any band member)

### 4. ✅ Added Playlist Selector

- "Change Playlist" button in UI
- Switch between different Spotify playlists anytime
- No need to redeploy when changing playlists!

### 5. ✅ Removed Docker Requirement

- **Local Development**: Just run Python directly (`run-local.bat`)
- **Cloud Deployment**: Cloud Build handles Docker for you
- No need to install Docker locally!

## Quick Start

### Run Locally (Test Drive)

**Windows:**

```bash
run-local.bat
```

**Note:** Only `run-local.bat` exists for Windows. There is no Mac/Linux version (`run-local.sh` does not exist).

Access at: http://localhost:8080

### Deploy to Cloud

Deployment is handled via GitHub Actions. Push your changes to the repository and the workflow will automatically deploy to Cloud Run.

## Your Workflow

### Development (Local)

1. Edit code in `webapp/`
2. Run `run-local.bat` to test
3. Make changes, refresh browser
4. Repeat

### Deploy Changes

1. Make sure code works locally
2. Commit and push your changes to GitHub
3. GitHub Actions automatically deploys to Cloud Run
4. Done! Live in ~3 minutes

## File Organization

```
band-practice-pro/
├── webapp/                    # 👈 Your web app code
│   ├── app.py                # Flask routes
│   ├── services/             # Business logic
│   ├── templates/            # HTML
│   └── static/               # CSS & JS
│
├── terraform/                # 👈 Infrastructure
│   ├── main.tf              # GCP resources
│   └── variables.tf         # Configuration
│
├── run-local.bat             # 👈 Run locally (Windows)
├── .env                      # 👈 Your secrets (not in git)
├── README.md                 # 👈 Project overview
└── .docs/                    # 👈 Documentation
```

## Environment Setup

Your `.env` file should have:

```bash
# GCP
GCP_PROJECT_ID=band-practice-pro
GCP_REGION=us-west1

# Spotify
SPOTIFY_CLIENT_ID=<REPLACE_WITH_CLIENT_ID>
SPOTIFY_CLIENT_SECRET=<REPLACE_WITH_CLIENT_SECRET>
SPOTIFY_PLAYLIST_URL=https://open.spotify.com/playlist/3U1OFYCOg0sGEGMQEGz5u8

# Genius
GENIUS_ACCESS_TOKEN=<REPLACE_TOKEN>

# Flask
SECRET_KEY=your-random-secret-key-here
```

## Next Steps

### 1. Try It Locally First

```bash
# Windows only
run-local.bat
```

This runs the app on your computer so you can see how it works!

### 2. Set Up GCP (When Ready to Deploy)

Follow [WEBAPP_DEPLOYMENT.md](WEBAPP_DEPLOYMENT.md) for step-by-step instructions.

Basic steps:

```bash
# Create GCP project
gcloud projects create band-practice-pro --name="Band Practice Pro"

# Enable APIs
gcloud services enable run.googleapis.com firestore.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# Create Firestore database
gcloud firestore databases create --location=nam5

# Create Docker repository
gcloud artifacts repositories create band-practice-pro --repository-format=docker --location=us-west1

# Deploy via GitHub Actions
git push
```

### 3. Use Your App

1. Open the Cloud Run URL
2. Click "Sync Playlist" to import songs
3. Select a song
4. Click "Edit" to add practice notes
5. Rock on! 🎸

## Features You'll Love

### Real-Time Note Editing

- Edit notes during practice
- Auto-saves to Firestore
- See changes instantly

### Line Highlighting

- Click a note block
- Referenced lyric lines highlight
- Scrolls to the right section

### Playlist Switching

- Click "Change Playlist"
- Paste new Spotify playlist URL
- Sync instantly

### Mobile Friendly

- Open on your phone
- Responsive design
- Works great on tablets

## Costs

**Free Tier Covers:**

- Cloud Run: 2M requests/month
- Firestore: 50K reads, 20K writes/day
- Cloud Build: 120 minutes/day

**Typical Monthly Cost:** $0 - $5

## Need Help?

- **README**: [README.md](README.md)
- **Deployment**: [WEBAPP_DEPLOYMENT.md](WEBAPP_DEPLOYMENT.md)
- **Code Issues**: Check Flask logs

## What's Different from Old Version?

### Old (Deprecated)

- ❌ Local files only
- ❌ Manual regeneration needed
- ❌ Browser security issues
- ❌ No real-time editing
- ❌ Couldn't access remotely

### New (Current)

- ✅ Cloud-hosted database
- ✅ Auto-saves everything
- ✅ Works anywhere
- ✅ Real-time note editing
- ✅ One URL for band

## Summary

You now have a **professional web application** that:

1. **Just Works** - No file syncing, no regeneration
2. **One URL** - Access from anywhere
3. **Real-Time** - Edit notes during practice, saves instantly
4. **Easy Deploy** - One command to update
5. **Near Free** - Costs almost nothing to run
6. **Mobile Ready** - Works on any device

**Next:** Try it locally with `run-local.bat`, then deploy when ready!

🎸 Rock on! 🥁
