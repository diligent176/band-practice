# Authentication Setup for Band Practice App

This document explains the Firebase Authentication configuration for the Band Practice web application.

## Overview

The application uses **Firebase Authentication** to control access. Key features:

- Users must have a Google account and be on the allowed users list
- Firebase handles authentication on the frontend
- Backend verifies Firebase ID tokens on each API request
- Access is restricted via the `ALLOWED_USERS` environment variable
- User access is logged for security auditing

## Authentication Components

### 1. Firebase Authentication (Frontend)

The web interface (`webapp/templates/viewer.html`) includes:

- **Firebase SDK**: Loaded from CDN for authentication
- **FirebaseUI**: Provides Google sign-in interface
- **ID Token Management**: Automatically includes Firebase ID token in all API requests
- **Session Persistence**: User stays logged in across browser sessions

Configuration from environment:

- `FIREBASE_API_KEY` - Your Firebase project API key
- `FIREBASE_AUTH_DOMAIN` - Your Firebase auth domain (e.g., `your-project.firebaseapp.com`)
- `FIREBASE_PROJECT_ID` - Your Firebase/GCP project ID

### 2. Backend Authentication Service

The Flask application (`webapp/services/auth_service.py`) handles:

- **Firebase Admin SDK**: Verifies Firebase ID tokens from requests
- **Token Verification**: Validates tokens using `firebase_admin.auth.verify_id_token()`
- **User Whitelist**: Checks authenticated user against `ALLOWED_USERS` list
- **Route Protection**: `@require_auth` decorator protects all API endpoints
- **User Context**: User information available in Flask's `g.user` object
- **Development Mode**: Authentication bypassed when `FLASK_ENV=development`

### 3. Protected Endpoints

All API routes in `webapp/app.py` are protected:

```python
@app.route('/api/songs', methods=['GET'])
@require_auth
def get_songs():
    # User available in g.user
    logger.info(f"User {g.user.get('email')} requested all songs")
    ...
```

Protected endpoints:

- `/api/songs` - Get all songs
- `/api/songs/<song_id>` - Get specific song
- `/api/songs/<song_id>/notes` - Update notes
- `/api/playlist/sync` - Sync playlist
- `/api/songs/<song_id>/refresh` - Refresh lyrics
- `/api/user` - Get user info

Public endpoints (no auth required):

- `/` - Home page (serves login interface)
- `/health` - Health check
- `/health2` - Health check

## Configuration Requirements

### 1. Firebase Project Setup

See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for detailed Firebase project setup.

Quick summary:

1. Create Firebase project (or use existing GCP project)
2. Enable Google authentication provider
3. Add authorized domain (your Cloud Run URL)
4. Get configuration values

### 2. Environment Variables (Cloud Run)

These are configured as **Secret Manager secrets** in Terraform (`terraform/main.tf`):

```bash
# Firebase Configuration
FIREBASE_API_KEY=AIzaSy...                    # From Firebase Console
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id

# User Access Control (comma-separated emails)
ALLOWED_USERS=user1@gmail.com,user2@gmail.com,user3@gmail.com

# Other required vars
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
GENIUS_ACCESS_TOKEN=...
SECRET_KEY=...
```

### 3. Terraform Configuration

The authentication secrets are defined in `terraform/main.tf`:

```hcl
# Firebase Authentication Secrets
resource "google_secret_manager_secret" "firebase_api_key" { ... }
resource "google_secret_manager_secret" "firebase_auth_domain" { ... }
resource "google_secret_manager_secret" "allowed_users" { ... }
```

These are mounted as environment variables in Cloud Run:

```hcl
env {
  name = "FIREBASE_API_KEY"
  value_source {
    secret_key_ref {
      secret  = google_secret_manager_secret.firebase_api_key.secret_id
      version = "latest"
    }
  }
}
```

### 4. GitHub Actions Secrets

Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `ALLOWED_USERS`

The deployment workflow (`.github/workflows/deploy.yml`) uses these to update Secret Manager.

## User Access Management

### Adding/Removing Users

Users are controlled via the `ALLOWED_USERS` secret in Secret Manager.

#### Option 1: Update via gcloud (Recommended)

