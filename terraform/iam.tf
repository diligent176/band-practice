# Service Account and IAM Bindings

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
