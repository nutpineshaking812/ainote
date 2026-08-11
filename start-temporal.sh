#!/bin/bash

# Check if temporal CLI is installed
if ! command -v temporal &> /dev/null
then
    echo "Temporal CLI not found!"
    echo "Please install it using Homebrew:"
    echo "  brew install temporal"
    echo ""
    echo "Or verify installation instructions at: https://docs.temporal.io/cli/#install"
    exit 1
fi

echo "Starting Temporal Dev Server (Native SQLite)..."
echo "Web UI: http://localhost:8233"
echo "gRPC: localhost:7233"

# Start server in background with UI on port 8233 to avoid defaults/conflicts
temporal server start-dev --ui-port 8233 --db-filename temporal.db