```bash
# View current allowed users
gcloud secrets versions access latest --secret="ALLOWED_USERS" --project=your-project-id

# Update allowed users (comma-separated, no spaces)
echo -n "user1@gmail.com,user2@gmail.com,user3@gmail.com" | \
  gcloud secrets versions add ALLOWED_USERS --data-file=- --project=your-project-id

# Restart Cloud Run to pick up new secret version
gcloud run services update band-practice-pro \
  --region=us-west1 \
  --project=your-project-id
```

#### Option 2: Update via GitHub Actions

1. Update `ALLOWED_USERS` secret in GitHub repository settings
2. Re-run the deployment workflow
3. New users will be able to access on next deployment

#### Option 3: Update via Terraform

1. Update `terraform.tfvars` with new `allowed_user_emails` list
2. Run `terraform apply`
3. The secret will be updated automatically

### How the Whitelist Works

1. User signs in with Google via Firebase
2. Frontend sends Firebase ID token with each API request
3. Backend verifies token and extracts email address
4. Email is checked against `ALLOWED_USERS` list
5. If not in list, request is denied with 401 error

From `auth_service.py`:

```python
def verify_token(self, id_token):
    decoded_token = auth.verify_id_token(id_token)
    email = decoded_token.get('email')

    # Check if user is in allowed list
    if email not in self.allowed_users:
        logger.warning(f"Unauthorized user: {email}")
        return None

    return {
        'email': email,
        'uid': decoded_token.get('uid'),
        ...
    }
```

## Development and Testing

### Local Development

For local development, bypass authentication by setting:

```bash
# In your .env file
FLASK_ENV=development

# Or
DEVELOPMENT=true
```

This uses a mock user:

```python
{
    'email': 'dev@localhost.com',
    'verified': True
}
```

### Local Development with Real Firebase

To test with real Firebase authentication locally:

1. Remove `FLASK_ENV=development` from `.env`
2. Add Firebase credentials to `.env`:
   ```bash
   FIREBASE_API_KEY=AIzaSy...
   FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   FIREBASE_PROJECT_ID=your-project-id
   ALLOWED_USERS=your-email@gmail.com
   ```
3. Add `127.0.0.1:8080` to Firebase authorized domains
4. Run `run-local.bat`
5. Navigate to `http://127.0.0.1:8080` and sign in

### Testing Authentication Flow

1. **Access the Application**: Navigate to your Cloud Run URL
2. **Sign-In Interface**: Firebase UI displays Google sign-in button
3. **Google Sign-In**: Click "Sign in with Google"
4. **User Check**: Backend verifies you're in `ALLOWED_USERS`
5. **Access Granted**: If authorized, app loads; if not, shows error
6. **User Display**: Your email appears in top-right corner

## Security Notes

- **Token Verification**: Every API request verifies the Firebase ID token
- **User Logging**: All API actions are logged with user email
- **Secret Management**: Credentials stored in Secret Manager, not code
- **HTTPS Required**: Firebase Auth requires HTTPS (automatic with Cloud Run)
- **Token Expiration**: Firebase tokens expire after 1 hour, automatically refreshed
- **No Session Storage**: Tokens are stateless, verified on each request

## Cloud Run IAM

**Important**: The Cloud Run service has `allUsers` invoker access:

```hcl
resource "google_cloud_run_service_iam_member" "public_access" {
  service  = google_cloud_run_service.band_practice.name
  location = google_cloud_run_service.band_practice.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
```

This allows public access to the Cloud Run URL, but **the application itself enforces authentication** via Firebase. The home page (`/`) is public to serve the login interface, but all API endpoints require authentication.

This approach is simpler than Cloud Run IAM authentication and provides better UX.

## Troubleshooting

### Common Issues

#### 1. "Authentication failed" errors

**Symptoms**: User can sign in but API requests fail with 401

**Causes & Solutions**:

- User email not in `ALLOWED_USERS` list → Add user to allowed list
- Secret Manager secret not updated → Check secret version and update Cloud Run
- Token not being sent → Check browser console for errors

```bash
# Check current allowed users
gcloud secrets versions access latest --secret="ALLOWED_USERS" --project=your-project-id

# Check Cloud Run has latest secret version
gcloud run services describe band-practice-pro \
  --region=us-west1 \
  --project=your-project-id \
  --format=yaml | grep -A 5 secrets
```

