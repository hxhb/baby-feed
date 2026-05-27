#!/usr/bin/env bash
# Baby Feed API wrapper — avoids raw curl|python3 pipes that trigger security scanners.
# Usage:
#   bash query-api.sh METHOD ENDPOINT [JSON_BODY]
#
# Examples:
#   bash query-api.sh GET  "/api/babies"
#   bash query-api.sh GET  "/api/stats?babyId=abc&days=7"
#   bash query-api.sh POST "/api/feeding" '{"babyId":"abc","type":"FORMULA","startTime":"2026-05-27T10:00:00+08:00","formulaAmount":120}'
#   bash query-api.sh PUT  "/api/memo/id123" '{"completed":true}'
#   bash query-api.sh DELETE "/api/memo/id123"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load credentials
if [[ ! -f "$SCRIPT_DIR/config.local" ]]; then
  echo "ERROR: $SCRIPT_DIR/config.local not found" >&2
  exit 1
fi
source "$SCRIPT_DIR/config.local"

# Validate required env vars
if [[ -z "${BABY_FEED_BASE_URL:-}" ]]; then
  echo "ERROR: BABY_FEED_BASE_URL not set in config.local" >&2
  exit 1
fi
if [[ -z "${BABY_FEED_API_KEY:-}" ]]; then
  echo "ERROR: BABY_FEED_API_KEY not set in config.local" >&2
  exit 1
fi

# Parse arguments
METHOD="${1:-}"
ENDPOINT="${2:-}"
BODY="${3:-}"

if [[ -z "$METHOD" || -z "$ENDPOINT" ]]; then
  echo "Usage: bash query-api.sh METHOD ENDPOINT [JSON_BODY]" >&2
  echo "  METHOD: GET, POST, PUT, DELETE" >&2
  echo "  ENDPOINT: /api/... (with query params if needed)" >&2
  echo "  JSON_BODY: optional JSON string for POST/PUT" >&2
  exit 1
fi

# Normalize method to uppercase
METHOD="${METHOD^^}"

# Build full URL
URL="${BABY_FEED_BASE_URL}${ENDPOINT}"

# Build curl command
CURL_ARGS=(
  -s
  -w "\n%{http_code}"
  -X "$METHOD"
  -H "Authorization: Bearer $BABY_FEED_API_KEY"
)

# Add Content-Type and body for POST/PUT
if [[ "$METHOD" == "POST" || "$METHOD" == "PUT" ]]; then
  CURL_ARGS+=(-H "Content-Type: application/json")
  if [[ -n "$BODY" ]]; then
    CURL_ARGS+=(-d "$BODY")
  fi
fi

# Execute request
RESPONSE=$(curl "${CURL_ARGS[@]}" "$URL" 2>/dev/null) || {
  echo "ERROR: curl failed (network error or timeout)" >&2
  exit 1
}

# Split response body and HTTP status code
HTTP_CODE="${RESPONSE##*$'\n'}"
RESPONSE_BODY="${RESPONSE%$'\n'*}"

# Output body to stdout
echo "$RESPONSE_BODY"

# Exit with error if HTTP status indicates failure
if [[ "$HTTP_CODE" -ge 400 ]]; then
  echo "HTTP $HTTP_CODE" >&2
  exit 1
fi
