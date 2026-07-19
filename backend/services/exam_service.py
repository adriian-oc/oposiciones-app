from repositories.exam_repository import ExamRepository
from repositories.question_repository import QuestionRepository
from repositories.practical_set_repository import PracticalSetRepository
from repositories.user_repository import UserRepository
from models.exam import (
    ExamCreate, ExamInDB, QuestionSnapshot,
    AttemptStart, AttemptInDB, AnswerSubmit
)
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

EXAM_NOT_FOUND_MESSAGE = "Exam not found"
ATTEMPT_NOT_FOUND_MESSAGE = "Attempt not found"
NOT_AUTHORIZED_MESSAGE = "Not authorized"

class ExamService:
    def __init__(self):
        self.exam_repo = ExamRepository()
        self.question_repo = QuestionRepository()
        self.practical_set_repo = PracticalSetRepository()
        self.user_repo = UserRepository()
        # Import here to avoid circular dependency
        from services.analytics_service import AnalyticsService
        from services.progress_service import ProgressService
        from services.study_calendar_service import StudyCalendarService
        self.analytics_service = AnalyticsService()
        self.progress_service = ProgressService()
        self.study_calendar_service = StudyCalendarService()

    async def _check_access_key(self, access_key: str, user_id: str) -> None:
        """Aplica user.allowed_content (None = acceso completo) contra una clave de acceso
        (gen:<id> / cuad:<theme_id> / <area_id>:<theme_id>) -- comprobación server-side, no
        basta con ocultar la opción en el cliente."""
        user = await self.user_repo.get_by_id(user_id)
        if not user or user.get("role") in ("admin", "profesor"):
            return
        allowed = user.get("allowed_content")
        if allowed is None:
            return
        if access_key not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes acceso a este contenido")

    async def _check_practical_set_access(self, practical_set: dict, user_id: str) -> None:
        access_key = (
            f"gen:{practical_set['id']}" if not practical_set["theme_ids"]
            else f"cuad:{practical_set['theme_ids'][0]}"
        )
        await self._check_access_key(access_key, user_id)

    @staticmethod
    def _scrub_exam(exam: dict) -> dict:
        """Nunca se debe exponer correct_answer a través de los endpoints que arrancan/leen un
        examen -- el alumno los llama antes (o durante) de contestar, y el dato es legible en
        las herramientas de red del navegador. La corrección solo se sirve tras finalizar
        (get_attempt_results/finish_attempt) o, si el intento tiene live_correction activo, por
        pregunta al enviar cada respuesta (submit_answer)."""
        return {
            **exam,
            "questions": [
                {k: v for k, v in q.items() if k != "correct_answer"}
                for q in exam.get("questions", [])
            ],
        }

    async def start_practice(self, practical_set_id: str, user_id: str, live_correction: bool = False) -> dict:
        """Practica suelta de un Supuesto/Cuadernillo (practical_set): construye un 'examen' de
        un solo uso a partir de sus preguntas y arranca el intento en el mismo acto, reutilizando
        íntegro el motor de exámenes existente (submit_answer/finish_attempt/results) en vez de
        montar un segundo stack de scoring aparte."""
        practical_set = await self.practical_set_repo.get_by_id(practical_set_id)
        if not practical_set:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Practical set not found")

        await self._check_practical_set_access(practical_set, user_id)

        theme_id = practical_set["theme_ids"][0] if practical_set["theme_ids"] else ""
        question_snapshots = [
            QuestionSnapshot(
                question_id=q["id"],
                text=q["text"],
                choices=q["choices"],
                correct_answer=q["correct_answer"],
                theme_id=theme_id,
            )
            for q in practical_set["questions"]
        ]

        exam = ExamInDB(
            type="PRACTICAL",
            name=practical_set["title"],
            theme_ids=practical_set["theme_ids"],
            questions=question_snapshots,
            created_by=user_id,
            mode="practice",
            content_unit_key=practical_set["id"],
            cases=practical_set.get("cases"),
        )
        created_exam = await self.exam_repo.create_exam(exam)

        attempt = AttemptInDB(
            exam_id=created_exam.id,
            user_id=user_id,
            mode="practice",
            content_unit_key=practical_set["id"],
            live_correction=live_correction,
        )
        created_attempt = await self.exam_repo.create_attempt(attempt)

        return {
            "id": created_attempt.id,
            "exam_id": created_attempt.exam_id,
            "started_at": created_attempt.started_at,
            "exam": self._scrub_exam(created_exam.model_dump()),
        }

    async def start_theory_practice(self, area_id: str, theme_id: str, user_id: str, live_correction: bool = False) -> dict:
        """Practicar un tema entero de Test de Teoría (ttesp/ttgen) de una sola vez, mismo
        patrón que start_practice pero a partir de todas las preguntas cargadas para
        (theme_id, content_area=area_id) en vez de un practical_set. content_unit_key usa el
        mismo formato '<area_id>:<theme_id>' que las claves de allowed_content, así el chequeo
        de acceso y el rollup de progreso (Mi Progreso/Estudio, Refuerzo) funcionan sin más
        cambios."""
        from repositories.theme_repository import ThemeRepository
        theme = await ThemeRepository().get_by_id(theme_id)
        if not theme:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Theme not found")

        access_key = f"{area_id}:{theme_id}"
        await self._check_access_key(access_key, user_id)

        # Test de Teoría tiene su propio banco de preguntas (content_area=area_id), distinto del
        # de Cuadernillos -- un tema sin preguntas propias cargadas todavía no es practicable.
        questions = await self.question_repo.get_all(theme_id=theme_id, limit=1000, content_area=area_id)
        if not questions:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No hay preguntas cargadas para este tema")

        question_snapshots = [
            QuestionSnapshot(
                question_id=q["id"],
                text=q["text"],
                choices=q["choices"],
                correct_answer=q["correct_answer"],
                theme_id=theme_id,
            )
            for q in questions
        ]

        exam = ExamInDB(
            type="THEORY_TOPIC",
            name=theme["name"],
            theme_ids=[theme_id],
            questions=question_snapshots,
            created_by=user_id,
            mode="practice",
            content_unit_key=access_key,
        )
        created_exam = await self.exam_repo.create_exam(exam)

        attempt = AttemptInDB(
            exam_id=created_exam.id,
            user_id=user_id,
            mode="practice",
            content_unit_key=access_key,
            live_correction=live_correction,
        )
        created_attempt = await self.exam_repo.create_attempt(attempt)

        return {
            "id": created_attempt.id,
            "exam_id": created_attempt.exam_id,
            "started_at": created_attempt.started_at,
            "exam": self._scrub_exam(created_exam.model_dump()),
        }

    async def get_practice_history(self, user_id: str, content_unit_key: str) -> List[dict]:
        """Historial de puntuaciones de una unidad de práctica concreta, para el trend/detalle
        que se muestra en la página de progreso del alumno."""
        attempts = await self.exam_repo.get_attempts_by_user_and_content_unit(user_id, content_unit_key)
        history = []
        for attempt in attempts:
            details = attempt.get("details")
            if not details:
                continue
            history.append({
                "score": details.get("correct", 0),
                "total": details.get("total_questions", 0),
                "date": attempt.get("finished_at") or attempt.get("started_at"),
            })
        return history

    async def generate_exam(self, exam_data: ExamCreate, user_id: str) -> dict:
        """Generate an exam by selecting random questions from specified themes"""

        # Special handling for SIMULACRO type
        if exam_data.type == "SIMULACRO":
            return await self._generate_simulacro(exam_data, user_id)

        # Validate theme_ids
        if not exam_data.theme_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one theme must be specified"
            )

        # Get random questions from themes
        questions = await self.question_repo.get_random_by_themes(
            exam_data.theme_ids,
            exam_data.question_count
        )

        if len(questions) < exam_data.question_count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Not enough questions available. Found {len(questions)}, requested {exam_data.question_count}"
            )

        # Create snapshots of questions
        question_snapshots = []
        for q in questions:
            snapshot = QuestionSnapshot(
                question_id=q["id"],
                text=q["text"],
                choices=q["choices"],
                correct_answer=q["correct_answer"],
                theme_id=q["theme_id"]
            )
            question_snapshots.append(snapshot)

        # Create exam
        exam = ExamInDB(
            type=exam_data.type,
            name=exam_data.name,
            theme_ids=exam_data.theme_ids,
            questions=question_snapshots,
            created_by=user_id
        )

        created_exam = await self.exam_repo.create_exam(exam)

        return {
            "id": created_exam.id,
            "type": created_exam.type,
            "name": created_exam.name,
            "theme_ids": created_exam.theme_ids,
            "question_count": len(created_exam.questions),
            "created_at": created_exam.created_at
        }

    async def _generate_simulacro(self, exam_data: ExamCreate, user_id: str) -> dict:
        """Generate simulacro with 40 questions: 30% general (12) + 70% specific (28)"""
        from repositories.theme_repository import ThemeRepository
        theme_repo = ThemeRepository()

        # Get all general and specific themes
        general_themes = await theme_repo.get_all(part="GENERAL")
        specific_themes = await theme_repo.get_all(part="SPECIFIC")

        if not general_themes or not specific_themes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="General or specific themes not found. Please seed themes first."
            )

        general_theme_ids = [t["id"] for t in general_themes]
        specific_theme_ids = [t["id"] for t in specific_themes]

        # Get 12 questions from general themes (30% of 40)
        general_questions = await self.question_repo.get_random_by_themes(general_theme_ids, 12)

        # Get 28 questions from specific themes (70% of 40)
        specific_questions = await self.question_repo.get_random_by_themes(specific_theme_ids, 28)

        if len(general_questions) < 12:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Not enough general questions. Found {len(general_questions)}, need 12"
            )

        if len(specific_questions) < 28:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Not enough specific questions. Found {len(specific_questions)}, need 28"
            )

        # Combine questions
        all_questions = general_questions + specific_questions

        # Create snapshots
        question_snapshots = []
        for q in all_questions:
            snapshot = QuestionSnapshot(
                question_id=q["id"],
                text=q["text"],
                choices=q["choices"],
                correct_answer=q["correct_answer"],
                theme_id=q["theme_id"]
            )
            question_snapshots.append(snapshot)

        # Create exam
        exam = ExamInDB(
            type="SIMULACRO",
            name=exam_data.name or "Simulacro Completo",
            theme_ids=general_theme_ids + specific_theme_ids,
            questions=question_snapshots,
            created_by=user_id
        )

        created_exam = await self.exam_repo.create_exam(exam)

        return {
            "id": created_exam.id,
            "type": created_exam.type,
            "name": created_exam.name,
            "theme_ids": created_exam.theme_ids,
            "question_count": len(created_exam.questions),
            "general_questions": 12,
            "specific_questions": 28,
            "created_at": created_exam.created_at
        }

    async def get_exam(self, exam_id: str) -> dict:
        """Get exam details"""
        exam = await self.exam_repo.get_exam_by_id(exam_id)
        if not exam:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EXAM_NOT_FOUND_MESSAGE
            )
        return self._scrub_exam(exam)

    async def start_attempt(self, exam_id: str, user_id: str, live_correction: bool = False) -> dict:
        """Start a new exam attempt"""
        exam = await self.exam_repo.get_exam_by_id(exam_id)
        if not exam:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EXAM_NOT_FOUND_MESSAGE
            )

        attempt = AttemptInDB(
            exam_id=exam_id,
            user_id=user_id,
            live_correction=live_correction,
        )

        created_attempt = await self.exam_repo.create_attempt(attempt)

        return {
            "id": created_attempt.id,
            "exam_id": created_attempt.exam_id,
            "started_at": created_attempt.started_at,
            "exam": self._scrub_exam(exam)
        }

    async def submit_answer(self, attempt_id: str, answer: AnswerSubmit, user_id: str) -> dict:
        """Submit an answer for a question in an attempt"""
        attempt = await self.exam_repo.get_attempt_by_id(attempt_id)
        if not attempt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=ATTEMPT_NOT_FOUND_MESSAGE
            )

        if attempt["user_id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=NOT_AUTHORIZED_MESSAGE
            )

        if attempt.get("finished_at"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Attempt already finished"
            )

        # Update answers
        answers = attempt.get("answers", {})
        answers[answer.question_id] = answer.selected_answer

        await self.exam_repo.update_attempt(attempt_id, {"answers": answers})

        result = {"message": "Answer recorded", "question_id": answer.question_id}
        # Corrección en directo: solo si el propio intento la activó explícitamente al arrancar
        # (live_correction=True) -- si no, no se devuelve nada de correct_answer aquí, para no
        # reabrir el leak cerrado en _scrub_exam vía este endpoint alternativo.
        if attempt.get("live_correction") and answer.selected_answer is not None:
            exam = await self.exam_repo.get_exam_by_id(attempt["exam_id"])
            question = next(
                (q for q in (exam or {}).get("questions", []) if q["question_id"] == answer.question_id),
                None,
            )
            if question:
                result["is_correct"] = answer.selected_answer == question["correct_answer"]
                result["correct_answer"] = question["correct_answer"]
        return result

    async def finish_attempt(self, attempt_id: str, user_id: str) -> dict:
        """Finish attempt and calculate score"""
        attempt = await self.exam_repo.get_attempt_by_id(attempt_id)
        if not attempt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=ATTEMPT_NOT_FOUND_MESSAGE
            )

        if attempt["user_id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=NOT_AUTHORIZED_MESSAGE
            )

        if attempt.get("finished_at"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Attempt already finished"
            )

        # Get exam
        exam = await self.exam_repo.get_exam_by_id(attempt["exam_id"])
        if not exam:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EXAM_NOT_FOUND_MESSAGE
            )

        # Calculate score with exam type
        score_result = self._calculate_score(exam["questions"], attempt.get("answers", {}), exam["type"])

        # Update attempt
        update_data = {
            "finished_at": datetime.now(timezone.utc),
            "score": score_result["final_score"],
            "details": score_result
        }

        await self.exam_repo.update_attempt(attempt_id, update_data)

        # Record analytics
        try:
            await self.analytics_service.record_attempt_results(
                attempt_id=attempt_id,
                user_id=user_id,
                results=score_result["results"]
            )
        except Exception as e:
            logger.error(f"Failed to record analytics: {e}")
            # Don't fail the attempt if analytics fails

        # Rollup de progreso (racha + score por content_unit) solo para prácticas sueltas de
        # Supuestos/Cuadernillos/Test de Teoría -- un examen generado a medida (SIMULACRO,
        # mezcla libre de temas) no tiene un content_unit_key único al que asociar el progreso.
        if attempt.get("mode") == "practice" and attempt.get("content_unit_key"):
            try:
                await self.progress_service.record_practice_result(
                    user_id=user_id,
                    content_unit_key=attempt["content_unit_key"],
                    correct=score_result["correct"],
                    total=score_result["total_questions"],
                )
            except Exception as e:
                logger.error(f"Failed to record progress rollup: {e}")

            # El calendario de estudio 'se actualiza automático' según cambian los fallos
            # reales del alumno -- regenerar solo si ya configuró horas disponibles (si no,
            # no hay nada que generar; ver StudyCalendarService.regenerate_calendar).
            try:
                await self.study_calendar_service.regenerate_calendar(user_id)
            except Exception as e:
                logger.error(f"Failed to regenerate study calendar: {e}")

        return {
            "attempt_id": attempt_id,
            "score": score_result["final_score"],
            "details": score_result
        }

    def _calculate_score(self, questions: List[dict], answers: Dict[str, Any], exam_type: str = "THEORY") -> dict:
        """Calculate exam score based on rules: +1 correct, -0.25 incorrect, 0 unanswered"""
        total_questions = len(questions)
        correct = 0
        incorrect = 0
        unanswered = 0
        results = []

        for question in questions:
            question_id = question["question_id"]
            correct_answer = question["correct_answer"]
            selected_answer = answers.get(question_id)

            is_correct = False
            status = "unanswered"

            if selected_answer is None:
                unanswered += 1
            elif selected_answer == correct_answer:
                correct += 1
                is_correct = True
                status = "correct"
            else:
                incorrect += 1
                status = "incorrect"

            results.append({
                "question_id": question_id,
                "question_text": question["text"],
                "choices": question.get("choices", []),
                "theme_id": question.get("theme_id"),  # Include theme_id for analytics
                "selected_answer": selected_answer,
                "correct_answer": correct_answer,
                "is_correct": is_correct,
                "status": status
            })

        # Calculate raw score
        raw_score = (correct * 1.0) + (incorrect * -0.25)
        raw_score = max(raw_score, 0)  # Non-negative

        # Scale based on exam type: SIMULACRO -> 100, práctica (Supuestos/Cuadernillos) -> 15
        # (escala real de la oposición para estos casos prácticos), resto (teoría) -> 70
        scale = 100 if exam_type == "SIMULACRO" else 15 if exam_type == "PRACTICAL" else 70
        final_score = (raw_score / total_questions) * scale if total_questions > 0 else 0

        return {
            "total_questions": total_questions,
            "correct": correct,
            "incorrect": incorrect,
            "unanswered": unanswered,
            "raw_score": raw_score,
            "final_score": round(final_score, 2),
            "scale": scale,
            "exam_type": exam_type,
            "results": results
        }

    async def get_attempt_results(self, attempt_id: str, user_id: str) -> dict:
        """Get attempt results"""
        attempt = await self.exam_repo.get_attempt_by_id(attempt_id)
        if not attempt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=ATTEMPT_NOT_FOUND_MESSAGE
            )

        if attempt["user_id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=NOT_AUTHORIZED_MESSAGE
            )

        exam = await self.exam_repo.get_exam_by_id(attempt["exam_id"])
        if not exam:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=EXAM_NOT_FOUND_MESSAGE
            )

        # Tercer leak encontrado en la ronda 5: este endpoint lo llama también TakeExam.js al
        # arrancar (para leer exam_id) con el intento todavía sin terminar -- _ensure_attempt_details
        # calculaba y devolvía (persistiéndolo incluso) un scoring con correct_answer por
        # pregunta antes de que el alumno respondiera nada. Solo tiene sentido calcular/backfillear
        # 'details' una vez el intento está finalizado.
        if attempt.get("finished_at"):
            details = await self._ensure_attempt_details(attempt, exam, attempt_id)
            attempt["details"] = details
        attempt["exam"] = self._build_exam_summary(exam)
        return attempt

    async def get_attempt_progress(self, attempt_id: str, user_id: str) -> dict:
        """'Ver respuestas y fallos' de un intento TODAVÍA sin terminar (Historial): a diferencia
        de get_attempt_results, que solo revela correct_answer una vez finished_at está puesto,
        aquí el propio dueño del intento puede ver -en cualquier momento- si lo que YA ha
        contestado está bien o mal. No reabre el leak cerrado en _scrub_exam: para las preguntas
        todavía sin responder no se incluye correct_answer, así este endpoint no sirve para
        adelantar respuestas antes de contestar."""
        attempt = await self.exam_repo.get_attempt_by_id(attempt_id)
        if not attempt:
            raise HTTPException(status.HTTP_404_NOT_FOUND, ATTEMPT_NOT_FOUND_MESSAGE)
        if attempt["user_id"] != user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, NOT_AUTHORIZED_MESSAGE)

        exam = await self.exam_repo.get_exam_by_id(attempt["exam_id"])
        if not exam:
            raise HTTPException(status.HTTP_404_NOT_FOUND, EXAM_NOT_FOUND_MESSAGE)

        answers = attempt.get("answers", {})
        results = []
        answered = correct = incorrect = 0
        for q in exam.get("questions", []):
            selected = answers.get(q["question_id"])
            if selected is None:
                results.append({
                    "question_id": q["question_id"],
                    "question_text": q["text"],
                    "choices": q.get("choices", []),
                    "answered": False,
                    "selected_answer": None,
                    "is_correct": None,
                    "correct_answer": None,
                })
                continue
            answered += 1
            is_correct = selected == q["correct_answer"]
            correct += 1 if is_correct else 0
            incorrect += 0 if is_correct else 1
            results.append({
                "question_id": q["question_id"],
                "question_text": q["text"],
                "choices": q.get("choices", []),
                "answered": True,
                "selected_answer": selected,
                "is_correct": is_correct,
                "correct_answer": q["correct_answer"],
            })

        return {
            "attempt_id": attempt_id,
            "exam": self._build_exam_summary(exam),
            "total_questions": len(results),
            "answered": answered,
            "unanswered": len(results) - answered,
            "correct": correct,
            "incorrect": incorrect,
            "results": results,
        }

    async def retry_failures(self, attempt_id: str, user_id: str) -> dict:
        """'Repasar fallos': crea un examen de un solo uso con únicamente las preguntas que se
        fallaron en un intento ya terminado, persistido como un intento nuevo para reutilizar
        el mismo motor de submit/finish/results en vez de reimplementar el scoring aparte.
        No se marca mode='practice' ni content_unit_key: es un repaso derivado, no una práctica
        completa de la unidad, así que no debe contarse en el rollup de progreso ni en Refuerzo."""
        attempt = await self.exam_repo.get_attempt_by_id(attempt_id)
        if not attempt:
            raise HTTPException(status.HTTP_404_NOT_FOUND, ATTEMPT_NOT_FOUND_MESSAGE)
        if attempt["user_id"] != user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, NOT_AUTHORIZED_MESSAGE)

        details = attempt.get("details")
        if not details:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "El intento todavía no ha terminado")

        failed = [r for r in details.get("results", []) if r.get("status") == "incorrect"]
        if not failed:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No hay fallos que repasar en este intento")

        source_exam = await self.exam_repo.get_exam_by_id(attempt["exam_id"])
        question_snapshots = [
            QuestionSnapshot(
                question_id=r["question_id"],
                text=r["question_text"],
                choices=r["choices"],
                correct_answer=r["correct_answer"],
                theme_id=r.get("theme_id") or "",
            )
            for r in failed
        ]

        exam = ExamInDB(
            type=source_exam["type"] if source_exam else "THEORY_TOPIC",
            name=f"Repaso de fallos — {source_exam['name'] if source_exam else 'Examen'}",
            theme_ids=source_exam.get("theme_ids", []) if source_exam else [],
            questions=question_snapshots,
            created_by=user_id,
        )
        created_exam = await self.exam_repo.create_exam(exam)

        new_attempt = AttemptInDB(exam_id=created_exam.id, user_id=user_id)
        created_attempt = await self.exam_repo.create_attempt(new_attempt)

        return {
            "id": created_attempt.id,
            "exam_id": created_attempt.exam_id,
            "started_at": created_attempt.started_at,
            "exam": self._scrub_exam(created_exam.model_dump()),
        }

    async def delete_attempt(self, attempt_id: str, user_id: str) -> None:
        """Borrar un intento SIN TERMINAR desde el Historial -- solo el propio dueño, y solo si
        no está finalizado (un intento ya terminado es el registro real de una nota, no se
        borra desde aquí)."""
        attempt = await self.exam_repo.get_attempt_by_id(attempt_id)
        if not attempt:
            raise HTTPException(status.HTTP_404_NOT_FOUND, ATTEMPT_NOT_FOUND_MESSAGE)
        if attempt["user_id"] != user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, NOT_AUTHORIZED_MESSAGE)
        if attempt.get("finished_at"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No se puede borrar un intento ya finalizado")
        await self.exam_repo.delete_attempt(attempt_id)

    async def get_user_exam_history(self, user_id: str, limit: int = 50) -> List[dict]:
        """Get user's exam history"""
        attempts = await self.exam_repo.get_attempts_by_user(user_id, limit)

        history = []
        for attempt in attempts:
            exam = await self.exam_repo.get_exam_by_id(attempt["exam_id"])

            details = attempt.get("details") or {}
            history.append({
                "attempt_id": attempt["id"],
                "exam_id": attempt["exam_id"],
                "exam_name": exam["name"] if exam else "Unknown",
                "exam_type": exam["type"] if exam else "Unknown",
                "started_at": attempt["started_at"],
                "finished_at": attempt.get("finished_at"),
                "score": attempt.get("score"),
                "scale": details.get("scale"),
                "is_completed": attempt.get("finished_at") is not None
            })

        return history

    async def _ensure_attempt_details(self, attempt: dict, exam: dict, attempt_id: str) -> dict:
        details = attempt.get("details")
        if details:
            return self._enrich_details_with_exam(details, exam)
        score_result = self._calculate_score(
            exam.get("questions", []),
            attempt.get("answers", {}),
            exam.get("type", "THEORY")
        )
        await self.exam_repo.update_attempt(
            attempt_id,
            {"details": score_result, "score": score_result["final_score"]}
        )
        return score_result

    def _enrich_details_with_exam(self, details: dict, exam: dict) -> dict:
        results = details.get("results") or []
        if not results:
            return details
        question_lookup = {
            q.get("question_id"): q for q in exam.get("questions", [])
        }
        enriched_results = [
            self._merge_result_with_question(result, question_lookup.get(result.get("question_id")))
            for result in results
        ]
        return {**details, "results": enriched_results}

    @staticmethod
    def _merge_result_with_question(result: dict, question: Optional[dict]) -> dict:
        question_text = result.get("question_text") or (question and question.get("text"))
        choices = result.get("choices") or (question and question.get("choices", [])) or []
        correct_answer = result.get("correct_answer")
        if correct_answer is None and question is not None:
            correct_answer = question.get("correct_answer")
        return {
            **result,
            "question_text": question_text,
            "choices": choices,
            "correct_answer": correct_answer
        }

    @staticmethod
    def _build_exam_summary(exam: dict) -> dict:
        return {
            "id": exam.get("id"),
            "name": exam.get("name"),
            "type": exam.get("type"),
            "question_count": len(exam.get("questions", []))
        }
