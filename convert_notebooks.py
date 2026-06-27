"""Convert project notebooks to dark themed HTML for the static file server."""

from __future__ import annotations

import html
import json
import re
import sys
import traceback
from pathlib import Path
from typing import Any

OUTPUT_DIR = Path("static/notebooks")

NOTEBOOKS = [
    "data_preparation.ipynb",
    "pipeline.ipynb",
    "prediction_model.ipynb",
    "external_enrichment/scb_enrichment.ipynb",
]

BANNER = "MYH Data Pipeline · Notebook source and outputs"

DARK_THEME_CSS = """
<style>
:root {
  color-scheme: dark;
  --bg: #0f1923;
  --surface-1: #142231;
  --surface-2: #1a2b3b;
  --border: #2b4154;
  --text: #e6edf3;
  --muted: #9fb0bf;
  --primary: #5aa7ff;
  --success: #52d6a3;
  --warning: #f4c95d;
  --danger: #ff6b6b;
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  background: var(--bg) !important;
  color: var(--text) !important;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
body { padding: 28px; }
.notebook-banner {
  max-width: 1180px;
  margin: 0 auto 24px auto;
  padding: 18px 24px;
  border: 1px solid rgba(45, 212, 191, .36);
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(20,184,166,.32), rgba(15,25,35,.94) 55%, rgba(59,130,246,.25)),
    #0f1923;
  color: #e6fffb;
  font-weight: 800;
  letter-spacing: .04em;
  text-transform: uppercase;
  box-shadow: 0 18px 60px -32px #2dd4bf;
}
.notebook {
  max-width: 1180px;
  margin: 0 auto;
}
.cell {
  margin: 18px 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-1);
}
.markdown-cell {
  padding: 20px 24px;
}
.code-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
  padding: 8px 14px;
  color: var(--muted);
  font: 12px/1.4 "JetBrains Mono", Consolas, monospace;
}
pre {
  margin: 0;
  overflow-x: auto;
  padding: 18px;
  background: #0b121b;
  color: var(--text);
  font: 12px/1.65 "JetBrains Mono", Consolas, monospace;
}
code { color: #b6e0ff; }
hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 28px 0 18px;
}
h1, h2, h3 { color: var(--text); line-height: 1.18; }
h1 { font-size: 32px; }
h2 { margin-top: 26px; font-size: 24px; }
h3 { margin-top: 22px; font-size: 18px; }
p, li { color: var(--muted); line-height: 1.72; }
a { color: var(--primary); }
table {
  width: 100%;
  border-collapse: collapse;
  color: var(--text);
}
th, td {
  border: 1px solid var(--border);
  padding: 7px 9px;
  vertical-align: top;
}
th { background: var(--surface-2); }
tr:nth-child(even) td { background: rgba(255,255,255,.025); }
.output {
  border-top: 1px solid var(--border);
  background: #111d2a;
  overflow-x: auto;
}
.output-scroll {
  overflow-x: auto;
  max-width: 100%;
}
.output pre {
  background: #111d2a;
  color: #d4e5f5;
}
.status-ok { color: var(--success); }
.status-warning { color: var(--warning); }
.status-error { color: var(--danger); }
/* Pygments Monokai output */
div.highlight { margin: 0; }
div.highlight pre {
  margin: 0 !important;
  padding: 18px !important;
  overflow-x: auto !important;
  font: 12px/1.65 "JetBrains Mono", Consolas, monospace !important;
  border-radius: 0 !important;
}
</style>
"""


