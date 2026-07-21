"""
Corrige la respuesta correcta de preguntas de Test de Teoría (parte general, Temas 1-11,
tanda "Test Vanesa año 1") que se cargaron con un bug sistemático de desplazamiento de
índice (+1) al importarlas: cuando la respuesta correcta real era la opción a), b) o c),
quedó marcada la opción siguiente. Verificado pregunta por pregunta contra los PDF
oficiales -- ver /private/tmp/.../scratchpad/qa_review/report_tema_*.md de la sesión que
generó este script para el detalle completo de cada corrección.

Por seguridad, cada corrección comprueba que el valor actual en BD coincide con el valor
"old" esperado antes de tocarlo; si no coincide (por ejemplo porque alguien ya la corrigió
a mano, o los datos de producción difieren de los de desarrollo), se omite y se reporta
como conflicto en vez de sobrescribirla a ciegas.

Uso:
  Comprobar sin escribir nada:
    cd backend && source venv/bin/activate && python ../scripts/fix_general_theme_answers.py --dry-run

  Aplicar de verdad (development o production, según el .env activo):
    cd backend && source venv/bin/activate && python ../scripts/fix_general_theme_answers.py
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from datetime import datetime  # noqa: E402
from config.database import connect_to_mongo, get_database  # noqa: E402

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "general_theme_answer_fixes_2026_07.json")
EDITED_BY_LABEL = "system:qa_fix_2026_07"


async def main(dry_run: bool):
    await connect_to_mongo()
    db = get_database()

    with open(DATA_FILE, encoding="utf-8") as f:
        corrections = json.load(f)

    applied = 0
    skipped_conflict = 0
    skipped_missing = 0

    for tema, items in corrections.items():
        for item in items:
            qid = item["id"]
            expected_old = item["old"]
            new_value = item["new"]

            question = await db.questions.find_one({"id": qid})
            if not question:
                print(f"[{tema}] AVISO: no existe la pregunta {qid}, se omite")
                skipped_missing += 1
                continue

            current = question.get("correct_answer")
            if current != expected_old:
                print(
                    f"[{tema}] CONFLICTO: {qid} tiene correct_answer={current}, "
                    f"se esperaba {expected_old} -- se omite, revisar a mano"
                )
                skipped_conflict += 1
                continue

            if dry_run:
                print(f"[{tema}] {qid}: {current} -> {new_value} (dry-run, no aplicado)")
                applied += 1
                continue

            history_entry = {
                "text": question["text"],
                "choices": question["choices"],
                "correct_answer": current,
                "edited_by": EDITED_BY_LABEL,
                "edited_at": datetime.utcnow(),
            }
            await db.questions.update_one(
                {"id": qid},
                {
                    "$set": {"correct_answer": new_value},
                    "$push": {"edit_history": history_entry},
                },
            )
            applied += 1

    print()
    print(f"{'Simuladas' if dry_run else 'Aplicadas'}: {applied}")
    print(f"Conflictos (valor actual no coincide con el esperado): {skipped_conflict}")
    print(f"No encontradas en la base de datos: {skipped_missing}")


if __name__ == "__main__":
    asyncio.run(main(dry_run="--dry-run" in sys.argv))
