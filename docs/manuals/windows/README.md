# Windows one-command setup — user manuals

Printable manuals (run guide + troubleshooting + FAQ) for `scripts/windows/start-windows.bat`:

| Language | Source | PDF |
|----------|--------|-----|
| English | [`windows-setup-manual-en.html`](windows-setup-manual-en.html) | [`helios-windows-setup-manual-en.pdf`](helios-windows-setup-manual-en.pdf) |
| Polski | [`windows-setup-manual-pl.html`](windows-setup-manual-pl.html) | [`helios-windows-setup-manual-pl.pdf`](helios-windows-setup-manual-pl.pdf) |

The HTML files are the editable sources (self-contained, print-styled for A4).
Regenerate a PDF with headless Chrome:

```
chrome --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=helios-windows-setup-manual-en.pdf windows-setup-manual-en.html
```

Keep the manuals in sync with `scripts/windows/start-dev.ps1` and the spec
`.ai/specs/2026-07-07-windows-one-command-agentic-dev-environment.md`.