def read_notebook(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def inline_markup(text: str) -> str:
    result = html.escape(text)
    result = re.sub(r"\*\*\*(.+?)\*\*\*", r"<strong><em>\1</em></strong>", result)
    result = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", result)
    result = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<em>\1</em>", result)
    result = re.sub(
        r"\[([^\]]+)\]\(([^)]+)\)",
        r'<a href="\2" target="_blank" rel="noreferrer">\1</a>',
        result,
    )
    result = re.sub(r"`([^`]+)`", r"<code>\1</code>", result)
    return result


def _parse_table_cells(row: str) -> list[str]:
    row = row.strip().strip("|")
    return [c.strip() for c in row.split("|")]


def _is_separator_row(cells: list[str]) -> bool:
    return bool(cells) and all(re.match(r"^:?-+:?$", c) for c in cells if c)


def markdown_to_html(source: str) -> str:
    # HTML block passthrough — render <div>, <p> etc. directly.
    if source.strip().startswith("<"):
        return source.strip()

    lines = source.splitlines()
    rendered: list[str] = []
    list_open = False
    table_rows: list[list[str]] = []

    def flush_table() -> None:
        if not table_rows:
            return
        sep = next((i for i, r in enumerate(table_rows) if _is_separator_row(r)), 1)
        header = table_rows[0]
        body = table_rows[sep + 1 :]
        thead = (
            "<tr>" + "".join(f"<th>{inline_markup(c)}</th>" for c in header) + "</tr>"
        )
        tbody = "".join(
            "<tr>" + "".join(f"<td>{inline_markup(c)}</td>" for c in row) + "</tr>"
            for row in body
        )
        rendered.append(f"<table><thead>{thead}</thead><tbody>{tbody}</tbody></table>")
        table_rows.clear()

    for line in lines:
        stripped = line.strip()
        if not stripped:
            flush_table()
            if list_open:
                rendered.append("</ul>")
                list_open = False
            continue

        if stripped.startswith("|"):
            if list_open:
                rendered.append("</ul>")
                list_open = False
            table_rows.append(_parse_table_cells(stripped))
            continue

        flush_table()

        if stripped in ("---", "***", "___"):
            if list_open:
                rendered.append("</ul>")
                list_open = False
            rendered.append("<hr>")
            continue

        if stripped.startswith("<"):
            if list_open:
                rendered.append("</ul>")
                list_open = False
            rendered.append(stripped)
            continue

        if stripped.startswith("#"):
            if list_open:
                rendered.append("</ul>")
                list_open = False
            level = min(len(stripped) - len(stripped.lstrip("#")), 3)
            text = stripped[level:].strip()
            rendered.append(f"<h{level}>{inline_markup(text)}</h{level}>")
            continue

        if stripped.startswith("- "):
            if not list_open:
                rendered.append("<ul>")
                list_open = True
            rendered.append(f"<li>{inline_markup(stripped[2:])}</li>")
            continue

        if list_open:
            rendered.append("</ul>")
            list_open = False
        rendered.append(f"<p>{inline_markup(stripped)}</p>")

    flush_table()
    if list_open:
        rendered.append("</ul>")

    return "\n".join(rendered)


def highlight_code(source: str) -> str:
    """Syntax-highlight Python with Pygments Monokai; fall back to plain pre."""
    try:
        from pygments import highlight  # type: ignore[import]
        from pygments.formatters import HtmlFormatter  # type: ignore[import]
        from pygments.lexers import PythonLexer  # type: ignore[import]

        formatter = HtmlFormatter(style="monokai", noclasses=True)
        return highlight(source, PythonLexer(), formatter)
    except Exception:
        return f"<pre>{html.escape(source)}</pre>"


def output_to_html(output: dict[str, Any]) -> str:
    if "text" in output:
        return f"<pre>{html.escape(join_source(output['text']))}</pre>"

    data = output.get("data", {})
    if "image/png" in data:
        b64 = join_source(data["image/png"]).strip()
        return f'<div class="output-image"><img src="data:image/png;base64,{b64}" style="max-width:100%;border-radius:8px;background:#111d2a;padding:8px" /></div>'
    if "text/html" in data:
        return f'<div class="output-scroll">{join_source(data["text/html"])}</div>'
    if "text/plain" in data:
        return f"<pre>{html.escape(join_source(data['text/plain']))}</pre>"

    if "ename" in output:
        message = f"{output.get('ename', '')}: {output.get('evalue', '')}"
        return f'<pre class="status-error">{html.escape(message)}</pre>'

    return ""


def join_source(value: str | list[str]) -> str:
    return "".join(value) if isinstance(value, list) else value


def fallback_html(notebook: dict[str, Any], title: str) -> str:
    cells: list[str] = []
    code_number = 0

    for cell in notebook.get("cells", []):
        source = join_source(cell.get("source", ""))
        if cell.get("cell_type") == "markdown":
            cells.append(
                f'<section class="cell markdown-cell">{markdown_to_html(source)}</section>'
            )
            continue

        if cell.get("cell_type") == "code":
            code_number += 1
            outputs = "".join(
                output_to_html(output) for output in cell.get("outputs", [])
            )
            output_block = f'<div class="output">{outputs}</div>' if outputs else ""
            cells.append(
                '<section class="cell">'
                f'<div class="code-header"><span>Code cell {code_number}</span><span>{title}</span></div>'
                f"{highlight_code(source)}"
                f"{output_block}"
                "</section>"
            )

    return (
        '<!doctype html><html><head><meta charset="utf-8">'
        f"<title>{html.escape(title)}</title>{DARK_THEME_CSS}</head><body>"
        f'<div class="notebook-banner">{html.escape(BANNER)}</div>'
        f'<main class="notebook">{"".join(cells)}</main>'
        "</body></html>"
    )


def convert_notebook(notebook_name: str) -> None:
    notebook_path = Path(notebook_name)
    output_path = OUTPUT_DIR / f"{notebook_path.stem}.html"

    try:
        body = fallback_html(read_notebook(notebook_path), notebook_path.stem)
        output_path.write_text(body, encoding="utf-8")
        print(f"  {notebook_name} -> {output_path} ({len(body) // 1024} KB)")
    except Exception:
        print(f"  ERROR: failed to convert {notebook_name}")
        traceback.print_exc()
        raise


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    failures: list[str] = []
    for notebook_name in NOTEBOOKS:
        try:
            convert_notebook(notebook_name)
        except Exception:
            failures.append(notebook_name)

    if failures:
        print(f"\nFailed to convert: {failures}", file=sys.stderr)
        return 1
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
