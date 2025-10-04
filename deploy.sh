#!/bin/bash
# Deployment script for Band Practice App

set -e

echo "🎸 Band Practice App Deployment Script"
echo "========================================"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ .env file not found. Please create one with your configuration."
    exit 1
fi

# Check required variables
if [ -z "$GCP_PROJECT_ID" ]; then
    echo "❌ GCP_PROJECT_ID not set in .env"
    exit 1
fi

echo "📦 Project: $GCP_PROJECT_ID"
echo "📍 Region: ${GCP_REGION:-us-west1}"

# Set GCP project
echo ""
echo "🔧 Setting GCP project..."
gcloud config set project $GCP_PROJECT_ID

# Build using Cloud Build (no local Docker needed!)
echo ""
echo "🐳 Building image with Cloud Build..."
gcloud builds submit --tag ${GCP_REGION:-us-west1}-docker.pkg.dev/$GCP_PROJECT_ID/band-practice-pro/app:latest

# Deploy to Cloud Run
echo ""
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy band-practice-pro \
    --image=${GCP_REGION:-us-west1}-docker.pkg.dev/$GCP_PROJECT_ID/band-practice-pro/app:latest \
    --platform=managed \
    --region=${GCP_REGION:-us-west1} \
    --allow-unauthenticated \
    --set-env-vars="GCP_PROJECT_ID=$GCP_PROJECT_ID" \
    --set-env-vars="SPOTIFY_CLIENT_ID=$SPOTIFY_CLIENT_ID" \
    --set-env-vars="SPOTIFY_CLIENT_SECRET=$SPOTIFY_CLIENT_SECRET" \
    --set-env-vars="GENIUS_ACCESS_TOKEN=$GENIUS_ACCESS_TOKEN" \
    --set-env-vars="SPOTIFY_PLAYLIST_URL=$SPOTIFY_PLAYLIST_URL" \
    --set-env-vars="SECRET_KEY=$SECRET_KEY"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your app URL:"
gcloud run services describe band-practice-pro --region=${GCP_REGION:-us-west1} --format='value(status.url)'
