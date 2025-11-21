# Band Practice Pro v3

🎸 Professional band practice app with lyrics, notes, and seamless Spotify playback

## ✅ Phase 0 Complete!

The foundation is set. The app now has:

- ✅ Clean Flask application structure
- ✅ PWA support with **fullscreen mode** for TV screens
- ✅ Service worker for offline support
- ✅ Firebase configuration (reuses v2 credentials)
- ✅ Thoughtful CSS architecture (reusable base classes)
- ✅ Dark, classy design system
- ✅ Development environment ready

## 🚀 Quick Start

### Run Locally

Use your existing VSCode launch configuration to debug `webapp_v3/app.py`.

The app will start on `http://localhost:8080` (or whatever port your launch.json specifies).

### View the App

Open your browser to: **http://localhost:8080**

You should see the "Coming Soon" page with:
- Feature showcase
- Build progress (Phase 0/8)
- System health checks
- PWA install prompt

### Install as PWA

1. Open in Chrome/Edge
2. Look for install icon in address bar
3. Click "Install Band Practice Pro"
4. App opens in fullscreen mode! 🎉

## 📂 Project Structure

```
webapp_v3/
├── app.py                      # Main Flask application
│
├── services/                   # Business logic (Phase 1+)
│
├── templates/
│   ├── base.html              # Base template with PWA
│   └── index.html             # Coming Soon page
│
├── static/
│   ├── manifest.json          # PWA manifest (fullscreen!)
│   ├── service-worker.js      # Offline support
│   │
│   ├── css/
│   │   ├── variables.css      # Design system variables
│   │   ├── base.css          # Reusable base classes
│   │   ├── components.css    # UI components
│   │   └── index.css         # Index page styles
│   │
│   ├── js/
│   │   ├── firebase-config.js # Firebase setup
│   │   ├── api.js            # API client
│   │   └── app.js            # Main app logic
│   │
│   └── images/               # Icons (add 192x192 and 512x512 PNGs)
│
└── utils/                     # Utility functions (Phase 1+)
```

## 🎨 Design System

### CSS Architecture

All styles use reusable base classes:

```css
/* Variables (variables.css) */
--bg-primary: #0a0a0a
--accent-primary: #1db954  /* Spotify green */
--text-primary: #e0e0e0

/* Base classes (base.css) */
.flex-row        /* Flexbox row */
.gap-md          /* Consistent spacing */
.text-lg         /* Typography */

/* Components (components.css) */
.btn-primary     /* Buttons */
.card            /* Cards */
.album-art-md    /* Images */
```

No snowflake CSS! Everything is reusable.

### Color Palette

- **Backgrounds**: #0a0a0a → #3a3a3a (4 layers)
- **Accent**: #1db954 (Spotify green)
- **Text**: #e0e0e0 (primary) → #707070 (muted)
- **Note colors**: 6 colors for lyric-note relationships

## 🔧 Tech Stack

- **Backend**: Flask 3.1, Python 3.11
- **Frontend**: Vanilla JavaScript (no frameworks)
- **Database**: Google Firestore (v3 collections)
- **Auth**: Firebase Authentication (Google OAuth)
- **Music**: Spotify Web Playback SDK
- **Lyrics**: Genius API
- **Deployment**: Google Cloud Run

## 📋 Next Steps

### Phase 1: Authentication Gate

- Google OAuth login
- User profile creation in `users_v3`
- Session management
- Redirect to HOME view

### Phase 2: HOME View

- Collections management UI
- Create/edit/delete collections
- Keyboard navigation
- Collection cards with artwork

### Then...

- Phase 3: Spotify playlist import
- Phase 4: Lyrics fetching
- Phase 5: Song chooser
- Phase 6: Spotify SDK integration
- Phase 7-8: Complete player

See [BPPv3_BUILD_PLAN.md](../webapp_v3_poc/BPPv3_BUILD_PLAN.md) for full roadmap.

## 🧪 Testing Phase 0

### Manual Checklist

- [ ] App loads at http://localhost:8080
- [ ] "Coming Soon" page displays correctly
- [ ] PWA install prompt appears (Chrome/Edge)
- [ ] Can install as PWA
- [ ] Fullscreen mode works after install
- [ ] System checks show Firebase status
- [ ] "Test API Connection" button works
- [ ] Service Worker registers (check DevTools)
- [ ] No console errors

### System Checks

The index page shows 4 status indicators:

1. **Firebase Connection** - Should show ✅
2. **PWA Support** - Should show ✅
3. **Service Worker** - Should show ✅
4. **Spotify SDK** - Should show ✅

## 🔑 Environment Variables

v3 reuses the same `.env` file from the project root (same as v2):

```bash
SECRET_KEY=your-secret-key
GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json
```

No need to create a new `.env` file - v3 loads from the parent directory automatically.

## 📦 Dependencies

Uses root `/requirements.txt`. Key packages for v3:

- `Flask==3.1.2` - Web framework
- `firebase-admin==7.1.0` - Firebase integration
- `spotipy==2.25.1` - Spotify API
- `lyricsgenius==3.7.5` - Lyrics fetching

## 🚢 Deployment

Terraform configuration for v3 collections: `terraform/firestore_v3.tf`

To deploy Firestore indexes:

```bash
cd terraform
terraform apply
```

This creates composite indexes for efficient queries.

## 🎯 Goals Achieved (Phase 0)

✅ **PWA with fullscreen mode** - Installable app
✅ **Clean architecture** - Organized, maintainable code
✅ **Reusable CSS** - Design system, not hacks
✅ **Firebase ready** - Connection established
✅ **Dark, classy design** - Optimized for TV screens
✅ **Development environment** - Ready to code

## 📝 Notes

- All v2 code remains untouched in `/webapp_v2/`
- v3 uses new Firestore collections (`*_v3`)
- Firebase credentials reused from v2
- PWA manifest set to `"display": "fullscreen"` for TV
- Service worker enables offline support

---

**Status**: Phase 0 Complete ✅
**Next**: Phase 1 - Authentication Gate
**Build Progress**: 1/8 phases (12.5%)

🎸 Let's rock! 🎸
