#!/bin/sh
set -e

echo "Running database migrations..."
node --experimental-strip-types /app/scripts/migrate.ts

echo "Starting server..."
exec node /app/server.js
