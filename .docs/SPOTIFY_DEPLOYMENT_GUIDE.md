# 🚀 Spotify OAuth Deployment Guide

## ✅ Changes Made for Production Deployment

### 1. Terraform Updates

#### New Variables Added (`terraform/variables.tf`):

```terraform
variable "spotify_redirect_uri" {
  description = "Spotify OAuth redirect URI for local development"
  type        = string
  default     = "http://127.0.0.1:8080/api/spotify/callback"
}
```

#### Cloud Run Environment Variables Added (`terraform/cloud_run.tf`):

- `FLASK_ENV=production`
- `SPOTIFY_REDIRECT_URI` (for local dev testing)

### 2. GitHub Actions Workflow Updated

Added to deployment step:

- `FLASK_ENV=production`
- `SPOTIFY_REDIRECT_URI=http://127.0.0.1:8080/api/spotify/callback`

### 3. New Firestore Collections

The OAuth implementation creates these new collections:

- `spotify_tokens` - Stores user OAuth tokens (per user)
- `oauth_states` - Temporary state tokens for CSRF protection

**Note:** Firestore will auto-create these collections when first used. No manual setup needed!

## 🎯 Deployment Steps

### Step 1: Set GitHub Actions Variable

You've already done this! ✅

In GitHub Settings → Actions → Variables:

- **Name:** `SPOTIFY_REDIRECT_URI`
- **Value:** `https://bandpractice.seagoat.dev/api/spotify/callback`

### Step 2: Update Spotify Developer Dashboard

1. Go to https://developer.spotify.com/dashboard
2. Select your app
3. Click **"Edit Settings"**
4. Add **BOTH** redirect URIs:
   ```
   http://127.0.0.1:8080/api/spotify/callback
   https://bandpractice.seagoat.dev/api/spotify/callback
   ```
5. Click **"Add"** → **"Save"**

### Step 3: Deploy!

Just push to main branch:

```bash
git add .
git commit -m "Add Spotify Web Playback SDK with OAuth"
git push origin main
```

GitHub Actions will:

1. ✅ Build Docker image
2. ✅ Push to Artifact Registry
3. ✅ Deploy to Cloud Run with new environment variables
4. ✅ Output deployment URL

### Step 4: Verify Deployment

After deployment completes:

1. **Check Cloud Run Environment Variables:**

   ```bash
   gcloud run services describe band-practice-pro \
     --region=us-west1 \
     --format="value(spec.template.spec.containers[0].env)"
   ```

   Should show:

   - `FLASK_ENV=production`
   - `SPOTIFY_REDIRECT_URI=http://127.0.0.1:8080/api/spotify/callback`

2. **Test the OAuth Flow:**
   - Open https://bandpractice.seagoat.dev
   - Login with Firebase
   - Click "Connect Spotify for Playback"
   - Authorize in popup
   - Should see "Connected to Spotify!" toast
   - Select a song and press Space → Music plays!

## 🔍 Verification Checklist

- [ ] GitHub Actions variable `SPOTIFY_REDIRECT_URI` is set
- [ ] Both redirect URIs added to Spotify Developer Dashboard
- [ ] Code pushed to main branch
- [ ] GitHub Actions workflow completes successfully
- [ ] Cloud Run service updated (check revision in GCP Console)
- [ ] Can open production app
- [ ] "Connect Spotify" button appears
- [ ] OAuth popup opens when clicked
- [ ] Authorization redirects back and closes popup
- [ ] "Connected to Spotify!" toast appears
- [ ] Player initializes (check browser console)
- [ ] Can select song and press Space to play

## 🐛 Troubleshooting

### OAuth Redirect Error

**Symptoms:** "INVALID_CLIENT: Invalid redirect URI" in popup

**Fix:**

1. Double-check redirect URI in Spotify Dashboard matches exactly:
   ```
   https://bandpractice.seagoat.dev/api/spotify/callback
   ```
2. No trailing slash
3. Must be https:// for production

### Environment Variable Not Set

**Symptoms:** Backend logs show "redirect_uri: None" or defaults to wrong URL

**Check:**

```bash
# View Cloud Run env vars
gcloud run services describe band-practice-pro \
  --region=us-west1 \
  --format="json" | grep -A 5 "SPOTIFY_REDIRECT"
```

### Firestore Permission Errors

**Symptoms:** "Permission denied" when saving tokens

**Check:** Service account has Firestore permissions:

```bash
gcloud projects get-iam-policy band-practice-pro \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/datastore.user"
```

**Fix:** Already configured in `terraform/iam.tf` - should work automatically

### Token Not Persisting

**Symptoms:** Must reconnect Spotify every time

**Check Firestore:**

1. Go to GCP Console → Firestore
2. Look for `spotify_tokens` collection
3. Should have document with your email as ID
4. Document should contain `access_token`, `refresh_token`, `expires_at`

**Fix:** Check backend logs for errors during token save

## 📊 Monitoring

### View Backend Logs

```bash
# Real-time logs
gcloud run services logs read band-practice-pro \
  --region=us-west1 \
  --limit=50 \
  --format="value(textPayload)" \
  --filter="textPayload:spotify OR textPayload:OAuth"

# Or in GCP Console
# Cloud Run → band-practice-pro → Logs tab
```

### Key Log Messages to Look For

**Successful OAuth flow:**

```
User user@example.com requesting Spotify auth URL
Generated auth URL for user user@example.com
Spotify callback received - code: True, state: True
Successfully authenticated Spotify for user user@example.com
User user@example.com requesting Spotify token
```

**Errors:**

```
Error generating Spotify auth URL: ...
Invalid or expired state token: ...
Error exchanging code for token: ...
Failed to refresh token for user ...: ...
```

## 🎉 Success Indicators

When everything works:

1. **Backend logs show:**

   ```
   SpotifyAuthService initialized with redirect_uri: https://bandpractice.seagoat.dev/api/spotify/callback
   ```

2. **Frontend console shows:**

   ```
   🎵 Spotify SDK loaded
   ✅ User has Spotify connected, initializing player...
   ✅ Got Spotify access token (first 30 chars): BQD...
   ✅✅✅ Spotify player ready! Device ID: abc123...
   ```

3. **User experience:**
   - Click "Connect Spotify" → Popup opens
   - Authorize → Popup closes automatically
   - Toast: "Connected to Spotify!"
   - Select song → Mini player appears
   - Press Space → Music plays in browser!
   - Refresh page → Auto-reconnects (no popup needed)

## 🔐 Security Notes

- **Tokens stored per-user:** Each user's Spotify token is isolated in Firestore
- **State tokens:** CSRF protection on OAuth flow (auto-expire after 10 minutes)
- **Token refresh:** Automatic token refresh 5 minutes before expiry
- **No secrets in frontend:** All OAuth happens server-side
- **HTTPS required:** Production OAuth requires HTTPS (enforced by Spotify)

## 📝 Post-Deployment Tasks

1. **Test with your Spotify Premium account**
2. **Monitor logs for any OAuth errors**
3. **Check Firestore for token storage**
4. **Verify token refresh works** (wait 1 hour, should auto-refresh)
5. **Test with multiple users** (if you have test accounts)

## 🚀 Optional: Custom Domain

If you're using a custom domain (already configured):

1. Update GitHub Actions variable:

   ```
   SPOTIFY_REDIRECT_URI = https://your-custom-domain.com/api/spotify/callback
   ```

2. Add to Spotify Dashboard:

   ```
   https://your-custom-domain.com/api/spotify/callback
   ```

3. Redeploy

---

**Ready to deploy!** Just push your changes and watch the GitHub Actions workflow. 🎸🔥
