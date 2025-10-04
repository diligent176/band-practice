#!/bin/bash
# Run Band Practice App locally for development

set -e

echo "🎸 Starting Band Practice App (Local Development)"
echo "================================================"

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please create .env with your configuration."
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check Python version
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.9 or higher."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

echo "📦 Activating virtual environment..."
source venv/bin/activate || source venv/Scripts/activate

echo "📦 Installing dependencies..."
pip install -q -r requirements.txt

# Run Flask app
echo ""
echo "🚀 Starting Flask development server..."
echo "📍 App will be available at: http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop"
echo ""

cd webapp
export FLASK_ENV=development
export PORT=8080
python app.py