#### 2. "Missing or invalid authorization header" errors

**Symptoms**: Requests failing before user check

**Causes & Solutions**:

- Frontend not sending Firebase token → Check `viewer.html` authentication code
- Token expired → Refresh the page
- Browser cache issue → Clear cache and try again

#### 3. Firebase initialization errors

**Symptoms**: Error on page load, can't sign in

**Causes & Solutions**:

- Missing Firebase config in Cloud Run → Check environment variables
- Wrong Firebase project ID → Verify `FIREBASE_PROJECT_ID`
- Unauthorized domain → Add Cloud Run URL to Firebase authorized domains

```bash
# Check Cloud Run environment variables
gcloud run services describe band-practice-pro \
  --region=us-west1 \
  --project=your-project-id \
  --format="get(spec.template.spec.containers[0].env)"
```

#### 4. Development mode not working

**Symptoms**: Still requiring auth in local development

**Causes & Solutions**:

- `FLASK_ENV` not set to `development` → Check `.env` file
- Wrong variable name → Use `FLASK_ENV=development` or `DEVELOPMENT=true`

### Useful Commands

```bash
# View application logs (shows authentication attempts)
gcloud logs read "resource.type=cloud_run_revision" \
  --project=your-project-id \
  --limit=50

# View only auth-related logs
gcloud logs read "resource.type=cloud_run_revision AND textPayload=~'auth|token|user'" \
  --project=your-project-id \
  --limit=30

# List all Secret Manager secrets
gcloud secrets list --project=your-project-id

# View specific secret value
gcloud secrets versions access latest --secret="ALLOWED_USERS" --project=your-project-id

# Update Cloud Run to use latest secret versions
gcloud run services update band-practice-pro \
  --region=us-west1 \
  --project=your-project-id

# Check Firebase project configuration
gcloud firebase projects list
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  viewer.html (Firebase SDK)                          │  │
│  │  - Google Sign-In UI                                 │  │
│  │  - Stores Firebase ID Token                          │  │
│  │  - Sends token with each API request                 │  │
│  └───────────────────┬──────────────────────────────────┘  │
└────────────────────────┼──────────────────────────────────────┘
                         │ HTTPS + Authorization: Bearer <token>
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Google Cloud Run (Flask App)                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  @require_auth Decorator                             │  │
│  │  1. Extract token from header                        │  │
│  │  2. Verify with Firebase Admin SDK                   │  │
│  │  3. Check email in ALLOWED_USERS                     │  │
│  │  4. Allow or deny request                            │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │                                       │
│  ┌──────────────────▼──────────────────────────────────┐  │
│  │  Protected API Endpoints                             │  │
│  │  /api/songs, /api/playlist/sync, etc.               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ Read secrets
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Secret Manager                                  │
│  - FIREBASE_API_KEY                                         │
│  - FIREBASE_AUTH_DOMAIN                                     │
│  - FIREBASE_PROJECT_ID                                      │
│  - ALLOWED_USERS (comma-separated emails)                   │
└─────────────────────────────────────────────────────────────┘
```

## Comparison: Firebase Auth vs Google IAP

This app uses **Firebase Authentication**, not Google IAP (Identity-Aware Proxy).

| Feature              | Firebase Auth (Current)     | Google IAP             |
| -------------------- | --------------------------- | ---------------------- |
| **Setup Complexity** | Simple                      | Complex                |
| **User Management**  | Application-level whitelist | GCP IAM roles          |
| **Sign-In UI**       | FirebaseUI (customizable)   | Google-hosted page     |
| **Cost**             | Free (Firebase Auth)        | Free (Cloud Run IAP)   |
| **Token Type**       | Firebase ID tokens          | IAP JWT tokens         |
| **Development Mode** | Easy bypass                 | Harder to test locally |
| **User Experience**  | Embedded in app             | Redirects to Google    |

Firebase Auth was chosen for its simplicity and better developer experience.

## Further Reading

- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [Firebase Admin SDK for Python](https://firebase.google.com/docs/admin/setup)
- [FirebaseUI Web](https://github.com/firebase/firebaseui-web)
- [FIREBASE_SETUP.md](FIREBASE_SETUP.md) - Detailed Firebase project setup
