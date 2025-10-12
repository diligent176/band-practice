# ScraperAPI Setup Guide (If Browser Headers Don't Work)

## What is ScraperAPI?

ScraperAPI is a proxy service that handles IP rotation, headers, and bot detection for you.

**Free Tier**: 1,000 API calls per month (should be enough for your playlist)

## Setup Steps

### 1. Sign Up for ScraperAPI

1. Go to https://www.scraperapi.com/
2. Sign up for a free account
3. Get your API key from the dashboard

### 2. Add API Key to Google Cloud Secret Manager

```bash
# From your local machine
echo -n "YOUR_SCRAPER_API_KEY_HERE" | gcloud secrets create SCRAPER_API_KEY \
    --data-file=- \
    --project=band-practice-pro

# Or update if already exists
echo -n "YOUR_SCRAPER_API_KEY_HERE" | gcloud secrets versions add SCRAPER_API_KEY \
    --data-file=- \
    --project=band-practice-pro
```

### 3. Update Cloud Run Service

Update your Cloud Run deployment to include the new secret:

```bash
gcloud run services update band-practice-pro \
    --update-secrets="SCRAPER_API_KEY=SCRAPER_API_KEY:latest" \
    --region=us-west1 \
    --project=band-practice-pro
```

Note: The GitHub Actions workflow (`.github/workflows/deploy.yml`) already has SCRAPER_API_KEY configured in the secrets list.

## How It Works

ScraperAPI is already integrated into the lyrics service (`webapp/services/lyrics_service.py`). The service will:
1. Check if `SCRAPER_API_KEY` environment variable exists
2. If yes, route all Genius page requests through ScraperAPI
3. If no, fall back to direct requests with browser headers

## Cost Estimate

- Free tier: 1,000 requests/month
- Your playlist has ~50 songs
- Syncing entire playlist = ~50 requests
- You can sync ~20 times per month on free tier

## Alternative: Paid Plans

If you need more:
- **Hobby**: $49/mo - 100,000 requests
- **Startup**: $149/mo - 500,000 requests

## Other Free Alternatives

### Option 1: ScrapingBee (500 free requests/month)
- Similar to ScraperAPI
- Setup: https://www.scrapingbee.com/

### Option 2: Cloud Functions with Residential Proxies
- More complex but potentially cheaper at scale
- Use services like BrightData, Smartproxy

### Option 3: Manual Workaround
- Export lyrics manually and upload to Firestore
- Not ideal but works for small playlists

## Testing

After setup, test with:

```bash
# Check if the secret is available in Cloud Run
gcloud run services describe band-practice-pro \
    --region=us-west1 \
    --project=band-practice-pro \
    --format="value(spec.template.spec.containers[0].env)"
```

Then try syncing a song from your web app!

## Monitoring Usage

- Check your ScraperAPI dashboard for usage stats
- Set up alerts when approaching free tier limit
- Logs will show "Using ScraperAPI to fetch..." when active
