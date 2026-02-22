#!/usr/bin/env bash
# Kill any process using common Vite dev ports so you can start fresh on 8080.
set -e
PORTS="8080 8081 8082 5173 8880 8881 8882"
for port in $PORTS; do
  pid=$(lsof -ti:$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    kill -9 $pid 2>/dev/null || true
    echo "Killed process on port $port (PID $pid)"
  fi
done
echo "Ports cleared. You can run 'pnpm dev' now."
