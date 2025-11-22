# Manual Firestore Security Rules Deployment Guide
# Use this if you have Node.js version issues with Firebase CLI

Write-Host "🔒 Manual Firestore Security Rules Deployment" -ForegroundColor Cyan
Write-Host ""
Write-Host "Since you're having issues with Firebase CLI, here's how to deploy manually:" -ForegroundColor Yellow
Write-Host ""

# Read the rules file
$rulesContent = Get-Content "firestore.rules" -Raw

if (-not $rulesContent) {
  Write-Host "❌ firestore.rules file not found!" -ForegroundColor Red
  exit 1
}

Write-Host "✅ Found firestore.rules file" -ForegroundColor Green
Write-Host ""

# Get project ID from .firebaserc
$firebaserc = Get-Content ".firebaserc" | ConvertFrom-Json
$projectId = $firebaserc.projects.default

Write-Host "Project ID: $projectId" -ForegroundColor Cyan
Write-Host ""

# Provide instructions
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "STEP 1: Open Firebase Console" -ForegroundColor Cyan
Write-Host "--------" -ForegroundColor Gray
$consoleUrl = "https://console.firebase.google.com/project/$projectId/firestore/rules"
Write-Host $consoleUrl -ForegroundColor White
Write-Host ""

# Try to open in default browser
Write-Host "Opening in browser..." -ForegroundColor Gray
Start-Process $consoleUrl

Write-Host ""
Write-Host "STEP 2: Replace Rules" -ForegroundColor Cyan
Write-Host "--------" -ForegroundColor Gray
Write-Host "1. Click 'Edit rules' button" -ForegroundColor White
Write-Host "2. Select ALL existing rules (Ctrl+A)" -ForegroundColor White
Write-Host "3. Press DELETE to clear them" -ForegroundColor White
Write-Host "4. Copy the rules below" -ForegroundColor White
Write-Host "5. Paste into the editor" -ForegroundColor White
Write-Host "6. Click 'Publish'" -ForegroundColor White
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

# Copy rules to clipboard if possible
try {
  Set-Clipboard -Value $rulesContent
  Write-Host "✅ Rules copied to clipboard! Just paste (Ctrl+V) in Firebase Console" -ForegroundColor Green
}
catch {
  Write-Host "⚠️  Couldn't copy to clipboard. Copy the rules below:" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━ FIRESTORE RULES (COPY THIS) ━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host $rulesContent -ForegroundColor White
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

Write-Host "After publishing, verify at:" -ForegroundColor Cyan
Write-Host "  $consoleUrl" -ForegroundColor White
Write-Host ""
Write-Host "You should see:" -ForegroundColor Gray
Write-Host "  - Status: Published" -ForegroundColor White
Write-Host "  - Timestamp: (current time)" -ForegroundColor White
Write-Host ""

# Wait for user confirmation
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Read-Host "Press ENTER after you've published the rules"

Write-Host ""
Write-Host "✅ Great! Your database is now secured!" -ForegroundColor Green
Write-Host ""
Write-Host "Test your security by visiting your app and checking:" -ForegroundColor Cyan
Write-Host "  - You can still login (✓)" -ForegroundColor White
Write-Host "  - You can still view your collections (✓)" -ForegroundColor White
Write-Host "  - Unauthenticated access is blocked (✓)" -ForegroundColor White
Write-Host ""
