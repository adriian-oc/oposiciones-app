"""
Migra QUIZ_DATA (extraído por extract_quiz_data.py a scripts/data/quiz_data.json) a Mongo.

Hallazgo clave al inspeccionar el contenido real (no solo su forma declarada): los
Cuadernillos (cuad_*) tienen la MISMA estructura anidada de casos/minisupuestos que
Supuestos Prácticos (gen) -- CLAUDE.md de ADOC ya lo documentaba ("Mini-supuesto
navigation... within a multi-caso cuadernillo"), así que ambos se migran a
`practical_sets` con `cases`, no a `questions` planas. La colección `questions` queda
para cuando se autore contenido de tipo test plano (ttesp_*/ttgen_*), que hoy no existe
en QUIZ_DATA.

Ids deterministas (uuid5) para que el script sea idempotente: rerun no duplica ni
huerfaniza nada.

Uso: cd backend && source venv/bin/activate && python ../scripts/migrate_quiz_data.py
"""
import json
import os
import re
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from config.database import connect_to_mongo, get_database  # noqa: E402

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
NAMESPACE = uuid.UUID("f4a1c9e0-6b3d-4e2a-9c1f-ad0c01234567")
MIGRATION_USER = "migration:adoc-import"

SUPUESTO_RE = re.compile(r"Supuesto\s+(\d+)")

# area_id (CONTENT_AREAS) -> part de themes (SPECIFIC/GENERAL) para content_units placeholder
COMING_SOON_AREAS = {
    "esq": "SPECIFIC",
    "tgen": "GENERAL",
    "ttesp": "SPECIFIC",
    "ttgen": "GENERAL",
}


def stable_id(*parts: str) -> str:
    return str(uuid.uuid5(NAMESPACE, "|".join(parts)))


def option_index(ops: list, letra: str) -> int:
    for i, op in enumerate(ops):
        if op.startswith(f"{letra})"):
            return i
    raise ValueError(f"No se encontró la opción '{letra})' en {ops}")


def convert_case(caso: dict) -> tuple[dict, list]:
    """Convierte un caso de QUIZ_DATA a (case_meta_sin_posiciones, lista_de_preguntas_planas)."""
    questions = []
    for q in caso["qs"]:
        questions.append({
            "text": q["t"],
            "choices": q["ops"],
            "correct_answer": option_index(q["ops"], q["okL"]),
        })
    return {"title": caso["title"], "description": caso.get("desc", "")}, questions


def build_practical_set(db, ps_id: str, title: str, description: str, theme_ids: list, casos: list):
    all_questions = []
    cases = []
    position = 1
    for case_order, caso in enumerate(casos, start=1):
        case_meta, case_questions = convert_case(caso)
        start_position = position
        for q in case_questions:
            all_questions.append({
                "id": stable_id(ps_id, str(position)),
                "position": position,
                **q,
            })
            position += 1
        cases.append({
            "position": case_order,
            "title": case_meta["title"],
            "description": case_meta["description"],
            "question_positions": list(range(start_position, position)),
        })

    doc = {
        "id": ps_id,
        "title": title,
        "description": description,
        "theme_ids": theme_ids,
        "questions": all_questions,
        "cases": cases,
        "created_by": MIGRATION_USER,
        "is_active": True,
    }
    existing = db.practical_sets.find_one({"id": ps_id})
    if existing:
        db.practical_sets.update_one({"id": ps_id}, {"$set": doc})
    else:
        from datetime import datetime
        doc["created_at"] = datetime.utcnow()
        db.practical_sets.insert_one(doc)
    return len(all_questions)


def migrate_gen(db, quiz_data: dict) -> int:
    """Supuestos Prácticos: agrupa los 217 casos por número de supuesto (kind:'numbered' en
    ADOC, calculado hoy en cada render vía getGenSupNums; aquí se calcula una sola vez)."""
    casos = quiz_data.get("gen", {}).get("casos", [])
    by_supuesto: dict[str, list] = {}
    for caso in casos:
        m = SUPUESTO_RE.search(caso["title"])
        if not m:
            print(f"  AVISO: no se pudo extraer número de supuesto de: {caso['title']!r}, se omite")
            continue
        by_supuesto.setdefault(m.group(1), []).append(caso)

    total_q = 0
    for num, sup_casos in sorted(by_supuesto.items(), key=lambda kv: int(kv[0])):
        ps_id = stable_id("gen", num)
        n = build_practical_set(
            db, ps_id,
            title=f"Supuesto {num}",
            description=f"Supuesto Práctico {num} ({len(sup_casos)} minisupuestos)",
            theme_ids=[],  # "gen" es kind:'numbered', no está ligado a un tema SPECIFIC/GENERAL
            casos=sup_casos,
        )
        total_q += n
    print(f"gen: {len(by_supuesto)} supuestos -> practical_sets, {total_q} preguntas")
    return len(by_supuesto)


