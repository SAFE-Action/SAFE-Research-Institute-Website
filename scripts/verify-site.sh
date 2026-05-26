#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

failures=0

fail() {
  echo "ERROR: $*" >&2
  failures=$((failures + 1))
}

check_html_shape() {
  local file="$1"

  grep -qi '<!doctype html>' "$file" || fail "$file is missing <!DOCTYPE html>"
  grep -qi '<html' "$file" || fail "$file is missing <html>"
  grep -qi '<head' "$file" || fail "$file is missing <head>"
  grep -qi '<body' "$file" || fail "$file is missing <body>"
  grep -qi '</html>' "$file" || fail "$file is missing </html>"
}

check_local_links() {
  local file="$1"
  local base_dir target clean_target

  base_dir="$(dirname "$file")"

  while IFS= read -r target; do
    clean_target="${target%%#*}"
    clean_target="${clean_target%%\?*}"

    case "$clean_target" in
      ""|"#"|http://*|https://*|mailto:*|tel:*|javascript:*|data:*|//*)
        continue
        ;;
    esac

    if [[ "$clean_target" = /* ]]; then
      clean_target=".$clean_target"
    else
      clean_target="$base_dir/$clean_target"
    fi

    [[ -e "$clean_target" ]] || fail "$file references missing local asset/link: $target"
  done < <(grep -Eoh '(href|src)="[^"]+"' "$file" | sed -E 's/^(href|src)="([^"]+)"/\2/')
}

check_pending_status_language() {
  local file="$1"

  if grep -Eqi 'is a California 501\(c\)\(3\) non-?profit organization|operates as a California-based 501\(c\)\(3\)' "$file"; then
    fail "$file appears to state confirmed 501(c)(3) status; use application-pending language until determination is received"
  fi

  if grep -Eqi 'donations are tax-deductible|tax deductible' "$file"; then
    fail "$file appears to state donations are tax-deductible while determination is pending"
  fi
}

while IFS= read -r file; do
  check_html_shape "$file"
  check_local_links "$file"
  check_pending_status_language "$file"
done < <(find . -path './.git' -prune -o -name '*.html' -print | sort)

if [[ "$failures" -gt 0 ]]; then
  echo "Site verification failed with $failures issue(s)." >&2
  exit 1
fi

echo "Site verification passed."
