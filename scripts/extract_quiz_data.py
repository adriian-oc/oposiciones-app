"""
Extrae QUIZ_DATA, AREA_PDFS y CONTENT_AREAS del index.html de adoc-webapp a JSON planos,
para que migrate_quiz_data.py (Fase 2) no tenga que tocar el HTML de producción.

Uso:
    python3 scripts/extract_quiz_data.py [ruta_a_index.html] [dir_salida]

Por defecto lee /Users/adrian/Desktop/Adoc/webapp/index.html (solo lectura, nunca escribe ahí)
y escribe en scripts/data/.
"""
import json
import re
import sys
from pathlib import Path


def find_const_object(src: str, const_name: str) -> str:
    """Localiza `const NAME = { ... };` o `NAME = { ... };` por brace-matching
    (regex simple rompe con el JSON embebido, como documenta CLAUDE.md de ADOC)."""
    m = re.search(rf"\b{const_name}\s*=\s*\{{", src)
    if not m:
        raise ValueError(f"No se encontró la declaración de {const_name}")
    start = m.end() - 1  # posición de la '{' de apertura
    depth = 0
    in_string = False
    string_char = ""
    escaped = False
    for i in range(start, len(src)):
        c = src[i]
        if in_string:
            if escaped:
                escaped = False
            elif c == "\\":
                escaped = True
            elif c == string_char:
                in_string = False
            continue
        if c in ("'", '"'):
            in_string = True
            string_char = c
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return src[start:i + 1]
    raise ValueError(f"Llaves desbalanceadas buscando {const_name}")


def find_const_array(src: str, const_name: str) -> str:
    """Igual que find_const_object pero para `const NAME = [ ... ];`."""
    m = re.search(rf"\b{const_name}\s*=\s*\[", src)
    if not m:
        raise ValueError(f"No se encontró la declaración de {const_name}")
    start = m.end() - 1
    depth = 0
    in_string = False
    string_char = ""
    escaped = False
    for i in range(start, len(src)):
        c = src[i]
        if in_string:
            if escaped:
                escaped = False
            elif c == "\\":
                escaped = True
            elif c == string_char:
                in_string = False
            continue
        if c in ("'", '"'):
            in_string = True
            string_char = c
            continue
        if c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                return src[start:i + 1]
    raise ValueError(f"Corchetes desbalanceados buscando {const_name}")


def main():
    src_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/Users/adrian/Desktop/Adoc/webapp/index.html")
    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).parent / "data"
    out_dir.mkdir(parents=True, exist_ok=True)

    src = src_path.read_text(encoding="utf-8")

    quiz_data_raw = find_const_object(src, "QUIZ_DATA")
    quiz_data = json.loads(quiz_data_raw)
    (out_dir / "quiz_data.json").write_text(
        json.dumps(quiz_data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"QUIZ_DATA: {len(quiz_data)} temas -> {out_dir / 'quiz_data.json'}")

    area_pdfs_raw = find_const_object(src, "AREA_PDFS")
    area_pdfs_normalized = re.sub(r"(?<=[{,\s])([A-Za-z_][A-Za-z0-9_]*)\s*:", r'"\1":', area_pdfs_raw)
    area_pdfs_normalized = area_pdfs_normalized.replace("'", '"')
    area_pdfs = json.loads(area_pdfs_normalized)
    (out_dir / "area_pdfs.json").write_text(
        json.dumps(area_pdfs, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"AREA_PDFS: {len(area_pdfs)} entradas -> {out_dir / 'area_pdfs.json'}")

    content_areas_raw = find_const_array(src, "CONTENT_AREAS")
    # CONTENT_AREAS es JS, no JSON puro (claves sin comillas) -> normalizar antes de json.loads
    normalized = re.sub(r"(?<=[{,\s])([A-Za-z_][A-Za-z0-9_]*)\s*:", r'"\1":', content_areas_raw)
    normalized = normalized.replace("'", '"')
    try:
        content_areas = json.loads(normalized)
        (out_dir / "content_areas.json").write_text(
            json.dumps(content_areas, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"CONTENT_AREAS: {len(content_areas)} áreas -> {out_dir / 'content_areas.json'}")
    except json.JSONDecodeError as e:
        # CONTENT_AREAS puede contener funciones/expresiones JS que no son JSON válido;
        # en ese caso se deja el .js crudo para inspección manual en vez de fallar todo el script.
        (out_dir / "content_areas.raw.js").write_text(content_areas_raw, encoding="utf-8")
        print(f"CONTENT_AREAS no es JSON puro ({e}); volcado crudo en content_areas.raw.js para revisión manual")


if __name__ == "__main__":
    main()
