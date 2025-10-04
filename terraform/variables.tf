variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region for Cloud Run"
  type        = string
  default     = "us-west1"
}

variable "firestore_location" {
  description = "Firestore location (must be a multi-region location like 'nam5' or single region)"
  type        = string
  default     = "nam5"
}

variable "spotify_client_id" {
  description = "Spotify API Client ID"
  type        = string
  sensitive   = true
}

variable "spotify_client_secret" {
  description = "Spotify API Client Secret"
  type        = string
  sensitive   = true
}

variable "genius_access_token" {
  description = "Genius API Access Token"
  type        = string
  sensitive   = true
}

variable "spotify_playlist_url" {
  description = "Default Spotify Playlist URL"
  type        = string
}

variable "flask_secret_key" {
  description = "Flask Secret Key for sessions"
  type        = string
  sensitive   = true
  default     = ""
}

variable "firebase_api_key" {
  description = "Firebase Web API Key"
  type        = string
  sensitive   = true
}

variable "allowed_user_emails" {
  description = "List of email addresses allowed to access the app"
  type        = list(string)
  default     = ["jcbellis@gmail.com"]
}
