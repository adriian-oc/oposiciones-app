"""
Recalcula las notas/estadísticas de alumnos que se vieron afectadas por una corrección de
`correct_answer` en una pregunta (vía Admin o vía los scripts de corrección masiva de
Test de Teoría). El bug: la nota de un examen se calcula UNA VEZ, al terminarlo, usando el
snapshot de la pregunta guardado dentro de `exams.questions[]` en ese momento -- corregir
`questions.correct_answer` después no recalcula nada solo, así que un alumno que respondió
bien antes de la corrección puede seguir figurando como fallo.

Toca, para cada pregunta con `edit_history` (cualquier corrección, no solo las del bug de
julio 2026):
  1. `exams.questions[].correct_answer` -- parchea el snapshot embebido, para que cualquier
     examen todavía sin terminar puntúe ya con el valor correcto al finalizarlo.
  2. `attempts.score` / `attempts.details` -- para los intentos YA terminados con ese snapshot
     erróneo, recalcula la nota completa reutilizando `ExamService._calculate_score` (la misma
     lógica que usa la app, no una reimplementación aparte).
  3. `user_theme_stats` / `analytics_failures` -- estos son contadores ACUMULADOS por alumno
     (no derivables con una simple resta), así que para cada alumno afectado se reconstruyen
     desde cero, reproduciendo TODOS sus intentos terminados (ya corregidos) con
     `AnalyticsService.record_attempt_results` -- el mismo camino que ya usa la app al terminar
     un examen, no una reimplementación aparte.
  4. `progress.content_scores[content_unit_key]` -- solo se actualizan `correct/total/pct` si
     el intento más reciente de esa unidad es uno de los corregidos (no se re-simula el estado
     SM-2 -- ease_factor/repetitions/interval_days -- retroactivamente; ese sistema además está
     previsto para sustituirse por completo por el nuevo motor de repetición espaciada del
     punto 8 de CONTINUATION.md, así que no compensa el esfuerzo de una réplica histórica
     completa aquí).

Uso:
  Comprobar sin escribir nada:
    cd backend && source venv/bin/activate && python ../scripts/recalculate_stats_after_answer_fix.py --dry-run

  Aplicar de verdad:
    cd backend && source venv/bin/activate && python ../scripts/recalculate_stats_after_answer_fix.py

Idempotente: si se relanza sin que haya correcciones nuevas de por medio, no encuentra nada que
tocar (los exámenes ya están al día, la reconstrucción de user_theme_stats/analytics_failures da
el mismo resultado).
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from config.database import connect_to_mongo, get_database  # noqa: E402
from services.exam_service import ExamService  # noqa: E402
from services.analytics_service import AnalyticsService  # noqa: E402


def _find_value_windows(question: dict) -> list[dict]:
    """A partir del edit_history de una pregunta, reconstruye la secuencia de valores que tuvo
    `correct_answer` a lo largo del tiempo: [(valor, desde, hasta), ...]. edit_history[i] guarda
    el estado ANTERIOR a la edición i-ésima; el valor vigente tras esa edición es el de la
    siguiente entrada del historial, o el `correct_answer` actual si es la última."""
    history = question.get("edit_history") or []
    windows = []
    prev_time = question["created_at"]
    for i, entry in enumerate(history):
        old_val = entry["correct_answer"]
        new_val = history[i + 1]["correct_answer"] if i + 1 < len(history) else question["correct_answer"]
        end_time = entry["edited_at"]
        if old_val != new_val:
            windows.append({"old": old_val, "new": new_val, "start": prev_time, "end": end_time})
        prev_time = end_time
    return windows


async def main(dry_run: bool):
    await connect_to_mongo()
    db = get_database()
    exam_service = ExamService()
    analytics_service = AnalyticsService()

    questions_with_history = await db.questions.find(
        {"edit_history": {"$exists": True, "$ne": []}}, {"_id": 0}
    ).to_list(length=None)

    corrections = []
    for q in questions_with_history:
        for w in _find_value_windows(q):
            corrections.append({"question_id": q["id"], **w})

    print(f"Preguntas con historial de edición: {len(questions_with_history)}")
    print(f"Cambios de valor a replicar: {len(corrections)}")

    # 1. Parchear snapshots de exámenes (en memoria siempre; en Mongo solo si no es dry-run)
    patched_exams: dict[str, dict] = {}
    for c in corrections:
        cursor = db.exams.find(
            {
                "questions": {"$elemMatch": {"question_id": c["question_id"], "correct_answer": c["old"]}},
                "created_at": {"$gte": c["start"], "$lt": c["end"]},
            },
            {"_id": 0},
        )
        async for exam in cursor:
            exam_doc = patched_exams.setdefault(exam["id"], exam)
            for question in exam_doc["questions"]:
                if question["question_id"] == c["question_id"] and question["correct_answer"] == c["old"]:
                    question["correct_answer"] = c["new"]

    print(f"Exámenes con preguntas afectadas: {len(patched_exams)}")
    if not dry_run:
        for exam_id, exam_doc in patched_exams.items():
            await db.exams.update_one({"id": exam_id}, {"$set": {"questions": exam_doc["questions"]}})

    # 2. Recalcular la nota de los intentos ya terminados sobre esos exámenes
    exam_ids = list(patched_exams.keys())
    attempts_to_patch: dict[str, dict] = {}  # attempt_id -> {"user_id":, "results": [...], "score":, "details":}
    affected_users: set[str] = set()

    if exam_ids:
        cursor = db.attempts.find(
            {"exam_id": {"$in": exam_ids}, "finished_at": {"$ne": None}}, {"_id": 0}
        )
        async for attempt in cursor:
            exam_doc = patched_exams[attempt["exam_id"]]
            new_score = exam_service._calculate_score(
                exam_doc["questions"], attempt.get("answers", {}), exam_doc["type"]
            )
            old_results = (attempt.get("details") or {}).get("results", [])
            if new_score["results"] != old_results:
                attempts_to_patch[attempt["id"]] = {
                    "user_id": attempt["user_id"],
                    "score": new_score["final_score"],
                    "details": new_score,
                }
                affected_users.add(attempt["user_id"])

    print(f"Intentos terminados con nota a corregir: {len(attempts_to_patch)}")
    print(f"Alumnos afectados: {len(affected_users)}")

    if not dry_run:
        for attempt_id, patch in attempts_to_patch.items():
            await db.attempts.update_one(
                {"id": attempt_id},
                {"$set": {"score": patch["score"], "details": patch["details"]}},
            )

    # 3. Reconstruir user_theme_stats / analytics_failures desde cero para cada alumno afectado,
    #    reproduciendo TODOS sus intentos terminados (con la nota ya corregida donde aplique).
    progress_patches = 0
    for user_id in affected_users:
        attempts = await db.attempts.find(
            {"user_id": user_id, "finished_at": {"$ne": None}}, {"_id": 0}
        ).sort("finished_at", 1).to_list(length=None)

        replay = []
        for attempt in attempts:
            if attempt["id"] in attempts_to_patch:
                details = attempts_to_patch[attempt["id"]]["details"]
                correct, total = details["correct"], details["total_questions"]
            else:
                details = attempt.get("details") or {}
                correct, total = details.get("correct", 0), details.get("total_questions", 0)
            results = details.get("results")
            if results is None:
                print(f"  AVISO: intento {attempt['id']} de {user_id} sin 'details.results', se omite del recálculo")
                continue
            replay.append((attempt, correct, total, results))

        if not dry_run:
            await db.user_theme_stats.delete_many({"user_id": user_id})
            await db.analytics_failures.delete_many({"user_id": user_id})
            for attempt, _correct, _total, results in replay:
                await analytics_service.record_attempt_results(
                    attempt_id=attempt["id"], user_id=user_id, results=results
                )

        # 4. progress.content_scores: solo tocar si el intento MÁS RECIENTE de esa unidad
        #    (mode=practice) es uno de los que se acaban de corregir.
        by_unit_latest: dict[str, tuple] = {}
        for attempt, correct, total, _results in replay:
            if attempt.get("mode") != "practice" or not attempt.get("content_unit_key"):
                continue
            key = attempt["content_unit_key"]
            if key not in by_unit_latest or attempt["finished_at"] > by_unit_latest[key][0]["finished_at"]:
                by_unit_latest[key] = (attempt, correct, total)

        progress_doc = await db.progress.find_one({"user_id": user_id}, {"_id": 0})
        content_scores = (progress_doc or {}).get("content_scores", {})
        progress_updates = {}
        for key, (attempt, correct, total) in by_unit_latest.items():
            if attempt["id"] not in attempts_to_patch:
                continue
            existing = content_scores.get(key)
            if not existing:
                continue
            pct = round((correct / total) * 100, 2) if total else 0.0
            if existing.get("correct") == correct and existing.get("total") == total:
                continue
            progress_updates[f"content_scores.{key}.correct"] = correct
            progress_updates[f"content_scores.{key}.total"] = total
            progress_updates[f"content_scores.{key}.pct"] = pct
            progress_patches += 1

        if progress_updates and not dry_run:
            await db.progress.update_one({"user_id": user_id}, {"$set": progress_updates})

    print(f"Entradas de progress.content_scores a corregir (solo correct/total/pct): {progress_patches}")
    print()
    print("Modo simulación (--dry-run), no se ha escrito nada." if dry_run else "Cambios aplicados.")


if __name__ == "__main__":
    asyncio.run(main(dry_run="--dry-run" in sys.argv))
