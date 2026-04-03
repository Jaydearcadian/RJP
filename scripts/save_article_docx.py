#!/usr/bin/env python3
"""
Create a minimal .docx article from a markdown-like plain text source.
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import zipfile
from pathlib import Path


CONTENT_TYPES_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"""

RELS_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"""

APP_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
            xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex</Application>
</Properties>
"""


def xml_escape(value: str) -> str:
    return html.escape(value, quote=False)


def paragraph_xml(text: str, *, bold: bool = False) -> str:
    escaped = xml_escape(text)
    if not escaped:
        return "<w:p/>"
    bold_xml = "<w:rPr><w:b/></w:rPr>" if bold else ""
    return (
        "<w:p><w:r>"
        f"{bold_xml}"
        "<w:t xml:space=\"preserve\">"
        f"{escaped}"
        "</w:t></w:r></w:p>"
    )


def build_document_xml(title: str, body: str) -> str:
    paragraphs = [paragraph_xml(title, bold=True), paragraph_xml("")]
    for raw_line in body.splitlines():
        stripped = raw_line.strip()
        if raw_line.startswith("# "):
            paragraphs.append(paragraph_xml(raw_line[2:].strip(), bold=True))
        elif raw_line.startswith("## "):
            paragraphs.append(paragraph_xml(raw_line[3:].strip(), bold=True))
        elif raw_line.startswith("- "):
            paragraphs.append(paragraph_xml(f"• {raw_line[2:]}"))
        elif stripped == "":
            paragraphs.append(paragraph_xml(""))
        else:
            paragraphs.append(paragraph_xml(raw_line))
    body_xml = "".join(paragraphs)
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
 xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
 xmlns:v="urn:schemas-microsoft-com:vml"
 xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:w10="urn:schemas-microsoft-com:office:word"
 xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
 xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
 xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
 xmlns:wne="http://schemas.microsoft.com/office/2006/wordml"
 xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
 mc:Ignorable="w14 wp14">
  <w:body>
    {body_xml}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>
"""


def build_core_xml(title: str) -> str:
    created = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:dcmitype="http://purl.org/dc/dcmitype/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>{xml_escape(title)}</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{created}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{created}</dcterms:modified>
</cp:coreProperties>
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Save an article as a .docx file.")
    parser.add_argument("--title", required=True)
    parser.add_argument("--source", required=True, help="Path to the article source text file")
    parser.add_argument("--out", required=True, help="Output .docx path")
    args = parser.parse_args()

    source_path = Path(args.source)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    body = source_path.read_text()
    document_xml = build_document_xml(args.title, body)
    core_xml = build_core_xml(args.title)

    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", CONTENT_TYPES_XML)
        docx.writestr("_rels/.rels", RELS_XML)
        docx.writestr("docProps/app.xml", APP_XML)
        docx.writestr("docProps/core.xml", core_xml)
        docx.writestr("word/document.xml", document_xml)

    print(out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
