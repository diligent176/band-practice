# Deployment Guide

Complete guide for deploying the Band Practice app to Google Cloud Platform from scratch.

## Prerequisites

- Google Cloud Platform account with billing enabled
- GitHub account
- gcloud CLI installed: https://cloud.google.com/sdk/docs/install

## Deployment Overview

This app uses **Infrastructure as Code** and **Continuous Deployment**:

- **Terraform** manages all GCP resources (Firestore, Cloud Run, Secret Manager)
- **GitHub Actions** automatically builds and deploys when you push to `main`
- **Manual steps** are ONLY for initial setup and GitHub secrets

## Initial Setup (One-Time)

### 1. Create GCP Project

```bash
# Create project
gcloud projects create YOUR-PROJECT-ID --name="Band Practice"

# Set as active project
gcloud config set project YOUR-PROJECT-ID

# Enable billing (required - use GCP Console)
# https://console.cloud.google.com/billing

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### 2. Create Firestore Database

```bash
# Create Firestore in Native mode
gcloud firestore databases create --location=nam5 --type=firestore-native
```

### 3. Set Up Terraform State Bucket

```bash
# Create bucket for Terraform state
gcloud storage buckets create gs://YOUR-PROJECT-ID-terraform-state --location=us-west1

# Enable versioning
gcloud storage buckets update gs://YOUR-PROJECT-ID-terraform-state --versioning
```

### 4. Configure GitHub Repository

#### a. Set up GitHub Actions Variables

Go to your GitHub repository → Settings → Secrets and variables → Actions → Variables

Add these **Variables** (not secrets):

| Name | Value | Description |
|------|-------|-------------|
| `GCP_PROJECT_ID` | `YOUR-PROJECT-ID` | Your GCP project ID |
| `GCP_REGION` | `us-west1` | GCP region |
| `SPOTIFY_REDIRECT_URI` | `https://your-domain.com/api/spotify/callback` | Spotify OAuth redirect |

#### b. Set up GitHub Actions Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → Secrets

Add these **Secrets**:

| Name | Value | How to Get |
|------|-------|------------|
| `GCP_SA_KEY` | JSON key | See step 5 below |
| `SPOTIFY_CLIENT_ID` | Your client ID | https://developer.spotify.com/dashboard |
| `SPOTIFY_CLIENT_SECRET` | Your client secret | https://developer.spotify.com/dashboard |
| `GENIUS_ACCESS_TOKEN` | Your token | https://genius.com/api-clients |
| `FIREBASE_API_KEY` | Your API key | Firebase Console (step 6) |
| `FIREBASE_AUTH_DOMAIN` | `YOUR-PROJECT-ID.firebaseapp.com` | Firebase Console |
| `FIREBASE_PROJECT_ID` | `YOUR-PROJECT-ID` | Same as GCP project |
| `ALLOWED_USERS` | `user1@gmail.com,user2@gmail.com` | Comma-separated emails |
| `SECRET_KEY` | Random string | Generate: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `GETSONGBPM_API_KEY` | Your API key (optional) | https://getsongbpm.com/api |
| `SCRAPER_API_KEY` | Your API key (optional) | https://www.scraperapi.com/signup |

### 5. Create Service Account for GitHub Actions

```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deployment"

# Grant permissions
gcloud projects add-iam-policy-binding YOUR-PROJECT-ID \
  --member="serviceAccount:github-actions@YOUR-PROJECT-ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR-PROJECT-ID \
  --member="serviceAccount:github-actions@YOUR-PROJECT-ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding YOUR-PROJECT-ID \
  --member="serviceAccount:github-actions@YOUR-PROJECT-ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.admin"

gcloud projects add-iam-policy-binding YOUR-PROJECT-ID \
  --member="serviceAccount:github-actions@YOUR-PROJECT-ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.admin"

gcloud projects add-iam-policy-binding YOUR-PROJECT-ID \
  --member="serviceAccount:github-actions@YOUR-PROJECT-ID.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.editor"

# Create and download key
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@YOUR-PROJECT-ID.iam.gserviceaccount.com

# Copy the contents of github-actions-key.json and add to GitHub Actions secret GCP_SA_KEY
# Then DELETE the local file:
rm github-actions-key.json
```

