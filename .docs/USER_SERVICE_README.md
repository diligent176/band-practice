# User Service Documentation

## Overview

The User Service manages user profiles in Firestore, automatically creating and updating user records when users authenticate via Google OAuth.

## User Data Model

Each user document in the `users` collection contains:

```javascript
{
  uid: string,              // Firebase Auth UID (document ID)
  email: string,            // User's email address
  display_name: string,     // Full name from Google OAuth
  photo_url: string,        // Profile picture URL
  email_verified: boolean,  // Email verification status
  locale: string,           // User's locale (optional)
  created_at: timestamp,    // When user first logged in
  last_login_at: timestamp, // Most recent login
  updated_at: timestamp     // Last profile update
}
```

## Automatic User Creation

Users are automatically created/updated in Firestore on every login through the authentication flow:

1. User authenticates with Google OAuth
2. Firebase Auth token is verified in `auth_service.py`
3. User data is extracted from the ID token
4. `user_service.create_or_update_user()` is called
5. User document is created (first login) or updated (subsequent logins)

## Usage Examples

### Get User Display Info

Use this for showing user info in UI, audit logs, etc:

```python
from services.user_service import user_service

# Get basic display info for a user
user_info = user_service.get_user_display_info(uid)
# Returns: {'uid': '...', 'display_name': 'John Doe', 'email': 'john@example.com', 'photo_url': '...'}
```

### Get Full User Profile

```python
user = user_service.get_user(uid)
# Returns full user document including timestamps
```

### Search Users by Email

Useful for adding collaborators:

```python
users = user_service.search_users_by_email('john@', limit=10)
# Returns list of users matching email prefix
```

### Get User by Email

```python
user = user_service.get_user_by_email('john@example.com')
```

## Future Use Cases

### Audit Logs

When implementing audit logs for lyric changes, you can now store just the UID and retrieve display info on demand:

```javascript
// Audit log document
{
  song_id: 'abc123',
  action: 'lyrics_updated',
  user_id: 'firebase_uid_here',  // Just store the UID
  timestamp: '2025-01-21T10:30:00Z',
  changes: {...}
}

// Retrieve user info for display
const audit_logs = get_audit_logs();
for (const log of audit_logs) {
  const user_info = user_service.get_user_display_info(log.user_id);
  // Display: "John Doe updated lyrics on Jan 21, 2025"
}
```

### Collection Attribution

Track who created collections:

```python
# In firestore_service.create_collection()
collection_data = {
    'user_id': user_email,  # Owner's email
    'created_by_uid': g.user['uid'],  # Creator's UID for display
    'name': name,
    ...
}

# Later, display creator info
creator = user_service.get_user_display_info(collection['created_by_uid'])
print(f"Created by {creator['display_name']}")
```

### Activity Tracking

The `last_login_at` field is automatically updated on every login, allowing you to:
- Show "last seen" timestamps
- Identify inactive users
- Track engagement metrics

## Firestore Configuration

### Collection Name
- Collection: `users`
- Document ID: Firebase Auth UID

### Indexes
The following index is defined in `terraform/firestore.tf`:
- `users_email_range`: Single-field ascending index on `email` for range queries

### IAM Permissions
The Cloud Run service account has `roles/datastore.user`, which includes:
- Read/write access to all Firestore collections
- No additional permissions needed for the users collection

## Deployment

No manual deployment steps required! The user service is:
1. Automatically deployed with the webapp via Cloud Run
2. Indexes are created via Terraform
3. User documents are created automatically on user login

## Testing

To test locally, ensure you have:
1. Firebase Admin SDK initialized with credentials
2. Valid Firebase ID token for testing

The service gracefully handles failures - if user profile updates fail during authentication, the error is logged but authentication continues successfully.
