# Output Values

output "cloud_run_url" {
  value       = google_cloud_run_service.band_practice.status[0].url
  description = "URL of the deployed Cloud Run service"
}

output "artifact_registry_url" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/band-practice-pro"
  description = "Artifact Registry URL for Docker images"
}

output "custom_domain_dns_records" {
  value = var.custom_domain != "" ? {
    domain = var.custom_domain
    type   = "CNAME"
    name   = try(split(".", var.custom_domain)[0], "")
    value  = "ghs.googlehosted.com."
  } : null
  description = "DNS records to configure at your domain registrar."
}