### 6. Set Up Firebase Authentication

```bash
# Go to Firebase Console
open https://console.firebase.google.com

# Add your GCP project to Firebase (click "Add project" and select existing project)
```

Then in Firebase Console:

1. Go to **Authentication** → **Sign-in method**
2. Enable **Google** provider
3. Set support email
4. Go to **Project Settings** (gear icon)
5. Scroll to **Your apps** → Click web app icon (`</>`)
6. Register app as "Band Practice"
7. Copy the **API Key** → Add to GitHub secret `FIREBASE_API_KEY`
8. Note the **Auth Domain** → Add to GitHub secret `FIREBASE_AUTH_DOMAIN`

### 7. Configure Terraform

```bash
cd terraform

# Create terraform.tfvars
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your values
# Update: project_id, region, allowed_user_emails, etc.
```

### 8. Deploy Infrastructure with Terraform

```bash
cd terraform

# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Deploy infrastructure
terraform apply
```

This creates:
- Cloud Run service
- Firestore indexes
- Secret Manager secrets
- IAM bindings
- Artifact Registry repository

### 9. Deploy Application via GitHub Actions

```bash
# Return to project root
cd ..

# Commit and push
git add .
git commit -m "Initial deployment"
git push origin main
```

GitHub Actions will:
1. Build Docker image using Cloud Build
2. Push to Artifact Registry
3. Deploy to Cloud Run with all secrets
4. Your app will be live in ~3-5 minutes

Check deployment status in GitHub → Actions tab.

### 10. Configure Authorized Domains

After deployment, get your Cloud Run URL:

```bash
gcloud run services describe band-practice-pro --region=us-west1 --format="value(status.url)"
```

Add this domain to Firebase:

1. Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. Add your Cloud Run domain (e.g., `band-practice-pro-123456.us-west1.run.app`)
3. Click **Add domain**

And to Spotify:

1. Go to https://developer.spotify.com/dashboard
2. Select your app → **Edit Settings**
3. Add redirect URI: `https://YOUR-CLOUD-RUN-URL/api/spotify/callback`
4. Click **Add** → **Save**

## Ongoing Deployments

After initial setup, deployments are automatic:

```bash
# Make code changes
# Commit and push
git add .
git commit -m "Your change description"
git push origin main
```

GitHub Actions automatically deploys to Cloud Run. No manual steps needed!

## Infrastructure Updates

If you change Terraform configuration:

```bash
cd terraform
terraform plan
terraform apply
```

Then redeploy the app (push to main or manually trigger GitHub Actions workflow).

## Updating Secrets

To update secrets (API keys, allowed users, etc.):

1. Update the secret value in GitHub Actions Secrets
2. Re-run the deployment workflow (or push a commit)
3. GitHub Actions will update Secret Manager and redeploy

## Local Development

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your API keys
# Run locally
.\run-local.bat  # Windows
```

Access at: http://127.0.0.1:8080

## Viewing Logs

```bash
# Real-time logs
gcloud run services logs tail band-practice-pro --region=us-west1

# Recent logs
gcloud run services logs read band-practice-pro --region=us-west1 --limit=50
```

## Cost Estimate

With GCP free tier:
- Cloud Run: First 2M requests/month FREE
- Firestore: 50K reads, 20K writes/day FREE
- Cloud Build: 120 build-minutes/day FREE

**Typical monthly cost: $0 - $5**

## Security Notes

- All secrets stored in Google Secret Manager (never in code)
- Firebase Authentication required for all API endpoints
- User whitelist enforced via `ALLOWED_USERS`
- Cloud Run service uses least-privilege service account
- Infrastructure managed via Terraform (auditable, repeatable)

## Next Steps

1. Import a Spotify playlist
2. Add practice notes to songs
3. Organize songs into collections
4. Share the Cloud Run URL with your band

See [API_SETUP.md](API_SETUP.md) for detailed API configuration and [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues.
