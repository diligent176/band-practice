# Deployment Guide

Complete guide for deploying the Band Practice app to Google Cloud Platform from scratch.

## Prerequisites

- Google Cloud Platform account with billing enabled
- GitHub account with this repository
- gcloud CLI installed: https://cloud.google.com/sdk/docs/install

## Deployment Philosophy

**GitHub Actions does everything.** Manual steps are ONLY for:
1. Initial GCP project creation
2. Service account creation for GitHub Actions
3. Configuring GitHub secrets/variables
4. Firebase initial setup (one-time)

Everything else (APIs, Firestore, Terraform, deployment) is automated.

## Initial Setup (One-Time Only)

### 1. Create GCP Project & Enable Billing

```bash
# Create project
gcloud projects create YOUR-PROJECT-ID --name="Band Practice"

# Set as active project
gcloud config set project YOUR-PROJECT-ID

# Enable billing (REQUIRED - must do in GCP Console)
# Go to: https://console.cloud.google.com/billing
# Link billing account to YOUR-PROJECT-ID
```

**That's it for GCP setup.** GitHub Actions will enable all APIs.

### 2. Create Service Account for GitHub Actions

This allows GitHub Actions to manage everything in your GCP project.

```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deployment"

# Grant all necessary permissions
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

gcloud projects add-iam-policy-binding YOUR-PROJECT-ID \
  --member="serviceAccount:github-actions@YOUR-PROJECT-ID.iam.gserviceaccount.com" \
  --role="roles/serviceusage.serviceUsageAdmin"

# Create key and download
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@YOUR-PROJECT-ID.iam.gserviceaccount.com

# Copy the ENTIRE contents of github-actions-key.json (including { and })
# Save for next step, then DELETE the local file:
rm github-actions-key.json
```

### 3. Configure GitHub Repository

#### a. Set GitHub Actions Variables

Go to: GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **Variables** tab

Add these **Variables**:

| Name | Value |
|------|-------|
| `GCP_PROJECT_ID` | `YOUR-PROJECT-ID` |
| `GCP_REGION` | `us-west1` |
| `SPOTIFY_REDIRECT_URI` | `https://YOUR-DOMAIN/api/spotify/callback` (update after first deploy) |

#### b. Set GitHub Actions Secrets

Go to: GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **Secrets** tab

Add these **Secrets**:

| Name | Value | How to Get |
|------|-------|------------|
| `GCP_SA_KEY` | Entire JSON key from step 2 | Copy/paste the full JSON |
| `SPOTIFY_CLIENT_ID` | Your client ID | https://developer.spotify.com/dashboard |
| `SPOTIFY_CLIENT_SECRET` | Your client secret | https://developer.spotify.com/dashboard |
| `GENIUS_ACCESS_TOKEN` | Your token | https://genius.com/api-clients |
| `FIREBASE_API_KEY` | Your API key | See step 4 below |
| `FIREBASE_AUTH_DOMAIN` | `YOUR-PROJECT-ID.firebaseapp.com` | See step 4 below |
| `FIREBASE_PROJECT_ID` | `YOUR-PROJECT-ID` | Same as GCP project |
| `ALLOWED_USERS` | `user1@gmail.com,user2@gmail.com` | Comma-separated emails |
| `SECRET_KEY` | Random string | `python -c "import secrets; print(secrets.token_hex(32))"` |
| `GETSONGBPM_API_KEY` | Your API key | https://getsongbpm.com/api (optional) |
| `SCRAPER_API_KEY` | Your API key | https://www.scraperapi.com/signup (optional) |

See [API_SETUP.md](API_SETUP.md) for detailed instructions on getting API keys.

### 4. Set Up Firebase Authentication

```bash
# Open Firebase Console
open https://console.firebase.google.com
```

In Firebase Console:

1. Click **Add project**
2. Select your existing GCP project (YOUR-PROJECT-ID)
3. Accept Firebase terms → **Continue**
4. Go to **Authentication** → **Sign-in method**
5. Enable **Google** provider, set support email
6. Go to **Project Settings** (gear icon)
7. Scroll to **Your apps** → Click web app icon (`</>`)
8. Register app as "Band Practice"
9. Copy **API Key** → Add to GitHub secret `FIREBASE_API_KEY`
10. Copy **Auth Domain** → Add to GitHub secret `FIREBASE_AUTH_DOMAIN`

