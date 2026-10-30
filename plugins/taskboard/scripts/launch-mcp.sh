#!/bin/sh
set -eu
PATH="${PATH}:/opt/homebrew/bin:/usr/local/bin"
export PATH

exec "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" "$@"
