#!/bin/zsh
# Regenerates docs/deck/claim-sach-pitch.pdf from docs/deck/pitch.html with headless Chrome.
# Requires Google Chrome and the project's node_modules (for the Geist font). Run from anywhere.
# If pypdf is installed for python3, the document metadata is set as well.
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/claim-sach-pitch.pdf"
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
