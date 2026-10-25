#!/bin/zsh
# Rebuilds the pitch deck: docs/deck/pitch.html from build_deck.py, claim-sach-pitch.pdf with headless Chrome, then
# compress-pdf.py shrinks the file in place (screenshots re-encoded, streams deflated, metadata set) to stay under the
# submission form's 2 MB limit. Requires Google Chrome, python3 with pypdf and Pillow, and the project's node_modules
# (for the Geist fonts). Screenshots: `npm run dev`, then `node shots/shot.mjs <dir> shots/scenarios.json` and
# `python3 shots/crops.py <dir> images/v3` (needs Pillow).
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/claim-sach-pitch.pdf"
python3 "$HERE/build_deck.py" "$HERE/pitch.html" "images/v3/" "../../node_modules/geist/dist/fonts/"
"$CHROME" --headless=new --disable-gpu --allow-file-access-from-files --no-pdf-header-footer \
  --generate-pdf-document-outline --print-to-pdf="$OUT" "file://$HERE/pitch.html"
python3 "$HERE/compress-pdf.py" "$OUT"
echo "written $OUT"
