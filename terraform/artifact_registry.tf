# Artifact Registry Repository for Docker Images

resource "google_artifact_registry_repository" "docker_repo" {
  location      = var.region
  repository_id = "band-practice-pro"
  description   = "Docker repository for Band Practice App"
  format        = "DOCKER"

  depends_on = [google_project_service.artifactregistry]
}