def migrate_cuadernillos(db, quiz_data: dict, theme_by_code: dict) -> tuple[int, list]:
    """Cada cuad_<tema_key> ya viene pre-agrupado por tema en QUIZ_DATA; se migra 1:1 a un
    practical_set con sus propios casos, sin más agrupación necesaria."""
    migrated_tema_keys = []
    total_q = 0
    count = 0
    for key, entry in quiz_data.items():
        if key == "gen" or not key.startswith("cuad_"):
            continue
        tema_key = key[len("cuad_"):]
        theme_code = f"SPECIFIC_{tema_key}"
        theme = theme_by_code.get(theme_code)
        if not theme:
            print(f"  AVISO: {key} no tiene tema {theme_code} en la colección themes, se omite")
            continue

        ps_id = stable_id("cuad", tema_key)
        n = build_practical_set(
            db, ps_id,
            title=f"Cuadernillo — {theme['name']}",
            description=f"Cuadernillo de ejercicios del tema {tema_key}",
            theme_ids=[theme["id"]],
            casos=entry.get("casos", []),
        )
        total_q += n
        count += 1
        migrated_tema_keys.append(tema_key)
    print(f"cuad_*: {count} cuadernillos migrados -> practical_sets, {total_q} preguntas")
    return count, migrated_tema_keys


def seed_content_units(db, theme_by_code: dict, area_pdfs: dict, migrated_cuad_temas: list):
    db.content_units.delete_many({})
    units = []

    # tesp: PDF descargable (AREA_PDFS)
    for theme_code, theme in theme_by_code.items():
        if not theme_code.startswith("SPECIFIC_"):
            continue
        tema_key = theme_code[len("SPECIFIC_"):]
        pdf_key = f"tesp_{tema_key}"
        if pdf_key in area_pdfs:
            units.append({
                "id": stable_id("content_unit", "tesp", tema_key),
                "area_id": "tesp", "theme_id": theme["id"],
                "kind": "pdf", "pdf_url": f"/{area_pdfs[pdf_key]}", "order": theme["order"],
            })
        else:
            units.append({
                "id": stable_id("content_unit", "tesp", tema_key),
                "area_id": "tesp", "theme_id": theme["id"],
                "kind": "coming_soon", "pdf_url": None, "order": theme["order"],
            })

    # cuad: para los temas SPECIFIC sin cuadernillo migrado (p.ej. cuad_1, cuad_13 no
    # existen todavía en QUIZ_DATA), placeholder "Próximamente"
    for theme_code, theme in theme_by_code.items():
        if not theme_code.startswith("SPECIFIC_"):
            continue
        tema_key = theme_code[len("SPECIFIC_"):]
        if tema_key not in migrated_cuad_temas:
            units.append({
                "id": stable_id("content_unit", "cuad", tema_key),
                "area_id": "cuad", "theme_id": theme["id"],
                "kind": "coming_soon", "pdf_url": None, "order": theme["order"],
            })

    # esq/tgen/ttesp/ttgen: sin contenido en QUIZ_DATA ni AREA_PDFS todavía -> "Próximamente"
    # para todos los temas de la parte correspondiente
    for area_id, part in COMING_SOON_AREAS.items():
        for theme_code, theme in theme_by_code.items():
            if not theme_code.startswith(f"{part}_"):
                continue
            tema_key = theme_code[len(part) + 1:]
            units.append({
                "id": stable_id("content_unit", area_id, tema_key),
                "area_id": area_id, "theme_id": theme["id"],
                "kind": "coming_soon", "pdf_url": None, "order": theme["order"],
            })

    if units:
        db.content_units.insert_many(units)
    print(f"content_units: {len(units)} unidades sembradas (pdf + próximamente)")


def main():
    connect_to_mongo()
    db = get_database()

    with open(os.path.join(DATA_DIR, "quiz_data.json"), encoding="utf-8") as f:
        quiz_data = json.load(f)
    with open(os.path.join(DATA_DIR, "area_pdfs.json"), encoding="utf-8") as f:
        area_pdfs = json.load(f)

    themes = list(db.themes.find({}, {"_id": 0}))
    if not themes:
        print("ERROR: la colección 'themes' está vacía -- arranca el backend una vez "
              "para que se siembren los temas reales de ADOC antes de migrar preguntas.")
        sys.exit(1)
    theme_by_code = {t["code"]: t for t in themes}

    db.practical_sets.delete_many({"created_by": MIGRATION_USER})

    migrate_gen(db, quiz_data)
    _, migrated_cuad_temas = migrate_cuadernillos(db, quiz_data, theme_by_code)
    seed_content_units(db, theme_by_code, area_pdfs, migrated_cuad_temas)


if __name__ == "__main__":
    main()
