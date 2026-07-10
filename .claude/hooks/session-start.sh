#!/bin/bash
# SessionStart hook: install npm dependencies so `npm test` (Vitest),
# `npm run lint` (eslint), and `npx tsc --noEmit` work in Claude Code on the
# web sessions — node_modules is not committed. Synchronous on purpose:
# guarantees deps exist before the agent runs anything. Idempotent; `npm
# install` benefits from the cached container state on subsequent sessions.
set -euo pipefail

# Web sessions only; local sessions manage their own node_modules.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
npm install --no-audit --no-fund
