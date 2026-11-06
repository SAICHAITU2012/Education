#!/usr/bin/env bash
# Restore a backup over the live data file (atomic tmp+rename).
# Usage: scripts/restore.sh backups/abhyas-20261106-210000.json [target]
set -euo pipefail

src="${1:?usage: scripts/restore.sh <backup.json> [target]}"
target="${2:-${DATA_FILE:-data/abhyas.json}}"

if [ ! -f "$src" ]; then
  echo "no such backup: $src" >&2
  exit 1
fi

# Sanity gate: never overwrite live data with an unparsable file.
node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$src"

tmp="$target.restore-tmp"
cp "$src" "$tmp"
mkdir -p "$(dirname "$target")"
mv "$tmp" "$target"
echo "restored $src → $target"
