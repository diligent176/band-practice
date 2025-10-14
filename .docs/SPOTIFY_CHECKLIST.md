# ✅ Spotify OAuth Setup Checklist

## Prerequisites

- [ ] Spotify Premium account (required for Web Playback SDK)
- [ ] Spotify Developer account with app created

## Spotify Developer Dashboard Setup

### Local Development

- [ ] Go to https://developer.spotify.com/dashboard
- [ ] Click your app
- [ ] Click "Edit Settings"
- [ ] Scroll to "Redirect URIs"
- [ ] Add: `http://127.0.0.1:8080/api/spotify/callback`
- [ ] Click "Add"
- [ ] Click "Save"

### Production

- [ ] In same "Redirect URIs" section
- [ ] Add: `https://bandpractice.seagoat.dev/api/spotify/callback`
- [ ] Click "Add"
- [ ] Click "Save"

## Local Development Setup

### Environment Variables

- [ ] Copy `.env.example` to `.env` (if not already done)
- [ ] Edit `.env` and add:
  ```bash
  SPOTIFY_REDIRECT_URI=http://127.0.0.1:8080/api/spotify/callback
  ```

### Test Locally

- [ ] Run: `.\run-local.bat`
- [ ] Open browser to `http://127.0.0.1:8080`
- [ ] Login with Firebase
- [ ] See "Connect Spotify for Playback" button
- [ ] Click button → OAuth popup opens
- [ ] Authorize in Spotify
- [ ] Popup closes
- [ ] Toast shows "Connected to Spotify!"
- [ ] Check browser console for:
  ```
  ✅✅✅ Spotify player ready! Device ID: ...
  ```
- [ ] Select a song
- [ ] Press SPACE
- [ ] Music plays! 🎵

## Production Deployment

### GitHub Actions Variable

- [x] ✅ DONE - You already set `SPOTIFY_REDIRECT_URI` variable

### Deploy

- [ ] Commit all changes:
  ```bash
  git add .
  git commit -m "Add Spotify Web Playback SDK with OAuth"
  git push origin main
  ```
- [ ] Wait for GitHub Actions to complete
- [ ] Check workflow success in GitHub Actions tab

### Verify Production

- [ ] Open https://bandpractice.seagoat.dev
- [ ] Login with Firebase
- [ ] Click "Connect Spotify for Playback"
- [ ] OAuth popup opens
- [ ] Authorize in Spotify
- [ ] Popup redirects and closes
- [ ] Toast shows "Connected to Spotify!"
- [ ] Select a song
- [ ] Press SPACE
- [ ] Music plays! 🎵
- [ ] Refresh page
- [ ] Player auto-connects (no popup needed)

## Troubleshooting

### OAuth Popup Shows Error

- [ ] Check redirect URI in Spotify Dashboard matches exactly:
  - Local: `http://127.0.0.1:8080/api/spotify/callback`
  - Prod: `https://bandpractice.seagoat.dev/api/spotify/callback`
- [ ] No extra spaces or trailing slashes
- [ ] Click "Save" in Spotify Dashboard

### "Spotify Premium Required" Error

- [ ] Confirm you're logged in with Premium account
- [ ] Web Playback SDK requires Premium (no workaround)

### Player Not Initializing

- [ ] Check browser console for errors
- [ ] Verify Spotify SDK loaded: `typeof Spotify !== 'undefined'`
- [ ] Check network tab for failed API calls
- [ ] Check backend logs for token errors

### Music Won't Play

- [ ] Check if device appears in Spotify app (Settings → Devices)
- [ ] Try disconnect and reconnect Spotify in app
- [ ] Check browser console for 403/404 errors
- [ ] Verify you clicked "Authorize" in OAuth popup

## Verification Commands

### Check Cloud Run Environment

```bash
gcloud run services describe band-practice-pro \
  --region=us-west1 \
  --format="value(spec.template.spec.containers[0].env)" | grep SPOTIFY
```

Should show:

- `SPOTIFY_REDIRECT_URI=https://bandpractice.seagoat.dev/api/spotify/callback`

### Check Firestore Tokens

```bash
# View token collections in GCP Console
# Firestore → Collections → spotify_tokens
# Should have document with your email
```

### View Backend Logs

```bash
gcloud run services logs read band-practice-pro \
  --region=us-west1 \
  --limit=50 \
  --filter="textPayload:spotify"
```

## Success Criteria

### ✅ Everything Working When:

- [ ] No console errors
- [ ] "Connect Spotify" button appears for new users
- [ ] OAuth popup opens and closes properly
- [ ] Player initializes without errors
- [ ] Can select songs and press Space to play
- [ ] Music plays in browser (not new tab)
- [ ] Play/pause icon updates correctly
- [ ] All other keyboard shortcuts still work
- [ ] Refresh page → auto-reconnects
- [ ] Tokens persist in Firestore

## 🎉 When Complete

You'll have:

- ✅ Full in-browser Spotify playback
- ✅ Spacebar play/pause control
- ✅ OAuth with your Spotify account
- ✅ Automatic token refresh
- ✅ Works in local dev AND production
- ✅ No interference with other shortcuts
- ✅ Everything in one app!

---

**Ready to test!** Start with local development, then deploy to production. 🎸🔥
