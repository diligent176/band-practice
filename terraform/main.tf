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
        image = "${var.region}-docker.pkg.dev/${var.project_id}/band-practice-pro/app:latest"

        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "SPOTIFY_CLIENT_ID"
          value = var.spotify_client_id
        }

        env {
          name  = "SPOTIFY_CLIENT_SECRET"
          value = var.spotify_client_secret
        }

        env {
          name  = "GENIUS_ACCESS_TOKEN"
          value = var.genius_access_token
        }

        env {
          name  = "SPOTIFY_PLAYLIST_URL"
          value = var.spotify_playlist_url
        }

        env {
          name  = "SECRET_KEY"
          value = var.flask_secret_key
        }

        env {
          name  = "FIREBASE_API_KEY"
          value = var.firebase_api_key
        }

        env {
          name  = "FIREBASE_AUTH_DOMAIN"
          value = "${var.project_id}.firebaseapp.com"
        }

        env {
          name  = "FIREBASE_PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "ALLOWED_USERS"
          value = join(",", var.allowed_user_emails)
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
        "autoscaling.knative.dev/maxScale" = "10"
        "autoscaling.knative.dev/minScale" = "0"
        # "run.googleapis.com/ingress"       = "all"
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
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
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
