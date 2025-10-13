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
