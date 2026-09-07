#!/usr/bin/env bash
set +x
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
if [[ ! -t 0 ]]; then
  printf '%s\n' 'Run npm run setup:live in your interactive VS Code terminal.' >&2
  exit 1
fi
npm run build
read -r -p 'Cloudflare Account ID: ' hamava_account_id
[[ "$hamava_account_id" =~ ^[a-fA-F0-9]{32}$ ]] || { printf '%s\n' 'Invalid account ID.' >&2; exit 1; }
printf '%s\n' 'Use the same deployment token secret after saving Account > D1 > Edit in its Cloudflare permissions.'
while true; do
  read -r -s -p 'Paste deployment token secret (not its ID; hidden): ' hamava_deploy_token
  printf '\n'
  # Ignore accidental surrounding whitespace without altering the secret itself.
  hamava_deploy_token="${hamava_deploy_token#"${hamava_deploy_token%%[![:space:]]*}"}"
  hamava_deploy_token="${hamava_deploy_token%"${hamava_deploy_token##*[![:space:]]}"}"
  if [[ -z "$hamava_deploy_token" ]]; then
    printf '%s\n' 'Nothing was pasted. Try again; the terminal will not show the token.' >&2
  elif [[ "$hamava_deploy_token" =~ [[:space:]] ]]; then
    printf '%s\n' 'The paste contains spaces inside it. Paste only the token secret, without quotes, Bearer, or a curl command.' >&2
  else
    break
  fi
done
read -r -s -p 'Choose the app test passphrase (16–256 characters, hidden): ' hamava_test_key
printf '\n'
[[ ${#hamava_test_key} -ge 16 && ${#hamava_test_key} -le 256 ]] || { printf '%s\n' 'Passphrase must have 16–256 characters.' >&2; exit 1; }
read -r -s -p 'Repeat the app test passphrase: ' hamava_test_confirm
printf '\n'
[[ "$hamava_test_key" == "$hamava_test_confirm" ]] || { printf '%s\n' 'Passphrases differ.' >&2; exit 1; }
trap 'unset CLOUDFLARE_API_TOKEN hamava_deploy_token hamava_test_key hamava_test_confirm' EXIT
export CLOUDFLARE_ACCOUNT_ID="$hamava_account_id"
export CLOUDFLARE_API_TOKEN="$hamava_deploy_token"
node scripts/prepare-database.mjs
CI=true ./node_modules/.bin/wrangler d1 migrations apply DB --remote
printf '%s' "$hamava_test_key" | ./node_modules/.bin/wrangler secret put TEST_ACCESS_KEY
unset hamava_test_key hamava_test_confirm
./node_modules/.bin/wrangler deploy
printf '%s\n' 'Open the deployed URL with /?live and enter your app test passphrase.'
