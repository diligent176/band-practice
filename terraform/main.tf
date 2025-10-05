terraform {
  required_version = ">= 1.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "band-practice-pro-terraform-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "firestore" {
  service            = "firestore.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "run" {
  service            = "run.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "build" {
  service            = "cloudbuild.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "artifactregistry" {
  service            = "artifactregistry.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "secretmanager" {
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

# Secret Manager Secrets
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

resource "google_secret_manager_secret" "allowed_users" {
  secret_id = "ALLOWED_USERS"
  replication {
    auto {}
  }
  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "allowed_users" {
  secret      = google_secret_manager_secret.allowed_users.id
  secret_data = join(",", var.allowed_user_emails)
}

# Firestore Database
resource "google_firestore_database" "database" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.firestore]
}

# Artifact Registry Repository for Docker images
resource "google_artifact_registry_repository" "docker_repo" {
  location      = var.region
  repository_id = "band-practice-pro"
  description   = "Docker repository for Band Practice App"
  format        = "DOCKER"

  depends_on = [google_project_service.artifactregistry]
}

# Cloud Run Service
resource "google_cloud_run_service" "band_practice" {
  name     = "band-practice-pro"
  location = var.region

  template {
    spec {
      containers {
        image = "${var.region}-docker.pkg.dev/${var.project_id}/band-practice-pro/band-practice-pro:latest"

        # Non-sensitive env vars
        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "SPOTIFY_PLAYLIST_URL"
          value = var.spotify_playlist_url
        }

        env {
          name  = "FIREBASE_AUTH_DOMAIN"
          value = "${var.project_id}.firebaseapp.com"
        }

        env {
          name  = "FIREBASE_PROJECT_ID"
          value = var.project_id
        }

        # Secrets mounted from Secret Manager
        env {
          name = "SPOTIFY_CLIENT_ID"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.spotify_client_id.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "SPOTIFY_CLIENT_SECRET"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.spotify_client_secret.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "GENIUS_ACCESS_TOKEN"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.genius_access_token.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "SECRET_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.secret_key.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "FIREBASE_API_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.firebase_api_key.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "ALLOWED_USERS"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.allowed_users.secret_id
              key  = "latest"
            }
          }
        }

        resources {
          limits = {
            cpu    = "1000m"
            memory = "512Mi"
          }
        }
      }

      service_account_name = google_service_account.cloud_run_sa.email
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale" = "4"
        "autoscaling.knative.dev/minScale" = "0"
      }
    }
  }

  metadata {
    annotations = {
      "run.googleapis.com/ingress" = "all"
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [
    google_project_service.run,
    google_artifact_registry_repository.docker_repo
  ]
}

# IAM - Allow public access, app handles auth
resource "google_cloud_run_service_iam_member" "authenticated_access" {
  service  = google_cloud_run_service.band_practice.name
  location = google_cloud_run_service.band_practice.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Service Account for Cloud Run
resource "google_service_account" "cloud_run_sa" {
  account_id   = "band-practice-pro-sa"
  display_name = "Band Practice App Service Account"
}

# Grant Firestore access to service account
resource "google_project_iam_member" "firestore_user" {
  project    = var.project_id
  role       = "roles/datastore.user"
  member     = "serviceAccount:${google_service_account.cloud_run_sa.email}"
  depends_on = [google_service_account.cloud_run_sa]
}

# Grant Secret Manager access to service account
resource "google_project_iam_member" "secret_accessor" {
  project    = var.project_id
  role       = "roles/secretmanager.secretAccessor"
  member     = "serviceAccount:${google_service_account.cloud_run_sa.email}"
  depends_on = [google_service_account.cloud_run_sa, google_project_service.secretmanager]
}

# Outputs
output "cloud_run_url" {
  value       = google_cloud_run_service.band_practice.status[0].url
  description = "URL of the deployed Cloud Run service"
}

output "artifact_registry_url" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/band-practice-pro"
  description = "Artifact Registry URL for Docker images"
}
