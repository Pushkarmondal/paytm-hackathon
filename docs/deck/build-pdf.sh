#!/bin/zsh
# Rebuilds the pitch deck: docs/deck/pitch.html from build_deck.py, then claim-sach-pitch.pdf with headless Chrome.
# Requires Google Chrome, python3 and the project's node_modules (for the Geist font). With pypdf installed the
# document metadata is set as well. Screenshots: `npm run dev`, then `node shots/shot.mjs <dir> shots/scenarios.json`
# and `python3 shots/crops.py <dir> images/v3` (needs Pillow).
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/claim-sach-pitch.pdf"
python3 "$HERE/build_deck.py" "$HERE/pitch.html" "images/v3/" "../../node_modules/geist/dist/fonts/"
"$CHROME" --headless=new --disable-gpu --allow-file-access-from-files --no-pdf-header-footer \
  --generate-pdf-document-outline --print-to-pdf="$OUT" "file://$HERE/pitch.html"
if python3 -c "import pypdf" 2>/dev/null; then
  python3 - "$OUT" <<'PY'
import sys
from pypdf import PdfReader, PdfWriter
path = sys.argv[1]
w = PdfWriter(clone_from=PdfReader(path))
w.add_metadata({
    "/Title": "Claim Sach: Coverage Twin",
    "/Author": "Pushkar Mondal, Founding Engineer, Xeliport",
    "/Subject": "Pitch for the Paytm Build for India AI Hackathon, Bengaluru, 31 October 2026",
    "/Keywords": "health insurance, coverage simulator, Claim Sach, Coverage Twin",
})
with open(path, "wb") as f:
    w.write(f)
print("metadata set")
PY
fi
echo "written $OUT"
