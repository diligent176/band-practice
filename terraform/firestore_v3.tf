# Band Practice Pro v3 - Firestore Collections & Indexes
# New collections for v3 (v2 collections remain untouched)

# Note: Firestore collections are auto-created when first document is added
# This file documents the schema and creates necessary composite indexes

# ============================================================================
# COMPOSITE INDEXES (Required for complex queries)
# ============================================================================

# Index: Query songs by collection and created_at
resource "google_firestore_index" "songs_v3_by_collection" {
  project    = var.project_id
  database   = "(default)"
  collection = "songs_v3"

  fields {
    field_path = "collection_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
}

# Index: Query songs by collection and title (for search)
resource "google_firestore_index" "songs_v3_search_by_title" {
  project    = var.project_id
  database   = "(default)"
  collection = "songs_v3"

  fields {
    field_path = "collection_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "title"
    order      = "ASCENDING"
  }
}

# Index: Query collections by owner_uid and name (for get_user_collections)
resource "google_firestore_index" "collections_v3_by_owner" {
  project    = var.project_id
  database   = "(default)"
  collection = "collections_v3"

  fields {
    field_path = "owner_uid"
    order      = "ASCENDING"
  }

  fields {
    field_path = "name"
    order      = "ASCENDING"
  }
}

# Index: Query collections by collaborator and name (for shared collections)
resource "google_firestore_index" "collections_v3_by_collaborator" {
  project    = var.project_id
  database   = "(default)"
  collection = "collections_v3"

  fields {
    field_path   = "collaborators"
    array_config = "CONTAINS"
  }

  fields {
    field_path = "name"
    order      = "ASCENDING"
  }
}

# Index: Query Personal Collection by owner_uid and is_personal flag
resource "google_firestore_index" "collections_v3_personal" {
  project    = var.project_id
  database   = "(default)"
  collection = "collections_v3"

  fields {
    field_path = "owner_uid"
    order      = "ASCENDING"
  }

  fields {
    field_path = "is_personal"
    order      = "ASCENDING"
  }
}

# Index: Query public collections
resource "google_firestore_index" "collections_v3_public" {
  project    = var.project_id
  database   = "(default)"
  collection = "collections_v3"

  fields {
    field_path = "visibility"
    order      = "ASCENDING"
  }

  fields {
    field_path = "updated_at"
    order      = "DESCENDING"
  }
}

# Index: Query playlists by Spotify ID
resource "google_firestore_index" "playlists_v3_by_spotify_id" {
  project    = var.project_id
  database   = "(default)"
  collection = "playlists_v3"

  fields {
    field_path = "spotify_playlist_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "imported_at"
    order      = "DESCENDING"
  }
}

# Index: Query playlist memory by user and last accessed (for recent playlists)
resource "google_firestore_index" "playlist_memory_v3_recent" {
  project    = var.project_id
  database   = "(default)"
  collection = "playlist_memory_v3"

  fields {
    field_path = "user_uid"
    order      = "ASCENDING"
  }

  fields {
    field_path = "last_accessed_at"
    order      = "DESCENDING"
  }
}

# ============================================================================
# FIRESTORE SECURITY RULES
# ============================================================================

# Note: Security rules should be deployed separately via Firebase Console
# or firebase-tools CLI. This is documented here for reference.

/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return isAuthenticated() && request.auth.uid == uid;
    }

    function isAdmin() {
      return isAuthenticated() &&
             get(/databases/$(database)/documents/users_v3/$(request.auth.uid)).data.is_admin == true;
    }

    // Users v3
    match /users_v3/{userId} {
      // Users can read their own profile
      allow read: if isOwner(userId) || isAdmin();

      // Users can update their own profile (except is_admin field)
      allow update: if isOwner(userId) &&
                       !request.resource.data.diff(resource.data).affectedKeys().hasAny(['is_admin']);

      // Only system can create users (via backend)
      allow create: if false;

      // Users cannot delete themselves
      allow delete: if isAdmin();
    }

    // Collections v3
    match /collections_v3/{collectionId} {
      // Anyone can read public collections
      // Owners and collaborators can read their collections
      allow read: if resource.data.visibility == 'public' ||
                     isOwner(resource.data.owner_uid) ||
                     isAdmin() ||
                     request.auth.uid in resource.data.collaborators;

      // Only authenticated users can create collections
      allow create: if isAuthenticated() &&
                       request.resource.data.owner_uid == request.auth.uid;

      // Only owners can update/delete collections
      allow update, delete: if isOwner(resource.data.owner_uid) || isAdmin();
    }

    // Songs v3
    match /songs_v3/{songId} {
      // Songs inherit permissions from parent collection
      // This is enforced in backend logic
      allow read: if isAuthenticated();

      // Only authenticated users can create/update songs
      // (Collection ownership checked in backend)
      allow create, update: if isAuthenticated();

      // Only collection owners can delete songs
      // (Checked in backend)
      allow delete: if isAuthenticated();
    }

    // Playlists v3
    match /playlists_v3/{playlistId} {
      // Anyone can read playlists
      allow read: if isAuthenticated();

      // Only authenticated users can create playlists
      allow create: if isAuthenticated();

      // Only importers can update/delete playlists
      allow update, delete: if isOwner(resource.data.imported_by_uid) || isAdmin();
    }

    // Spotify tokens v3
    match /spotify_tokens_v3/{userId} {
      // Users can only access their own tokens
      allow read, write: if isOwner(userId);

      // Admins cannot access tokens (security)
      allow read, write: if false;
    }
  }
}
*/
