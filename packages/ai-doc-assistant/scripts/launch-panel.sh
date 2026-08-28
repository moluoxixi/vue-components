#!/usr/bin/env bash
# 本地体验面板启动脚本：从 .env.local 读取显式 AI_DOC_* 配置后启动 dev-server。
# 凭证仅在进程内存中流转，不回显。
set -euo pipefail

ROOT="/d/project-new/vue-component"
cd "$ROOT/packages/ai-doc-assistant"

set -a
# shellcheck disable=SC1091
. "$ROOT/.env.local"
set +a

exec node scripts/dev-server.mjs --port 5180 --host 127.0.0.1
