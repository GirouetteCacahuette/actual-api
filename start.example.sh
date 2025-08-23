#!/bin/bash

# Example start script - replace values with your actual configuration
export ACTUAL_PASSWORD="your_password_here"
export ACTUAL_SERVER_URL="http://localhost:5006"
export ACTUAL_SYNC_ID="1234567890"
export ACTUAL_BUDGET_ENCRYPTION_KEY="1234567890"
export NODE_EXTRA_CA_CERTS="/path/to/cert"

echo "Building project..."
yarn build

echo "Starting server..."
yarn start
