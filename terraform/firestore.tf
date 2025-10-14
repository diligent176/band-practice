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
