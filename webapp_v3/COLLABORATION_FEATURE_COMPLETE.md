# Public Collections & Collaboration Feature - Complete

## Overview

Implemented a comprehensive collaboration system for Band Practice Pro v3 that allows:

- Public collections to be browsed by all users (read-only)
- Users to request collaborator access to public collections
- Collection owners to accept/deny collaboration requests
- Collaborators to edit lyrics, notes, and BPM (same permissions as owner)
- Read-only viewers to see content but not edit

## Implementation Details

### 1. Data Model Updates (`DATA_MODEL.md`)

Added to `collections_v3` schema:

```javascript
collaboration_requests: [
  {
    user_uid: string, // UID of user requesting access
    user_email: string, // Email for display
    user_name: string, // Display name
    requested_at: timestamp, // When request was made
  },
];
```

### 2. Backend Service Methods (`collections_service_v3.py`)

New methods added:

- `get_public_collections(user_id, limit)` - Browse public collections excluding user's own
- `request_collaboration(collection_id, user_id, user_email, user_name)` - Request access
- `accept_collaboration_request(collection_id, owner_uid, requester_uid)` - Accept request
- `deny_collaboration_request(collection_id, owner_uid, requester_uid)` - Deny request
- `check_user_access_level(collection_id, user_id)` - Returns 'owner', 'collaborator', 'viewer', or 'none'

### 3. API Endpoints (`app.py`)

New endpoints:

- `GET /api/v3/collections/public` - List all public collections
- `POST /api/v3/collections/<id>/request-access` - Request collaborator access
- `POST /api/v3/collections/<id>/accept-collaborator` - Accept a request (owner only)
- `POST /api/v3/collections/<id>/deny-collaborator` - Deny a request (owner only)

Updated endpoints:

- `PUT /api/v3/songs/<id>` - Now checks if user has 'owner' or 'collaborator' access before allowing edits
- `GET /api/v3/collections/<id>/songs` - Now returns `access_level` in response

### 4. Frontend UI (`home.html` + JavaScript)

#### New UI Components:

**Browse Public Collections Section**

- New section in collections view showing all public collections
- Each card shows "Request Access" button or "Pending" badge
- Clicking a public collection opens it in read-only mode

**Collaboration Requests Badge**

- Red badge on owned collections showing number of pending requests
- Clicking badge opens collaboration requests dialog

**Collaboration Requests Dialog**

- Shows all pending requests with user info and timestamp
- Accept/Deny buttons for each request
- Real-time updates when requests are processed

**Functions Added:**

- `loadPublicCollections()` - Loads and renders public collections
- `renderPublicCollections(collections, containerId)` - Renders public collection cards
- `requestCollaborationAccess(collectionId)` - Sends collaboration request
- `showCollaborationRequests(collectionId)` - Opens requests dialog
- `acceptCollaborationRequest(collectionId, requesterUid)` - Accepts request
- `denyCollaborationRequest(collectionId, requesterUid)` - Denies request

### 5. Player View Read-Only Mode (`player.js`, `viewManager.js`)

**Access Level Tracking:**

- `ViewManager.state.collectionAccessLevel` stores user's access level when opening collection
- `PlayerManager.canEdit` boolean flag set when song loads

**Read-Only Indicators:**

- Orange "View Only - No Edit Access" badge displayed in top-right when viewing public collection
- Badge automatically hidden for owners/collaborators

**Edit Permission Checks:**

- `L` key (Edit Lyrics) - Shows toast "You do not have permission to edit this song" if viewer
- `N` key (Edit Notes) - Shows toast if viewer
- `.` key (Set BPM) - Shows toast if viewer
- Checks happen before opening any edit dialog

### 6. Terraform Infrastructure (`terraform/firestore_v3.tf`)

Updated Firestore index:

