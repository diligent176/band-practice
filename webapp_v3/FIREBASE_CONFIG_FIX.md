# 🔥 Firebase Config Fix Applied

## Problem
The Firebase API key error occurred because v3 had **hardcoded placeholder values** in `firebase-config.js`, while v2 loads the config from **environment variables via Flask templates**.

Error you saw:
```
Internal error: {"error":{"code":400,"message":"API key not valid. Please pass a valid API key."}}
```

## Solution
Changed v3 to use the **same pattern as v2**: inject Firebase config from Flask using Jinja templates.

## Files Changed

### 1. ✅ [app.py](app.py) - Added Firebase Config Loading
```python
# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['FIREBASE_API_KEY'] = os.getenv('FIREBASE_API_KEY')
app.config['FIREBASE_AUTH_DOMAIN'] = os.getenv('FIREBASE_AUTH_DOMAIN')
app.config['FIREBASE_PROJECT_ID'] = os.getenv('FIREBASE_PROJECT_ID', os.getenv('GCP_PROJECT_ID'))
```

These values are loaded from your `.env` file and made available to templates.

### 2. ✅ [templates/base.html](templates/base.html) - Inject Config Into Page
```html
<!-- Firebase Config (injected from Flask) -->
<script>
    window.FIREBASE_CONFIG = {
        apiKey: "{{ config.FIREBASE_API_KEY }}",
        authDomain: "{{ config.FIREBASE_AUTH_DOMAIN }}",
        projectId: "{{ config.FIREBASE_PROJECT_ID }}"
    };
</script>
```

This script tag runs **before** `firebase-config.js` loads, setting `window.FIREBASE_CONFIG` with your real values.

### 3. ✅ [static/js/firebase-config.js](static/js/firebase-config.js) - Use Injected Config
```javascript
// Firebase configuration will be set by the template
// See base.html for where window.FIREBASE_CONFIG is defined
const firebaseConfig = window.FIREBASE_CONFIG || {
  // Fallback values (should never be used if template is working)
  apiKey: "MISSING_API_KEY",
  authDomain: "MISSING_AUTH_DOMAIN",
  projectId: "MISSING_PROJECT_ID"
};
```

Changed from hardcoded placeholder values to reading from `window.FIREBASE_CONFIG`.

## Environment Variables Required

Make sure your `.env` file (in project root) has these values:

```bash
# Flask
SECRET_KEY=your-secret-key

# Firebase (client-side config)
FIREBASE_API_KEY=AIzaSy...  # Your real Firebase Web API key
FIREBASE_AUTH_DOMAIN=band-practice-pro.firebaseapp.com
FIREBASE_PROJECT_ID=band-practice-pro

# Firebase Admin (server-side)
GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json

# Optional: GCP_PROJECT_ID (fallback for FIREBASE_PROJECT_ID)
GCP_PROJECT_ID=band-practice-pro
```

## How to Get Your Firebase Config

If you don't have these values in your `.env` yet:

1. **Copy from v2's .env** - v3 reuses the same Firebase project
2. **Or check GitHub secrets** - I can see you have `FIREBASE_API_KEY` there
3. **Or get from Firebase Console**:
   - Go to Firebase Console → Project Settings
   - Scroll to "Your apps" section
   - Click on your web app
   - Copy the config values

## Testing the Fix

**Restart your Flask app** and test:

1. Open `http://localhost:8080`
2. Open browser DevTools → Console
3. Check for `✅ Firebase initialized successfully`
4. Click "Go to Login →"
5. Should see Google sign-in button (no API key error)
6. Sign in with Google
7. Should redirect to `/home` with your profile

## What Changed from v2

**Nothing!** v3 now uses the **exact same pattern** as v2:
- ✅ Loads config from environment variables
- ✅ Injects config via Flask templates
- ✅ No hardcoded credentials
- ✅ Works in both local dev and production

---

**Status:** Firebase Config Fix Applied ✅
**Ready for:** Phase 1 Testing 🧪
