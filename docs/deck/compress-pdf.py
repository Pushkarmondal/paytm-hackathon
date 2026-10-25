#!/usr/bin/env python3
"""Compresses the printed pitch PDF in place so it stays under the submission form's 2 MB limit.

Nothing is removed. Each embedded screenshot (JPEG) is downscaled to 70% of its 2x capture (still above the size it is
shown at) and re-encoded at quality 82 with 4:2:0 subsampling; page content streams are deflated; identical objects
are merged; the document metadata is set. Requires pypdf and Pillow.

usage: compress-pdf.py <in.pdf> [out.pdf] [--scale 0.7] [--quality 82]
"""
import os
import sys

from PIL import Image
from pypdf import PdfReader, PdfWriter

METADATA = {
    "/Title": "Claim Sach: Coverage Twin",
    "/Author": "Pushkar Mondal, Founding Engineer, Xeliport",
    "/Subject": "Pitch for the Paytm Build for India AI Hackathon, Bengaluru, 31 October 2026",
    "/Keywords": "health insurance, coverage simulator, Claim Sach, Coverage Twin",
}


def compress(src: str, out: str, scale: float = 0.7, quality: int = 82) -> int:
    writer = PdfWriter(clone_from=PdfReader(src))
    done: set[int] = set()
    for page in writer.pages:
        for img in page.images:
            ref = img.indirect_reference
            key = ref.idnum if ref is not None else id(img)
            if key in done:
                continue
            done.add(key)
            obj = ref.get_object() if ref is not None else None
            if obj is None or str(obj.get("/Filter")) != "/DCTDecode":
                continue
            pil = img.image.convert("RGB")
            if scale != 1.0:
                pil = pil.resize((round(pil.width * scale), round(pil.height * scale)), Image.LANCZOS)
            img.replace(pil, quality=quality, optimize=True, subsampling=2)
        page.compress_content_streams()
    writer.compress_identical_objects(remove_duplicates=True, remove_unreferenced=True)
    writer.add_metadata(METADATA)
    tmp = out + ".tmp"
    with open(tmp, "wb") as f:
        writer.write(f)
    os.replace(tmp, out)
    return os.path.getsize(out)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = {k: v for k, v in zip(sys.argv[1:], sys.argv[2:]) if k.startswith("--")}
    src = args[0]
    out = args[1] if len(args) > 1 else src
    size = compress(src, out, float(opts.get("--scale", 0.7)), int(opts.get("--quality", 82)))
    print(f"{out}: {size / 1e6:.2f} MB")
    if size > 2_000_000:
        print("WARNING: over 2 MB", file=sys.stderr)
        sys.exit(1)
