#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Define variables
PROJECT_DIR="/var/www/oneserver"
LOG_FILE="${PROJECT_DIR}/logs/deploy.log"

# Create logs directory if it doesn't exist
mkdir -p "${PROJECT_DIR}/logs"

# Logger function
log() {
  echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "🚀 Starting ONEServer website deployment sequence..."

# Navigate to project directory
cd "$PROJECT_DIR"

# 1. Fetch latest changes from Git
log "📥 Fetching latest changes from main branch..."
git fetch origin main
log "🧹 Stashing any local changes..."
git stash || true
log "🔀 Pulling latest updates from Git..."
git pull origin main

# 2. Install dependencies
log "📦 Installing NPM workspace dependencies..."
npm install

# 3. Build only the website package
log "🏗️ Compiling production build for website package..."
npm run build -w apps/website

# 4. Reload PM2 process
log "🔄 Reloading PM2 process for oneserver-website with zero-downtime..."
# Check if ecosystem.config.js is already running under PM2
if pm2 describe oneserver-website > /dev/null 2>&1; then
  pm2 reload oneserver-website --update-env
else
  log "⚠️ oneserver-website process not found in PM2. Launching new process..."
  pm2 start apps/website/ecosystem.config.js
fi

log "✅ Deployment completed successfully!"
