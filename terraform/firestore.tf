# Firestore Database Configuration

resource "google_firestore_database" "database" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.firestore]
}

# Composite index for playlist_memory collection
# Enables efficient querying of playlists by user_id, sorted by last_accessed
resource "google_firestore_index" "playlist_memory_user_last_accessed" {
  project    = var.project_id
  database   = google_firestore_database.database.name
  collection = "playlist_memory"

  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "last_accessed"
    order      = "DESCENDING"
  }

  depends_on = [google_firestore_database.database]
}

# Composite index for collections collection
# Enables efficient querying of collections by user_id, sorted by name
resource "google_firestore_index" "collections_user_name" {
  project    = var.project_id
  database   = google_firestore_database.database.name
  collection = "collections"

  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "name"
    order      = "ASCENDING"
  }

  depends_on = [google_firestore_database.database]
}

# Composite index for songs collection by collection_id
# Enables efficient querying of songs by collection_id, sorted by artist and title
resource "google_firestore_index" "songs_collection_artist_title" {
  project    = var.project_id
  database   = google_firestore_database.database.name
  collection = "songs"

  fields {
    field_path = "collection_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "artist"
    order      = "ASCENDING"
  }

  fields {
    field_path = "title"
    order      = "ASCENDING"
  }

  depends_on = [google_firestore_database.database]
}

# ============================================================================
# V2 INDEXES - New data model for playlist linking (not importing)
# ============================================================================

# Composite index for collections_v2 collection
# Enables efficient querying of collections by user_id, sorted by name
resource "google_firestore_index" "collections_v2_user_name" {
  project    = var.project_id
  database   = google_firestore_database.database.name
  collection = "collections_v2"

  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "name"
    order      = "ASCENDING"
  }

  depends_on = [google_firestore_database.database]
}

# Composite index for songs_v2 collection by collection_id
# Enables efficient querying of songs by collection_id, sorted by artist and title
resource "google_firestore_index" "songs_v2_collection_artist_title" {
  project    = var.project_id
  database   = google_firestore_database.database.name
  collection = "songs_v2"

  fields {
    field_path = "collection_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "artist"
    order      = "ASCENDING"
  }

  fields {
    field_path = "title"
    order      = "ASCENDING"
  }

  depends_on = [google_firestore_database.database]
}

# Composite index for songs_v2 collection by collection_id and title
# Enables efficient querying for "Sort by Song Title" feature
resource "google_firestore_index" "songs_v2_collection_title" {
  project    = var.project_id
  database   = google_firestore_database.database.name
  collection = "songs_v2"

  fields {
    field_path = "collection_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "title"
    order      = "ASCENDING"
  }

  depends_on = [google_firestore_database.database]
}

# Composite index for songs_v2 collection - removed songs
# Enables efficient querying of removed songs for review
resource "google_firestore_index" "songs_v2_collection_removed" {
  project    = var.project_id
  database   = google_firestore_database.database.name
  collection = "songs_v2"

  fields {
    field_path = "collection_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "is_removed_from_spotify"
    order      = "ASCENDING"
  }

  fields {
    field_path = "removal_detected_at"
    order      = "DESCENDING"
  }

  depends_on = [google_firestore_database.database]
}

# Composite index for playlist_memory_v2 collection
# Enables efficient querying of playlists by user_id, sorted by last_accessed
resource "google_firestore_index" "playlist_memory_v2_user_last_accessed" {
  project    = var.project_id
  database   = google_firestore_database.database.name
  collection = "playlist_memory_v2"

  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "last_accessed"
    order      = "DESCENDING"
  }

  depends_on = [google_firestore_database.database]
}
