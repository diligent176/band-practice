# 🥁 Band Practice Pro - Web Application Deployment Guide

A real-time web application for viewing song lyrics and managing drummer notes during band practice.

## Overview

This is a Flask web application deployed to Google Cloud Platform that:

- ✅ Syncs songs from your Spotify playlist
- ✅ Fetches lyrics from Genius
- ✅ Stores everything in Firestore (NoSQL database)
- ✅ Allows real-time note editing during practice
- ✅ Shows line-by-line note highlighting
- ✅ Auto-saves notes to the cloud
- ✅ Accessible from any device via one URL

## Architecture

```
┌─────────────────┐
│   Cloud Run     │  ← Flask App (Serverless)
│  (Web Server)   │
└────────┬────────┘
         │
         ├──────────────┐
         │              │
    ┌────▼─────┐   ┌───▼──────┐
    │Firestore │   │ APIs:    │
    │(Database)│   │- Spotify │
    └──────────┘   │- Genius  │
                   └──────────┘
```

## Prerequisites

### 1. GCP Account Setup

- Google Cloud Platform account (free tier available)
- Billing enabled (Cloud Run has generous free tier)
- gcloud CLI installed: https://cloud.google.com/sdk/docs/install

### 2. API Credentials (You Already Have These!)

- Spotify Client ID & Secret
- Genius Access Token

### 3. Local Tools

- Docker Desktop (only needed for manual deployment, not required for local development)
- Terraform (optional, for infrastructure as code)

## Quick Start Deployment

### Option A: Manual Deployment (Fastest)

#### Step 1: Set Up GCP Project

```bash
# Create a new GCP project (or use existing)
gcloud projects create band-practice-pro --name="Band Practice"

# Set as active project
gcloud config set project band-practice-pro

# update your Application Default Credentials quota project
gcloud auth application-default set-quota-project band-practice-pro

# Enable billing (required) https://console.cloud.google.com/billing
# OR List available billing accounts
gcloud billing accounts list

# Link billing account to your project (replace BILLING_ACCOUNT_ID)
gcloud billing projects link band-practice-pro --billing-account=BILLING_ACCOUNT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

#### Step 2: Create Firestore Database

```bash
# Create Firestore database (choose your region)
gcloud firestore databases create --location=nam5 --type=firestore-native
```

#### Step 3: Create Artifact Registry

```bash
# Create Docker repository
gcloud artifacts repositories create band-practice-pro \
    --repository-format=docker \
    --location=us-west1 \
    --description="Band Practice Viewer Docker images"

# Configure Docker authentication
gcloud auth configure-docker us-west1-docker.pkg.dev
```

#### Step 4: Configure Environment

Create a `.env` file in the project root:

```bash
# GCP Configuration
GCP_PROJECT_ID=band-practice-pro
GCP_REGION=us-west1

# Spotify API (from your existing setup)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_PLAYLIST_URL=https://open.spotify.com/playlist/YOUR_PLAYLIST_ID

# Genius API (from your existing setup)
GENIUS_ACCESS_TOKEN=your_genius_token

# Flask Secret (generate a random string)
SECRET_KEY=your-super-secret-random-key-here
```

#### Step 5: Deploy via GitHub Actions

Deployment is automated via GitHub Actions. Simply push your code to trigger deployment:

```bash
git add .
git commit -m "Initial deployment"
git push
```

GitHub Actions will:

1. Build Docker image using Cloud Build
2. Push to Artifact Registry
3. Deploy to Cloud Run
4. Your app will be live in ~3-5 minutes

**Your app will be live at:** `https://band-practice-pro-XXXXX.run.app`

---

### Option B: Terraform Deployment (Infrastructure as Code)

For reproducible deployments and team environments:

#### Create the state bucket first (manually)

gcloud storage buckets create gs://band-practice-pro-terraform-state --location=us-west1

#### Enable versioning

gcloud storage buckets update gs://band-practice-pro-terraform-state --versioning

#### Step 1: Configure Terraform

```bash
cd terraform

# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your values
nano terraform.tfvars
```

#### Step 2: Initialize and Deploy

```bash
# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply infrastructure
terraform apply
```

#### Step 3: Deploy Application via GitHub Actions

```bash
# Return to project root
cd ..

# Push to trigger GitHub Actions deployment
git add .
git commit -m "Deploy infrastructure"
git push
```

---

## Using the Application

### Initial Setup

1. **Open your app URL** in a browser
2. **Click "Sync Playlist"** to fetch all songs from Spotify
3. Wait for sync to complete (shows progress)
4. Songs appear in the dropdown

### During Band Practice

1. **Select a song** from the dropdown
2. View lyrics on the left panel
3. **Click "Edit"** to add/modify drummer notes
4. Use syntax: `Line 12: Your note here` or `Lines 45-48: Your note`
5. **Click "Save"** - notes saved instantly to Firestore
6. **Click note blocks** to highlight referenced lyric lines
7. Switch between songs seamlessly

### Live Note Editing

Notes are saved to Firestore in real-time. You can:

- Edit notes on any device
- Multiple people can view simultaneously
- Notes persist forever
- No copying/syncing needed

### Refreshing Lyrics

If lyrics are wrong or outdated:

1. Select the song
2. Click **"Refresh Lyrics"**
3. Fetches fresh data from Genius

## Application Structure

