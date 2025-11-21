# Secret Manager Secrets and Versions

resource "google_secret_manager_secret" "spotify_client_id" {
  secret_id = "SPOTIFY_CLIENT_ID"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "spotify_client_id" {
  secret      = google_secret_manager_secret.spotify_client_id.id
  secret_data = var.spotify_client_id
}

resource "google_secret_manager_secret" "spotify_client_secret" {
  secret_id = "SPOTIFY_CLIENT_SECRET"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "spotify_client_secret" {
  secret      = google_secret_manager_secret.spotify_client_secret.id
  secret_data = var.spotify_client_secret
}

resource "google_secret_manager_secret" "genius_access_token" {
  secret_id = "GENIUS_ACCESS_TOKEN"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "genius_access_token" {
  secret      = google_secret_manager_secret.genius_access_token.id
  secret_data = var.genius_access_token
}

resource "google_secret_manager_secret" "secret_key" {
  secret_id = "SECRET_KEY"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "secret_key" {
  secret      = google_secret_manager_secret.secret_key.id
  secret_data = var.flask_secret_key
}

resource "google_secret_manager_secret" "firebase_api_key" {
  secret_id = "FIREBASE_API_KEY"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "firebase_api_key" {
  secret      = google_secret_manager_secret.firebase_api_key.id
  secret_data = var.firebase_api_key
}

resource "google_secret_manager_secret" "scraper_api_key" {
  secret_id = "SCRAPER_API_KEY"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "scraper_api_key" {
  secret      = google_secret_manager_secret.scraper_api_key.id
  secret_data = var.scraper_api_key
}

resource "google_secret_manager_secret" "getsongbpm_api_key" {
  secret_id = "GETSONGBPM_API_KEY"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "getsongbpm_api_key" {
  secret      = google_secret_manager_secret.getsongbpm_api_key.id
  secret_data = var.getsongbpm_api_key
}
