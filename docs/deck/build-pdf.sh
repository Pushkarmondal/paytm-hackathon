#!/bin/zsh
# Regenerates docs/deck/claim-sach-pitch.pdf from docs/deck/pitch.html with headless Chrome.
# Requires Google Chrome and the project's node_modules (for the Geist font). Run from the repo root.
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE="$(cd "$(dirname "$0")" && pwd)"
"$CHROME" --headless=new --disable-gpu --allow-file-access-from-files --no-pdf-header-footer \
  --print-to-pdf="$HERE/claim-sach-pitch.pdf" "file://$HERE/pitch.html"
echo "written $HERE/claim-sach-pitch.pdf"
