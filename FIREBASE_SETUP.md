# Firebase Authentication Setup

Free Google OAuth login without Load Balancer costs!

## Setup Steps

### 1. Enable Firebase in your GCP project

```bash
# Go to Firebase Console
open https://console.firebase.google.com

# Add your existing GCP project to Firebase (it's free)
# Click "Add project" and select your existing project
```

### 2. Enable Google Sign-In

1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable **Google** provider
3. Set support email

### 3. Get your Firebase Config

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **Your apps** section
3. Click **Web app** icon (`</>`)
4. Register app with name "Band Practice Pro"
5. Copy the config values:
   - API Key
   - Auth Domain
   - Project ID

### 4. Add Firebase config to terraform.tfvars

```hcl
firebase_api_key = "AIzaSy..."  # Your Firebase API Key from step 3
allowed_user_emails = ["YOUREMAIL@gmail.com"]  # Who can access

# Note: Auth domain and Project ID are auto-configured from your GCP project
```

### 5. Add authorized domains

1. In Firebase Console, go to **Authentication** > **Settings** > **Authorized domains**
2. Add your Cloud Run URL domain (e.g., `band-practice-pro-425083870011.us-west1.run.app`)
   - Get this from: `terraform output cloud_run_url` (remove the `https://` prefix)
3. Also add `localhost` for local testing if needed

### 6. Deploy

```bash
cd terraform
terraform apply

# Build and deploy your app
cd ..
# ... your deployment commands
```

## How it works

- **Frontend**: Firebase Auth UI provides Google login button
- **Backend**: Verifies Firebase ID tokens server-side
- **Authorization**: Only emails in `allowed_user_emails` can access
- **Cost**: $0 (Firebase Auth is free for reasonable usage)

## Testing

1. Visit your Cloud Run URL
2. See Google login page
3. Sign in with `USER@gmail.com`
4. If authorized, you'll see the app
5. If not authorized, you'll see an error message

## Security

- Firebase handles OAuth flow
- Backend verifies tokens on every API call
- Only whitelisted emails can access
- Works over HTTPS (Cloud Run provides SSL)
- No infrastructure costs!
