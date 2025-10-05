# Band Practice App Deployment Script
# Equivalent PowerShell version of deploy.bat

param(
  [switch]$Help
)

if ($Help) {
  Write-Host "Band Practice App Deployment Script"
  Write-Host "Usage: .\deploy.ps1"
  Write-Host "Make sure you have a .env file with required configuration."
  exit 0
}

Write-Host "🎸 Band Practice App Deployment Script" -ForegroundColor Green
Write-Host "========================================"

# Load environment variables from .env file
if (-not (Test-Path ".env")) {
  Write-Host "❌ .env file not found. Please create one with your configuration." -ForegroundColor Red
  exit 1
}

# Read and parse .env file
Get-Content ".env" | ForEach-Object {
  if ($_ -and -not $_.StartsWith("#")) {
    $key, $value = $_ -split "=", 2
    if ($key -and $value) {
      [Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim(), "Process")
    }
  }
}

# Check required variables
$GCP_PROJECT_ID = [Environment]::GetEnvironmentVariable("GCP_PROJECT_ID")
if (-not $GCP_PROJECT_ID) {
  Write-Host "❌ GCP_PROJECT_ID not set in .env" -ForegroundColor Red
  exit 1
}

# Set default region if not specified
$GCP_REGION = [Environment]::GetEnvironmentVariable("GCP_REGION")
if (-not $GCP_REGION) {
  $GCP_REGION = "us-west1"
  [Environment]::SetEnvironmentVariable("GCP_REGION", $GCP_REGION, "Process")
}

Write-Host "📦 Project: $GCP_PROJECT_ID" -ForegroundColor Cyan
Write-Host "📍 Region: $GCP_REGION" -ForegroundColor Cyan

# Set GCP project
Write-Host ""
Write-Host "🔧 Setting GCP project..." -ForegroundColor Yellow
$result = gcloud config set project $GCP_PROJECT_ID
if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Failed to set GCP project" -ForegroundColor Red
  exit $LASTEXITCODE
}

# Build using Cloud Build
Write-Host ""
Write-Host "🐳 Building image with Cloud Build..." -ForegroundColor Yellow
$imageTag = "$GCP_REGION-docker.pkg.dev/$GCP_PROJECT_ID/band-practice-pro/band-practice-pro:latest"
$result = gcloud builds submit --tag $imageTag
if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Failed to build image" -ForegroundColor Red
  exit $LASTEXITCODE
}

# Deploy to Cloud Run
Write-Host ""
Write-Host "🚀 Deploying to Cloud Run..." -ForegroundColor Yellow

# Get environment variables for deployment
$SPOTIFY_CLIENT_ID = [Environment]::GetEnvironmentVariable("SPOTIFY_CLIENT_ID")
$SPOTIFY_CLIENT_SECRET = [Environment]::GetEnvironmentVariable("SPOTIFY_CLIENT_SECRET")
$GENIUS_ACCESS_TOKEN = [Environment]::GetEnvironmentVariable("GENIUS_ACCESS_TOKEN")
$SPOTIFY_PLAYLIST_URL = [Environment]::GetEnvironmentVariable("SPOTIFY_PLAYLIST_URL")
$SECRET_KEY = [Environment]::GetEnvironmentVariable("SECRET_KEY")
$GCP_PROJECT_NUMBER = [Environment]::GetEnvironmentVariable("GCP_PROJECT_NUMBER")

$result = gcloud run deploy band-practice-pro `
  --image=$imageTag `
  --platform=managed `
  --region=$GCP_REGION `
  --no-allow-unauthenticated `
  --set-env-vars="GCP_PROJECT_ID=$GCP_PROJECT_ID" `
  --set-env-vars="SPOTIFY_CLIENT_ID=$SPOTIFY_CLIENT_ID" `
  --set-env-vars="SPOTIFY_CLIENT_SECRET=$SPOTIFY_CLIENT_SECRET" `
  --set-env-vars="GENIUS_ACCESS_TOKEN=$GENIUS_ACCESS_TOKEN" `
  --set-env-vars="SPOTIFY_PLAYLIST_URL=$SPOTIFY_PLAYLIST_URL" `
  --set-env-vars="SECRET_KEY=$SECRET_KEY" `
  --set-env-vars="GCP_PROJECT_NUMBER=$GCP_PROJECT_NUMBER"

if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Failed to deploy to Cloud Run" -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Your app URL:" -ForegroundColor Cyan
$appUrl = gcloud run services describe band-practice-pro --region=$GCP_REGION --format="value(status.url)"
Write-Host $appUrl -ForegroundColor Blue