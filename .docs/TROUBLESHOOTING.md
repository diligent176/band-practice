# Troubleshooting Guide

Common issues and solutions for the Band Practice app.

## Deployment Issues

### GitHub Actions Deployment Fails

#### Error: "Permission denied" or "403 Forbidden"

**Cause**: Service account doesn't have necessary permissions.

**Solution**:
```bash
# Grant all required roles to github-actions service account
gcloud projects add-iam-policy-binding YOUR-PROJECT-ID \
  --member="serviceAccount:github-actions@YOUR-PROJECT-ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR-PROJECT-ID \
  --member="serviceAccount:github-actions@YOUR-PROJECT-ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.admin"
```

#### Error: "API not enabled"

**Cause**: Required GCP APIs not enabled.

**Solution**:
```bash
gcloud services enable run.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com
```

#### Error: "Secret not found"

**Cause**: GitHub Actions secrets not configured or misnamed.

**Solution**:
1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Verify all secrets exist (see [DEPLOYMENT.md](DEPLOYMENT.md) for list)
3. Check spelling matches exactly (case-sensitive)

---

## Authentication Issues

### "Authentication failed" or 401 Errors

#### Cannot sign in / No login UI appears

**Cause**: Firebase not configured or authorized domain missing.

**Solution**:
1. Go to Firebase Console → Authentication → Settings → Authorized domains
2. Add your Cloud Run URL (without `https://`):
   - Example: `band-practice-pro-123456.us-west1.run.app`
3. For local dev, also add: `127.0.0.1`

#### Sign in works but API calls return 401

**Cause**: User email not in `ALLOWED_USERS` list.

**Solution**:
```bash
# Check current allowed users
gcloud secrets versions access latest --secret="ALLOWED_USERS" --project=YOUR-PROJECT-ID

# Update allowed users (comma-separated, NO spaces)
echo -n "user1@gmail.com,user2@gmail.com" | \
  gcloud secrets versions add ALLOWED_USERS --data-file=- --project=YOUR-PROJECT-ID

# Restart Cloud Run to pick up new secret
gcloud run services update band-practice-pro --region=us-west1 --project=YOUR-PROJECT-ID
```

#### "Missing or invalid authorization header"

**Cause**: Firebase token not being sent with requests.

**Solution**:
1. Check browser console for errors
2. Clear browser cache and cookies
3. Sign out and sign in again
4. Verify Firebase SDK loaded (check Network tab)

---

## Spotify Issues

### OAuth Popup Shows Error

#### "INVALID_CLIENT: Invalid redirect URI"

**Cause**: Redirect URI not added to Spotify Developer Dashboard.

**Solution**:
1. Go to https://developer.spotify.com/dashboard
2. Select your app → Edit Settings
3. Add exact redirect URI:
   - Production: `https://YOUR-CLOUD-RUN-URL/api/spotify/callback`
   - Local: `http://127.0.0.1:8080/api/spotify/callback`
4. No trailing slash, exact match
5. Click Save

#### "Spotify Premium required" error

**Cause**: Web Playback SDK requires Spotify Premium account.

**Solution**: Upgrade to Spotify Premium or use the app without in-browser playback (playlist import still works).

### Playlist Import Fails

#### "Failed to sync playlist"

**Cause**: Invalid Spotify credentials or playlist URL.

**Solution**:
1. Verify `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in GitHub Secrets
2. Check playlist URL format: `https://open.spotify.com/playlist/PLAYLIST_ID`
3. Ensure playlist is public (or owned by you if private)
4. Check Cloud Run logs:
   ```bash
   gcloud run services logs read band-practice-pro --region=us-west1 --limit=50
   ```

---

## Lyrics Issues

### "Could not retrieve lyrics" for all songs

#### Genius API not configured

**Cause**: `GENIUS_ACCESS_TOKEN` missing or invalid.

**Solution**:
1. Verify secret exists in GitHub Actions
2. Test token:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://api.genius.com/search?q=test"
   ```
3. If invalid, generate new token at https://genius.com/api-clients

#### 403 Forbidden errors from Genius

**Cause**: Cloud Run IP blocked by Genius.

**Solution**: Set up ScraperAPI (see [API_SETUP.md](API_SETUP.md)):
1. Sign up at https://www.scraperapi.com/signup
2. Add `SCRAPER_API_KEY` to GitHub Secrets
3. Redeploy (push to main)

### Lyrics are incorrect or empty

**Cause**: Genius search matched wrong song.

**Solution**:
1. Click "Refresh Lyrics" button for that song
2. If still wrong, manually edit lyrics (click Edit Lyrics button)
3. Edited lyrics are saved with `is_customized: true` flag

---

## Firestore Issues

### "Permission denied" errors

**Cause**: Cloud Run service account doesn't have Firestore permissions.

**Solution**:
```bash
# Grant Firestore access to Cloud Run service account
gcloud projects add-iam-policy-binding YOUR-PROJECT-ID \
  --member="serviceAccount:YOUR-PROJECT-NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"
