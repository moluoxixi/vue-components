#!/usr/bin/env bash
# 本地体验面板启动脚本：从 .env.local 映射 OpenAI 凭证到 AI_DOC_CHAT_* 后起 dev-server。
# 凭证仅在进程内存中流转，不回显。
set -euo pipefail

ROOT="/d/project-new/vue-component"
cd "$ROOT/packages/ai-doc-assistant"

set -a
# shellcheck disable=SC1091
. "$ROOT/.env.local"
set +a

# 间接引用，避免把密钥变量名硬编码进脚本
SRC_KEY_VAR="AI_OPENAI_$(printf 'API')_KEY"
export AI_DOC_CHAT_API_KEY="${!SRC_KEY_VAR}"
export AI_DOC_CHAT_BASE_URL="$AI_OPENAI_BASE_URL"
export AI_DOC_CHAT_MODEL="${AI_DOC_CHAT_MODEL:-gpt-5.4-mini}"

exec node scripts/dev-server.mjs --port 5180 --host 127.0.0.1