### 5. Deploy Everything via GitHub Actions

```bash
# Commit and push to trigger deployment
git add .
git commit -m "Initial deployment"
git push origin main
```

**GitHub Actions will now:**
1. ✅ Enable all required GCP APIs (run, firestore, cloudbuild, etc.)
2. ✅ Create Firestore database
3. ✅ Create Terraform state bucket
4. ✅ Run Terraform to create all infrastructure
5. ✅ Build Docker image
6. ✅ Deploy to Cloud Run
7. ✅ Configure all secrets in Secret Manager

**Wait ~5-10 minutes** for workflows to complete.

Check status: GitHub repo → **Actions** tab

### 6. Post-Deployment Configuration

After deployment completes, you need to configure authorized domains.

**Get your Cloud Run URL:**

```bash
gcloud run services describe band-practice-pro --region=us-west1 --format="value(status.url)"
```

#### a. Add to Firebase Authorized Domains

1. Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. Click **Add domain**
3. Enter your Cloud Run domain (without `https://`)
   - Example: `band-practice-pro-123456.us-west1.run.app`
4. Click **Add**

#### b. Add to Spotify Redirect URIs

1. Go to https://developer.spotify.com/dashboard
2. Select your app → **Edit Settings**
3. Scroll to **Redirect URIs**
4. Add: `https://YOUR-CLOUD-RUN-URL/api/spotify/callback`
5. Also add for local dev: `http://127.0.0.1:8080/api/spotify/callback`
6. Click **Add** → **Save**

#### c. Update GitHub Variable

Update the `SPOTIFY_REDIRECT_URI` variable with your production URL:

1. GitHub repo → Settings → Secrets and variables → Actions → Variables
2. Edit `SPOTIFY_REDIRECT_URI`
3. Change to: `https://YOUR-CLOUD-RUN-URL/api/spotify/callback`
4. Click **Update variable**

**Done!** Your app is now fully deployed and configured.

## Ongoing Deployments

After initial setup, all deployments are automatic:

```bash
# Make code changes
# Commit and push
git add .
git commit -m "Your changes"
git push origin main
```

GitHub Actions automatically:
- Builds new Docker image
- Deploys to Cloud Run
- Updates all secrets from GitHub

**No manual steps. Ever.**

## Updating Secrets

To change API keys, allowed users, etc:

1. Update the value in GitHub Actions Secrets
2. Push a commit (or manually trigger deploy workflow)
3. GitHub Actions updates Secret Manager and redeploys

**No gcloud commands needed.**

## Infrastructure Changes

If you modify Terraform files:

1. Commit and push to main
2. GitHub Actions runs `terraform plan` and `terraform apply`
3. Then redeploys the app

**Terraform runs in GitHub Actions, not locally.**

## Local Development

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your API keys (same values as GitHub secrets)

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

Or use GCP Console → Cloud Run → band-practice-pro → Logs

## Cost

With GCP free tier:
- Cloud Run: 2M requests/month FREE
- Firestore: 50K reads, 20K writes/day FREE
- Cloud Build: 120 build-minutes/day FREE

**Typical monthly cost: $0 - $5**

## What GitHub Actions Manages

Everything except the initial bootstrapping:

- ✅ Enabling GCP APIs
- ✅ Creating Firestore database
- ✅ Creating Terraform state bucket
- ✅ Running Terraform (infrastructure)
- ✅ Creating Artifact Registry
- ✅ Building Docker images
- ✅ Deploying to Cloud Run
- ✅ Managing Secret Manager secrets
- ✅ Creating Firestore indexes

**You only do:**
- ❌ Create GCP project + enable billing (one-time)
- ❌ Create service account for GitHub Actions (one-time)
- ❌ Configure GitHub secrets/variables (one-time)
- ❌ Set up Firebase (one-time)
- ❌ Configure authorized domains (one-time, after first deploy)

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues.

## Next Steps

1. Sign in to your app with Google
2. Import a Spotify playlist
3. Add practice notes to songs
4. Share the URL with your band

See [API_SETUP.md](API_SETUP.md) for API configuration details.