```
webapp/
├── app.py                      # Flask main application
├── services/
│   ├── firestore_service.py   # Database operations
│   └── lyrics_service.py      # Spotify/Genius integration
├── templates/
│   └── viewer.html            # Main UI template
└── static/
    ├── css/
    │   └── style.css          # Dark theme styling
    └── js/
        └── app.js             # Frontend JavaScript

terraform/
├── main.tf                    # Infrastructure definition
├── variables.tf               # Configurable variables
└── terraform.tfvars.example   # Template for your values

Dockerfile                     # Container definition
deploy.sh                      # Deployment automation
```

## Firestore Data Model

### Songs Collection

```javascript
{
  "id": "Badfish__Sublime",
  "title": "Badfish",
  "artist": "Sublime",
  "album": "40oz. To Freedom",
  "year": "1992",
  "bpm": "92",
  "spotify_uri": "spotify:track:xxx",
  "lyrics": "Full lyrics text...",
  "lyrics_numbered": "Numbered lyrics with line refs...",
  "notes": "Line 12: Drummer notes here...",
  "created_at": "2024-10-04T...",
  "updated_at": "2024-10-04T...",
  "notes_updated_at": "2024-10-04T..."
}
```

## Cost Estimate

### Free Tier (Typical Use)

- **Cloud Run**: 2 million requests/month FREE
- **Firestore**: 50,000 reads, 20,000 writes/day FREE
- **Cloud Build**: 120 build-minutes/day FREE

### Expected Monthly Cost: **$0 - $5**

(Assuming weekly band practice, ~100 song edits/month)

## Updating the Application

### Update Code

```bash
# Make your changes to webapp/ files
# Then commit and push to trigger deployment
git add .
git commit -m "Update application"
git push
```

### Update Infrastructure

```bash
cd terraform
terraform apply
```

## Troubleshooting

### Deployment Fails

**Error: Permission denied**

```bash
# Re-authenticate
gcloud auth login
gcloud auth configure-docker us-west1-docker.pkg.dev
```

**Error: APIs not enabled**

```bash
# Enable all required APIs
gcloud services enable run.googleapis.com firestore.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com
```

### Application Issues

**Songs not loading**

- Check Firestore console: https://console.cloud.google.com/firestore
- Verify API credentials in Cloud Run environment variables

**Sync fails**

- Check Spotify/Genius API credentials
- View logs: `gcloud run logs read band-practice-pro --region=us-west1`

**Notes not saving**

- Check Cloud Run service account has Firestore permissions
- View browser console for JavaScript errors

### View Logs

```bash
# Stream live logs
gcloud run logs tail band-practice-pro --region=us-west1

# View recent logs
gcloud run logs read band-practice-pro --region=us-west1 --limit=50
```

## Security Considerations

### Current Setup (Public Access with Firebase Auth)

Cloud Run is configured with `allUsers` IAM permission to allow unauthenticated access at the infrastructure level. However, the application enforces Firebase authentication internally, meaning:

- Cloud Run allows all traffic through (no 403 errors)
- The Flask app requires Firebase auth tokens for all protected endpoints
- Only authenticated users can view/edit content
- This approach simplifies deployment while maintaining security

### Adding Additional IAM Restrictions

If you want to add additional IAM-level restrictions on top of Firebase auth:

Update [terraform/main.tf](terraform/main.tf):

```hcl
# Remove or comment out public access
# resource "google_cloud_run_service_iam_member" "public_access" {
#   ...
# }

# Add authenticated users
resource "google_cloud_run_service_iam_member" "authorized_users" {
  service  = google_cloud_run_service.band_practice_viewer.name
  location = google_cloud_run_service.band_practice_viewer.location
  role     = "roles/run.invoker"
  member   = "user:your-email@gmail.com"
}
```

## Backup and Recovery

### Export Firestore Data

```bash
# Export all data
gcloud firestore export gs://YOUR_BUCKET_NAME/backup

# Restore from backup
gcloud firestore import gs://YOUR_BUCKET_NAME/backup
```

## Development Workflow

### Run Locally

**Windows:**

```bash
# Use the provided batch script
run-local.bat
```

This script will:
1. Load environment variables from `.env`
2. Start the Flask development server
3. Make the app available at http://localhost:8080

**Manual method (if needed):**

```bash
cd webapp

# Install dependencies
pip install -r ../requirements.txt

# Set environment variables (or use .env file)
set GCP_PROJECT_ID=your-project
set SPOTIFY_CLIENT_ID=xxx
# ... other env vars

# Run Flask dev server
python app.py
```

Access at: http://localhost:8080

### Test Docker Build

```bash
# Build locally
docker build -t band-practice-pro .

# Run locally
docker run -p 8080:8080 \
  -e GCP_PROJECT_ID=xxx \
  -e SPOTIFY_CLIENT_ID=xxx \
  band-practice-pro
```

## Next Steps

1. **Customize the UI**: Edit [webapp/static/css/style.css](webapp/static/css/style.css)
2. **Add features**: Modify [webapp/app.py](webapp/app.py) and [webapp/static/js/app.js](webapp/static/js/app.js)
3. **Set up CI/CD**: Use Cloud Build triggers for auto-deployment
4. **Add authentication**: Implement Google Sign-In
5. **Mobile app**: The UI is responsive - add to home screen!

## Support

- **GCP Console**: https://console.cloud.google.com
- **Firestore Console**: https://console.cloud.google.com/firestore
- **Cloud Run Console**: https://console.cloud.google.com/run

---

## Summary

You now have a **production-ready web application** that:

- ✅ One URL to access anywhere
- ✅ Real-time note editing and saving
- ✅ No file syncing or copying needed
- ✅ Automatically scales with Cloud Run
- ✅ Costs almost nothing ($0-5/month)
- ✅ Professional infrastructure with Terraform
- ✅ Easy to maintain and update

**Rock on! 🎸🥁**
