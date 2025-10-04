@echo off
setlocal enabledelayedexpansion

echo 🎸 Band Practice App Deployment Script
echo ========================================

REM Load environment variables from .env file
if not exist .env (
    echo ❌ .env file not found. Please create one with your configuration.
    exit /b 1
)

for /f "usebackq tokens=1,2 delims==" %%i in (.env) do (
    set "line=%%i"
    if not "!line:~0,1!"=="#" (
        set "%%i=%%j"
    )
)

REM Check required variables
if "%GCP_PROJECT_ID%"=="" (
    echo ❌ GCP_PROJECT_ID not set in .env
    exit /b 1
)

REM Set default region if not specified
if "%GCP_REGION%"=="" set GCP_REGION=us-west1

echo 📦 Project: %GCP_PROJECT_ID%
echo 📍 Region: %GCP_REGION%

REM Set GCP project
echo.
echo 🔧 Setting GCP project...
gcloud config set project %GCP_PROJECT_ID%
if %errorlevel% neq 0 exit /b %errorlevel%

REM Build using Cloud Build
echo.
echo 🐳 Building image with Cloud Build...
gcloud builds submit --tag %GCP_REGION%-docker.pkg.dev/%GCP_PROJECT_ID%/band-practice-pro/app:latest
if %errorlevel% neq 0 exit /b %errorlevel%

REM Deploy to Cloud Run
echo.
echo 🚀 Deploying to Cloud Run...
gcloud run deploy band-practice-pro ^
    --image=%GCP_REGION%-docker.pkg.dev/%GCP_PROJECT_ID%/band-practice-pro/app:latest ^
    --platform=managed ^
    --region=%GCP_REGION% ^
    --no-allow-unauthenticated ^
    --set-env-vars="GCP_PROJECT_ID=%GCP_PROJECT_ID%" ^
    --set-env-vars="SPOTIFY_CLIENT_ID=%SPOTIFY_CLIENT_ID%" ^
    --set-env-vars="SPOTIFY_CLIENT_SECRET=%SPOTIFY_CLIENT_SECRET%" ^
    --set-env-vars="GENIUS_ACCESS_TOKEN=%GENIUS_ACCESS_TOKEN%" ^
    --set-env-vars="SPOTIFY_PLAYLIST_URL=%SPOTIFY_PLAYLIST_URL%" ^
    --set-env-vars="SECRET_KEY=%SECRET_KEY%" ^
    --set-env-vars="GCP_PROJECT_NUMBER=%GCP_PROJECT_NUMBER%"

if %errorlevel% neq 0 exit /b %errorlevel%

echo.
echo ✅ Deployment complete!
echo.
echo 🌐 Your app URL:
gcloud run services describe band-practice-pro --region=%GCP_REGION% --format="value(status.url)"