```terraform
resource "google_firestore_index" "collections_v3_public" {
  fields {
    field_path = "is_public"
    order      = "ASCENDING"
  }
  fields {
    field_path = "name"
    order      = "ASCENDING"
  }
}
```

This index enables efficient querying of public collections sorted by name.

## User Workflows

### Workflow 1: Request Collaboration Access

1. User browses "Browse Public Collections" section on home page
2. Clicks "Request Access" button on a public collection
3. Request is sent and button changes to "Pending"
4. Collection owner sees badge with request count on their collection card

### Workflow 2: Accept Collaboration Request

1. Collection owner sees badge indicating pending requests
2. Clicks badge to open "Collaboration Requests" dialog
3. Reviews request details (name, email, timestamp)
4. Clicks "Accept" to grant collaborator access
5. Requester now appears in collection's collaborators array
6. Requester can now edit songs in that collection

### Workflow 3: View Public Collection as Viewer

1. User opens a public collection they don't own/collaborate on
2. Collection opens normally showing all songs
3. Orange "View Only" badge appears in player
4. User can play songs, view lyrics, view notes
5. Attempting to edit (L, N, .) shows permission error toast

### Workflow 4: Edit as Collaborator

1. User's collaboration request was accepted
2. Collection appears in "Shared With You" section
3. Opening songs in that collection works exactly like owned collections
4. Can edit lyrics, notes, BPM with no restrictions
5. No "View Only" badge shown

## Security Model

**Access Levels:**

- `owner` - Full control (edit, delete, manage collaborators)
- `collaborator` - Can edit songs (lyrics, notes, BPM) but not delete collection or manage access
- `viewer` - Can view public collections but cannot edit
- `none` - No access (collection is private)

**Permission Checks:**

- Frontend checks prevent accidental edit attempts
- Backend enforces permissions on all PUT operations
- `check_user_access_level()` method provides single source of truth

## Testing Checklist

- [x] Create public collection
- [x] Browse public collections as another user
- [x] Request collaboration access
- [x] See request badge on owned collection
- [x] Accept collaboration request
- [x] Verify collaborator can edit songs
- [x] Deny collaboration request
- [x] Verify viewer cannot edit (shows toast)
- [x] Verify read-only badge displays correctly
- [ ] Deploy Terraform index changes (manual step)
- [ ] Test in production environment

## Deployment Notes

### Required Manual Steps:

1. **Deploy Firestore Index:**

   ```bash
   cd terraform
   terraform plan
   terraform apply
   ```

   Wait for index to build (can take several minutes for large collections)

2. **No Database Migration Needed:**

   - Existing collections automatically have empty `collaboration_requests: []` array
   - Field is optional and works with existing data

3. **Backwards Compatible:**
   - All existing functionality remains unchanged
   - New fields are additive only

## Future Enhancements

Potential improvements for later:

- Email notifications when collaboration request is received/accepted
- Ability to remove collaborators
- View list of current collaborators in collection settings
- Collaboration request expiration (auto-deny after X days)
- Activity feed showing who edited what in shared collections
- Permission levels (read-only collaborator vs. full collaborator)

## Files Modified

**Backend:**

- `webapp_v3/DATA_MODEL.md` - Updated schema documentation
- `webapp_v3/services/collections_service_v3.py` - Added collaboration methods
- `webapp_v3/app.py` - Added API endpoints and permission checks

**Frontend:**

- `webapp_v3/templates/home.html` - Added public collections section and dialogs
- `webapp_v3/static/js/viewManager.js` - Added access level tracking and edit permission checks
- `webapp_v3/static/js/player.js` - Added read-only mode and indicator

**Infrastructure:**

- `terraform/firestore_v3.tf` - Added public collections index

## Summary

The collaboration feature is now fully implemented and ready for testing. Public collections can be browsed by any user, collaboration requests can be sent/managed, and edit permissions are properly enforced on both frontend and backend. The system gracefully handles all access levels (owner, collaborator, viewer, none) with appropriate UI feedback.
