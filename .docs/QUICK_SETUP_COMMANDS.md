# Quick ScraperAPI Setup Commands

## Step 1: Get Your ScraperAPI Key
1. Go to: https://www.scraperapi.com/signup
2. Sign up (free, no credit card)
3. Copy your API key from dashboard

## Step 2: Add Secret to Google Cloud (REQUIRED)

Replace `YOUR_SCRAPER_API_KEY` with your actual key:

```bash
# Create the secret in Google Cloud
echo -n "YOUR_SCRAPER_API_KEY" | gcloud secrets create SCRAPER_API_KEY \
    --data-file=- \
    --project=band-practice-pro

# Grant Cloud Run access to the secret
gcloud secrets add-iam-policy-binding SCRAPER_API_KEY \
    --member="serviceAccount:425083870011-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --project=band-practice-pro
```

## Step 3: Update Lyrics Service

```bash
cd /c/github/band-practice/webapp/services

# Backup current version
cp lyrics_service.py lyrics_service_no_scraper_backup.py

# Switch to ScraperAPI version
cp lyrics_service_with_scraperapi.py lyrics_service.py
```

## Step 4: Review and Commit

Check the changes:
```bash
cd /c/github/band-practice
git status
git diff webapp/services/lyrics_service.py
```

When ready:
```bash
git add webapp/services/lyrics_service.py
git add .github/workflows/deploy.yml
git commit -m "Add ScraperAPI integration to bypass Genius IP blocking"
git push
```

## Step 5: Verify Deployment

After GitHub Actions completes (~3-5 minutes):
1. Go to: https://band-practice-pro-425083870011.us-west1.run.app
2. Try refreshing lyrics for any song
3. Check logs:
   - Should see "Using ScraperAPI to fetch..." in logs
   - Lyrics should load successfully

## Verify Secret is Available

```bash
gcloud run services describe band-practice-pro \
    --region=us-west1 \
    --project=band-practice-pro \
    --format=yaml | grep -A 5 secrets
```

## Troubleshooting

### If secret not found:
```bash
# List all secrets
gcloud secrets list --project=band-practice-pro

# Verify IAM binding
gcloud secrets get-iam-policy SCRAPER_API_KEY --project=band-practice-pro
```

### If still getting 403:
1. Check ScraperAPI dashboard for usage/errors
2. Verify the API key is correct in Secret Manager
3. Check Cloud Run logs for "Using ScraperAPI..." message

## Monitor Usage

- Free tier: 1,000 requests/month
- Check dashboard: https://www.scraperapi.com/dashboard
- Each song sync = 1 request
- ~50 songs in playlist = 50 requests per full sync
