"""
Siembra las preguntas de examen generadas para la novedad de temario de julio 2026 (Tema 4:
convenio especial de cotización por prácticas; Tema 12: reforma IMV Ley 1/2026) como
draft_questions -- quedan en el banco de "Preguntas sin lanzar" del panel de Admin/Profesor para
revisar, editar y publicar como Cuadernillo o Supuesto.

Uso: cd backend && source venv/bin/activate && python ../scripts/seed_draft_questions_novedad.py
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from config.database import connect_to_mongo  # noqa: E402
from repositories.theme_repository import ThemeRepository  # noqa: E402
from repositories.draft_question_repository import DraftQuestionRepository  # noqa: E402
from models.draft_question import DraftQuestionCreate  # noqa: E402

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "draft_questions_novedad_2026_07.json")

SOURCE_LABEL = "Novedad julio 2026"


async def main():
    await connect_to_mongo()
    theme_repo = ThemeRepository()
    draft_repo = DraftQuestionRepository()

    with open(DATA_FILE, encoding="utf-8") as f:
        data = json.load(f)

    total = 0
    for theme_code, questions in data.items():
        theme = await theme_repo.get_by_code(theme_code)
        if not theme:
            print(f"AVISO: no existe el tema {theme_code}, se omite")
            continue
        for q in questions:
            await draft_repo.create(
                DraftQuestionCreate(
                    theme_id=theme["id"],
                    text=q["text"],
                    choices=q["choices"],
                    correct_answer=q["correct_answer"],
                    explanation=q.get("explanation"),
                    source_label=SOURCE_LABEL,
                ),
                created_by=None,
            )
            total += 1
        print(f"{theme_code} ({theme['name']}): {len(questions)} preguntas insertadas")

    print(f"Total: {total} preguntas borrador insertadas.")


if __name__ == "__main__":
    asyncio.run(main())
