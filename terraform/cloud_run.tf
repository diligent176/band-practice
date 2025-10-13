# Cloud Run Service Configuration

resource "google_cloud_run_service" "band_practice" {
  name     = "band-practice-pro"
  location = var.region

  template {
    spec {
      containers {
        image = "${var.region}-docker.pkg.dev/${var.project_id}/band-practice-pro/band-practice-pro:latest"

        # Non-sensitive environment variables
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

        env {
          name = "SCRAPER_API_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.scraper_api_key.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "GETSONGBPM_API_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.getsongbpm_api_key.secret_id
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

# Allow public access (app handles auth internally)
resource "google_cloud_run_service_iam_member" "authenticated_access" {
  service  = google_cloud_run_service.band_practice.name
  location = google_cloud_run_service.band_practice.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Custom Domain Mapping (optional)
resource "google_cloud_run_domain_mapping" "custom_domain" {
  count    = var.custom_domain != "" ? 1 : 0
  location = var.region
  name     = var.custom_domain

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_service.band_practice.name
  }

  depends_on = [google_cloud_run_service.band_practice]
}
