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

hamava_deploy_token=''
trap 'unset hamava_deploy_token hamava_token_char' EXIT
printf '%s' 'Cloudflare deployment API token (masked): '
while IFS= read -r -s -n 1 hamava_token_char; do
  case "$hamava_token_char" in
    '') break ;;
    $'\x7f'|$'\b')
      if [[ -n "$hamava_deploy_token" ]]; then
        hamava_deploy_token="${hamava_deploy_token%?}"
        printf '\b \b'
      fi
      ;;
    $'\x15')
      while [[ -n "$hamava_deploy_token" ]]; do
        hamava_deploy_token="${hamava_deploy_token%?}"
        printf '\b \b'
      done
      ;;
    $'\x04') printf '\n'; exit 1 ;;
    *) hamava_deploy_token+="$hamava_token_char"; printf '*' ;;
  esac
done
unset hamava_token_char
printf '\n'
if [[ -z "$hamava_deploy_token" || "$hamava_deploy_token" =~ [[:space:]] ]]; then
  printf '%s\n' 'The token must be non-empty and contain no whitespace.' >&2
  exit 1
fi

CLOUDFLARE_ACCOUNT_ID="$hamava_account_id" \
CLOUDFLARE_API_TOKEN="$hamava_deploy_token" \
  ./node_modules/.bin/wrangler deploy "$@"
