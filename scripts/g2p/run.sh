#!/usr/bin/env bash
set -euo pipefail
TASK_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TASK_ROOT="$(cd -- "$TASK_DIR/../.." && pwd)"
TASK_CACHE="$TASK_ROOT/research-private/g2p"
TASK_PY="$TASK_CACHE/venv/bin/python"
trap 'printf "\nStopped. Any completed results and downloads are kept in research-private/g2p. Rerun the same command after fixing the reported error.\n" >&2' ERR
mkdir -p "$TASK_CACHE"
if [[ ! -x "$TASK_PY" ]]; then
  python3 -m venv --without-pip "$TASK_CACHE/venv"
fi
if ! "$TASK_PY" -m pip --version >/dev/null 2>&1; then
  printf 'Preparing isolated Python environment (no sudo)...\n'
  python3 - "$TASK_CACHE/get-pip.py" <<'PY'
import sys,urllib.request
with urllib.request.urlopen('https://bootstrap.pypa.io/get-pip.py',timeout=60) as r:
    data=r.read()
with open(sys.argv[1],'wb') as f:f.write(data)
PY
  "$TASK_PY" "$TASK_CACHE/get-pip.py" --disable-pip-version-check
fi
if ! "$TASK_PY" -c 'import torch,transformers; assert torch.__version__.split("+")[0]=="2.10.0"; assert transformers.__version__=="4.57.6"' >/dev/null 2>&1; then
  printf 'Installing CPU-only PyTorch and Transformers. First setup downloads several hundred MB; these laptop tools are not shipped to phones.\n'
  "$TASK_PY" -m pip install --disable-pip-version-check --timeout 60 --retries 2 'torch==2.10.0' --index-url https://download.pytorch.org/whl/cpu
  "$TASK_PY" -m pip install --disable-pip-version-check --timeout 60 --retries 2 'transformers==4.57.6' 'huggingface-hub>=0.34,<1' 'safetensors>=0.4.3'
fi
export HF_HUB_DISABLE_IMPLICIT_TOKEN=1
export HF_HUB_DISABLE_XET=1
export TOKENIZERS_PARALLELISM=false
exec "$TASK_PY" -u "$TASK_DIR/benchmark.py" "$@"
