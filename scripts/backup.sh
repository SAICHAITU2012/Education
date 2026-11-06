#!/usr/bin/env bash
# Timestamped backup of the Abhyas data file, keeping the newest KEEP copies.
# Usage: DATA_FILE=data/abhyas.json BACKUP_DIR=backups KEEP=14 scripts/backup.sh
set -euo pipefail

DATA_FILE="${DATA_FILE:-data/abhyas.json}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
KEEP="${KEEP:-14}"

if [ ! -f "$DATA_FILE" ]; then
  echo "no data file at $DATA_FILE — nothing to back up" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
# Sanity gate: refuse to archive a file that is not valid JSON.
node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$DATA_FILE"

dest="$BACKUP_DIR/abhyas-$(date +%Y%m%d-%H%M%S).json"
cp "$DATA_FILE" "$dest"
ls -1t "$BACKUP_DIR"/abhyas-*.json 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm --
echo "backed up $DATA_FILE → $dest"
