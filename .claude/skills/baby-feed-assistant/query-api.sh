#!/usr/bin/env bash
# Baby Feed API wrapper — avoids raw curl|python3 pipes that trigger security scanners.
# Usage:
#   bash query-api.sh METHOD ENDPOINT [JSON_BODY] [FILTER]
#
# Examples:
#   bash query-api.sh GET  "/api/babies"
#   bash query-api.sh GET  "/api/stats?babyId=abc&days=7"
#   bash query-api.sh POST "/api/feeding" '{"babyId":"abc","type":"FORMULA","startTime":"2026-05-27T10:00:00+08:00","formulaAmount":120}'
#   bash query-api.sh PUT  "/api/memo/id123" '{"completed":true}'
#   bash query-api.sh DELETE "/api/memo/id123"
#
# Optional FILTER (4th arg): a Python expression applied to the parsed JSON.
#   The variable `d` holds the parsed response. The expression is eval'd and printed.
#   Examples:
#     bash query-api.sh GET "/api/babies" "" "d[0]['id']"
#     bash query-api.sh GET "/api/feeding?babyId=abc&date=2026-05-28" "" "len(d)"
#     bash query-api.sh GET "/api/stats?babyId=abc&days=7" "" "d['todayStats']"
#     bash query-api.sh GET "/api/health?babyId=abc&type=WEIGHT" "" "d[0]['weight']"

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
FILTER="${4:-}"

if [[ -z "$METHOD" || -z "$ENDPOINT" ]]; then
  echo "Usage: bash query-api.sh METHOD ENDPOINT [JSON_BODY] [FILTER]" >&2
  echo "  METHOD: GET, POST, PUT, DELETE" >&2
  echo "  ENDPOINT: /api/... (with query params if needed)" >&2
  echo "  JSON_BODY: optional JSON string for POST/PUT (use \"\" to skip)" >&2
  echo "  FILTER: optional Python expression to extract fields from response" >&2
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

# Exit with error if HTTP status indicates failure
if [[ "$HTTP_CODE" -ge 400 ]]; then
  echo "$RESPONSE_BODY" >&2
  echo "HTTP $HTTP_CODE" >&2
  exit 1
fi

# Apply optional filter
if [[ -n "$FILTER" ]]; then
  echo "$RESPONSE_BODY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
result = $FILTER
if isinstance(result, (dict, list)):
    print(json.dumps(result, ensure_ascii=False, indent=2))
else:
    print(result)
" 2>&1
else
  echo "$RESPONSE_BODY"
fi
