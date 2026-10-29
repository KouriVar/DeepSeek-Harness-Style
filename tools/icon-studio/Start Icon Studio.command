#!/bin/zsh
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")" || exit 1
if [[ ! -f .local/data/index-version.json ]]; then
  node index.mjs || exit 1
fi
node service.mjs start --open
