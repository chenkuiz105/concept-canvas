#!/usr/bin/env python3
"""Build the standalone site (docs/index.html) from the Claude artifact page.

The artifact page (artifact/concept-cards.html) is the single source of truth.
This wraps it in a full HTML document and loads docs/claude-shim.js before the
app script, so the same code runs on GitHub Pages with your own API key.

Usage: python3 scripts/build.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "artifact" / "concept-cards.html"
OUT = ROOT / "docs" / "index.html"

# The Claude viewer wraps artifact pages in a skeleton with these basics; recreate it here.
HEAD = """<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="把任何資料拆成上下級分明、圖文並茂的知識畫布。">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
"""


def main() -> None:
    page = SRC.read_text(encoding="utf-8")
    page = page.removeprefix('<meta charset="utf-8">\n')
    marker = "\n<script>\n"
    if page.count(marker) != 1:
        raise SystemExit("找不到唯一的主程式 <script>，無法插入 claude-shim.js")
    page = page.replace(marker, '\n<script src="claude-shim.js"></script>' + marker)
    OUT.write_text(HEAD + page + "\n</body>\n</html>\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
