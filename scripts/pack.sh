#!/usr/bin/env bash
# Build dist/<name>.zip for one theme, or for all themes.
# Usage: scripts/pack.sh [theme-name ...]
# Each zip holds only the extension folders (the ones with extension.json).
# README.md, media/ and macOS junk are left out. File order is sorted.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
dist="$root/dist"
mkdir -p "$dist"

if [ "$#" -gt 0 ]; then
  names=("$@")
else
  names=()
  for dir in "$root"/themes/*/; do
    names+=("$(basename "$dir")")
  done
fi

for name in "${names[@]}"; do
  theme="$root/themes/$name"
  if [ ! -d "$theme" ]; then
    echo "error: no such theme: $name" >&2
    exit 1
  fi
  exts=()
  while IFS= read -r manifest; do
    exts+=("$(dirname "$manifest" | xargs basename)")
  done < <(find "$theme" -mindepth 2 -maxdepth 2 -name extension.json | LC_ALL=C sort)
  if [ "${#exts[@]}" -eq 0 ]; then
    echo "error: $name has no extension folders" >&2
    exit 1
  fi
  out="$dist/$name.zip"
  rm -f "$out"
  (
    cd "$theme"
    for ext in "${exts[@]}"; do
      find "$ext" -type f ! -name .DS_Store | LC_ALL=C sort
    done | zip -X -q "$out" -@
  )
  echo "built $out"
done
