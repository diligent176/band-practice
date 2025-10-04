@echo off
REM Run Band Practice App locally for development (Windows)

echo 🎸 Starting Band Practice App (Local Development)
echo ================================================

REM Check if .env exists
if not exist .env (
    echo ❌ .env file not found!
    echo Please create .env with your configuration.
    exit /b 1
)

REM Create virtual environment if needed
if not exist venv (
    echo 📦 Creating virtual environment...
    python -m venv venv
)

echo 📦 Activating virtual environment...
call venv\Scripts\activate

echo 📦 Installing dependencies...
pip install -q -r requirements.txt

REM Run Flask app
echo.
echo 🚀 Starting Flask development server...
echo 📍 App will be available at: http://localhost:8080
echo.
echo Press Ctrl+C to stop
echo.

cd webapp
set FLASK_ENV=development
set PORT=8080
python app.py