```

Find your project number:
```bash
gcloud projects describe YOUR-PROJECT-ID --format="value(projectNumber)"
```

### Queries fail with "index not found"

**Cause**: Missing Firestore composite index.

**Solution**:
```bash
cd terraform
terraform apply
```

This creates all required indexes. Wait ~5 minutes for indexes to build.

Verify in GCP Console → Firestore → Indexes.

---

## BPM Issues

### All songs show BPM as "N/A"

**Cause**: GetSongBPM API not configured (optional).

**Solution**: This is normal if you haven't set up the API. To enable:
1. Get API key from https://getsongbpm.com/api
2. Add `GETSONGBPM_API_KEY` to GitHub Secrets
3. Redeploy
4. Refresh songs to fetch BPM

### Some songs have BPM, others don't

This is normal - GetSongBPM doesn't have data for all songs (especially obscure or very new tracks).

---

## Local Development Issues

### "ModuleNotFoundError" when running locally

**Cause**: Dependencies not installed.

**Solution**:
```bash
pip install -r requirements.txt
```

### Environment variables not loading

**Cause**: `.env` file missing or incorrectly formatted.

**Solution**:
1. Copy template: `cp .env.example .env`
2. Fill in all values (no quotes around values)
3. Ensure no spaces around `=` sign
4. Run: `.\run-local.bat`

### "Could not connect to Firestore"

**Cause**: Local credentials not configured.

**Solution**:
```bash
# Download application default credentials
gcloud auth application-default login

# Set project
gcloud config set project YOUR-PROJECT-ID
```

---

## Performance Issues

### Playlist import is slow (30+ seconds)

This is normal! Lyrics are fetched lazily:
- Import saves song metadata (~5 seconds)
- Lyrics fetch when you first open each song (~5 seconds per song)
- Total time spreads across usage instead of upfront

### App is slow to load

**Cause**: Cold start (Cloud Run scales to zero when idle).

**Solution**:
- First request after idle period takes ~3-5 seconds (normal)
- Subsequent requests are fast
- Consider Cloud Run min instances (costs money) if you need instant response

---

## Viewing Logs

### Cloud Run logs

```bash
# Real-time
gcloud run services logs tail band-practice-pro --region=us-west1

# Recent logs
gcloud run services logs read band-practice-pro --region=us-west1 --limit=50

# Filter by error
gcloud run services logs read band-practice-pro --region=us-west1 --limit=50 | grep -i error

# Filter by user
gcloud run services logs read band-practice-pro --region=us-west1 --limit=50 | grep "user@example.com"
```

### Browser console

Open Developer Tools (F12) → Console tab to see:
- JavaScript errors
- API call failures
- Firebase authentication status
- Spotify SDK status

---

## Still Having Issues?

### Useful Commands

```bash
# Check Cloud Run status
gcloud run services describe band-practice-pro --region=us-west1

# Check environment variables
gcloud run services describe band-practice-pro --region=us-west1 \
  --format="value(spec.template.spec.containers[0].env)"

# Check secrets
gcloud secrets list --project=YOUR-PROJECT-ID

# Check Firestore collections
gcloud firestore databases list --project=YOUR-PROJECT-ID

# Test connectivity
curl https://YOUR-CLOUD-RUN-URL/health
```

### Check GCP Console

- **Cloud Run**: https://console.cloud.google.com/run
- **Firestore**: https://console.cloud.google.com/firestore
- **Secret Manager**: https://console.cloud.google.com/security/secret-manager
- **Logs Explorer**: https://console.cloud.google.com/logs

### GitHub Actions

- Check workflow runs: GitHub repo → Actions tab
- View deployment logs
- Re-run failed workflows

---

## Emergency Reset

If everything is broken and you want to start fresh:

```bash
# Delete Cloud Run service
gcloud run services delete band-practice-pro --region=us-west1

# Delete secrets
gcloud secrets delete SPOTIFY_CLIENT_ID
gcloud secrets delete SPOTIFY_CLIENT_SECRET
# ... etc for all secrets

# Re-run Terraform
cd terraform
terraform destroy
terraform apply

# Redeploy
git push origin main
```

**Warning**: This deletes all data in Firestore!
