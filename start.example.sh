#!/bin/bash

# Example start script - replace values with your actual configuration
export ACTUAL_PASSWORD="your_password_here"
export ACTUAL_SERVER_URL="http://localhost:5006"

echo "Building project..."
npm run build

echo "Starting server..."
npm start
