"""
Siembra el examen de repaso "Test Adrián 1-11" (101 preguntas de Test de Teoría, parte general,
que mezclan contenido de los Temas 1 al 11) como tema nuevo, para que quede disponible a los
alumnos como cualquier otro Test de Teoría.

Crea el tema "Repaso Temas 1-11" (code GENERAL_REPASO_1_11, part GENERAL, order 24 -- siguiente
al último tema general existente) si no existe todavía, y carga sus 101 preguntas con
content_area="ttgen" y ese theme_id. Al tener content_area="ttgen" y aparecer en la colección
`themes`, el tema sale automáticamente listado en Cuadernos.js sin tocar frontend.

Idempotente: si el tema ya existe y ya tiene preguntas cargadas, no vuelve a insertar nada.

Nota sobre la pregunta 93: la clave de respuestas del PDF original tiene ahí dos letras
superpuestas ("CB", posible corrección manual del autor sin borrar la anterior). Se ha optado
por la opción C, que es la que coincide con el contenido legal de la pregunta (arts. 265/268
TFUE sobre recurso de particulares por acción u omisión de una institución de la UE) -- revisar
manualmente vía Admin si se prefiere la B.

Uso:
  cd backend && source venv/bin/activate && python ../scripts/seed_test_adrian_1_11.py
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from config.database import connect_to_mongo  # noqa: E402
from repositories.theme_repository import ThemeRepository  # noqa: E402
from repositories.question_repository import QuestionRepository  # noqa: E402
from models.theme import ThemeCreate  # noqa: E402
from models.question import QuestionCreate  # noqa: E402

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "test_adrian_1_11_2026_07.json")
THEME_CODE = "GENERAL_REPASO_1_11"
THEME_NAME = "Repaso Temas 1-11"
THEME_ORDER = 24
CONTENT_AREA = "ttgen"


async def main():
    await connect_to_mongo()
    theme_repo = ThemeRepository()
    question_repo = QuestionRepository()

    with open(DATA_FILE, encoding="utf-8") as f:
        questions = json.load(f)

    theme = await theme_repo.get_by_code(THEME_CODE)
    if not theme:
        theme = await theme_repo.create(
            ThemeCreate(code=THEME_CODE, name=THEME_NAME, part="GENERAL", order=THEME_ORDER)
        )
        theme = theme.model_dump()
        print(f"Tema creado: {THEME_CODE} ({THEME_NAME}), id={theme['id']}")
    else:
        print(f"Tema ya existente: {THEME_CODE}, id={theme['id']}")

    existing_count = await question_repo.count_by_theme(theme["id"])
    if existing_count > 0:
        print(
            f"El tema ya tiene {existing_count} preguntas cargadas -- no se inserta nada más "
            "(script idempotente, revisa a mano si esto no es lo esperado)."
        )
        return

    inserted = 0
    for q in questions:
        await question_repo.create(
            QuestionCreate(
                theme_id=theme["id"],
                text=q["text"],
                choices=q["choices"],
                correct_answer=q["correct_answer"],
                difficulty=q.get("difficulty", "MEDIUM"),
                tags=q.get("tags", []),
                content_area=CONTENT_AREA,
            ),
            created_by=None,
        )
        inserted += 1

    print(f"Preguntas insertadas: {inserted}")


if __name__ == "__main__":
    asyncio.run(main())
