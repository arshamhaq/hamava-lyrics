#!/usr/bin/env bash
# Interactive deployment without OAuth. Credentials live only in this process.
set +x
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

if [[ ! -t 0 ]]; then
  printf '%s\n' 'Run npm run deploy:token in your interactive VS Code terminal.' >&2
  exit 1
fi

# Finish the frontend build before requesting deployment credentials.
npm run build

read -r -p 'Cloudflare Account ID: ' hamava_account_id
if [[ ! "$hamava_account_id" =~ ^[a-fA-F0-9]{32}$ ]]; then
  printf '%s\n' 'Expected the 32-character Cloudflare Account ID.' >&2
  exit 1
fi

read -r -s -p 'Cloudflare deployment API token (hidden): ' hamava_deploy_token
printf '\n'
if [[ -z "$hamava_deploy_token" || "$hamava_deploy_token" =~ [[:space:]] ]]; then
  printf '%s\n' 'The token must be non-empty and contain no whitespace.' >&2
  exit 1
fi
trap 'unset hamava_deploy_token' EXIT

CLOUDFLARE_ACCOUNT_ID="$hamava_account_id" \
CLOUDFLARE_API_TOKEN="$hamava_deploy_token" \
  ./node_modules/.bin/wrangler deploy "$@"
