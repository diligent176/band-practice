# Terraform Configuration for Band Practice Pro
#
# This configuration is split across multiple files:
# - main.tf: Core Terraform and provider configuration
# - apis.tf: Google Cloud API enablement
# - secrets.tf: Secret Manager resources
# - firestore.tf: Firestore database configuration
# - artifact_registry.tf: Container registry setup
# - cloud_run.tf: Cloud Run service definition
# - iam.tf: Service accounts and IAM bindings
# - outputs.tf: Output values
# - variables.tf: Input variable declarations

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
