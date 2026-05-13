#!/usr/bin/env bash
set -euo pipefail
base_url="${1:-http://localhost:8788}"
check(){
  local path="$1"; local expected="$2";
  local code
  code=$(curl -s -o /tmp/wiki_smoke_resp -w '%{http_code}' "$base_url$path")
  echo "$path -> $code"
  if [[ "$code" != "$expected" ]]; then
    echo "Expected $expected for $path, got $code" >&2
    exit 1
  fi
}

check "/" "200"
check "/admin/login" "308"
check "/api/settings/public" "200"
check "/docs/getting-started" "200"
check "/robots.txt" "200"
check "/sitemap.xml" "200"
check "/docs/getting-started-old" "301"
check "/docs/not-found-slug" "404"
