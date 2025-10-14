# 🎸 QUICK START - Spotify In-App Playback

## ⚡ Two Steps to Get Music Playing

### 1️⃣ Update Spotify Developer Dashboard (ONE TIME SETUP)

Go to: https://developer.spotify.com/dashboard

1. Click your app
2. Click "Edit Settings"
3. Add to "Redirect URIs":
   ```
   http://127.0.0.1:8080/api/spotify/callback
   ```
4. Click "Add" → "Save"

### 2️⃣ Add Environment Variables

Edit your `.env` file (not `.env.example`), add these lines:

```bash
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8080/api/spotify/callback
```

### 3️⃣ Run & Test!

```powershell
.\run-local.bat
```

## 🎯 What You'll See

1. **Load app** → See "Connect Spotify for Playback" button
2. **Click button** → OAuth popup opens
3. **Login/Authorize** → Popup closes
4. **Toast appears** → "Connected to Spotify!"
5. **Select a song** → Mini player appears
6. **Press SPACE** → 🎵 Music plays IN YOUR APP!

## ✅ Verification

Open browser console, you should see:

```
🎵 Spotify SDK loaded
✅ User has Spotify connected, initializing player...
✅ Got Spotify access token
✅✅✅ Spotify player ready! Device ID: ...
```

## 🎹 Spacebar Control

- **Press Space** → Play/Pause
- **Works when:** Not typing in input fields, no dialogs open
- **All other shortcuts:** Still work perfectly (X, P, S, E, N, etc.)

## ⚠️ Requirements

- **Spotify Premium** required (SDK limitation)
- **Modern browser** (Chrome, Edge, Firefox, Safari)

## 🐛 Issues?

### OAuth popup blocked

→ Allow popups for 127.0.0.1:8080

### "Spotify Premium required"

→ SDK requires Premium subscription

### Button doesn't appear

→ Check browser console for errors

### Music doesn't play

→ Verify you authorized in the popup

## 📚 Full Documentation

See `.docs/SPOTIFY_SETUP_COMPLETE.md` for complete details.

---

**That's it!** Your Band Practice Pro now has full Spotify integration. Space bar plays music right in the app! 🎸🔥
