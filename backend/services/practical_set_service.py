from repositories.practical_set_repository import PracticalSetRepository
from repositories.theme_repository import ThemeRepository
from models.practical_set import PracticalSetCreate, PracticalSetInDB
from typing import List, Optional
from fastapi import HTTPException, status
import uuid
import logging

logger = logging.getLogger(__name__)

class PracticalSetService:
    def __init__(self):
        self.practical_set_repo = PracticalSetRepository()
        self.theme_repo = ThemeRepository()

    async def create_practical_set(self, practical_set_data: PracticalSetCreate, user_id: str) -> dict:
        """Create a new practical set"""
        # Validate themes exist
        for theme_id in practical_set_data.theme_ids:
            theme = await self.theme_repo.get_by_id(theme_id)
            if not theme:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Theme {theme_id} not found"
                )

        # Create practical set
        practical_set = await self.practical_set_repo.create(practical_set_data, user_id)

        return {
            "id": practical_set.id,
            "title": practical_set.title,
            "description": practical_set.description,
            "theme_ids": practical_set.theme_ids,
            "question_count": len(practical_set.questions),
            "created_by": practical_set.created_by,
            "created_at": practical_set.created_at
        }

    async def get_practical_set(self, practical_set_id: str) -> dict:
        """Get a practical set by ID"""
        practical_set = await self.practical_set_repo.get_by_id(practical_set_id)
        if not practical_set:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Practical set not found"
            )
        return practical_set

    async def get_all_practical_sets(self, skip: int = 0, limit: int = 50) -> List[dict]:
        """Get all practical sets (summary)"""
        practical_sets = await self.practical_set_repo.get_all(skip, limit)

        # Return summary without full questions
        summaries = []
        for ps in practical_sets:
            summaries.append({
                "id": ps["id"],
                "title": ps["title"],
                "description": ps["description"],
                "theme_ids": ps["theme_ids"],
                "question_count": len(ps["questions"]),
                "created_by": ps["created_by"],
                "created_at": ps["created_at"]
            })

        return summaries

    async def get_by_theme(self, theme_id: str) -> List[dict]:
        """Get practical sets by theme"""
        practical_sets = await self.practical_set_repo.get_by_theme(theme_id)

        summaries = []
        for ps in practical_sets:
            summaries.append({
                "id": ps["id"],
                "title": ps["title"],
                "description": ps["description"],
                "theme_ids": ps["theme_ids"],
                "question_count": len(ps["questions"]),
                "created_by": ps["created_by"],
                "created_at": ps["created_at"]
            })

        return summaries

    async def get_random_practical_set(self) -> dict:
        """Get a random practical set for exam"""
        practical_sets = await self.practical_set_repo.get_random(1)

        if not practical_sets:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No practical sets available"
            )

        return practical_sets[0]

    async def delete_practical_set(self, practical_set_id: str) -> bool:
        """Soft delete a practical set"""
        success = await self.practical_set_repo.soft_delete(practical_set_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Practical set not found"
            )
        return success

    # -- Edición inline de preguntas embebidas (árbol de Gestionar Preguntas, ronda 5) --------
    # Las preguntas de un practical_set (Cuadernillos/Supuestos) no son una colección aparte con
    # su propio CRUD -- viven embebidas en `questions` dentro del propio documento, y `cases`
    # referencia esas preguntas por `position` (1-based, contiguo), no por índice de array. Los
    # tres métodos de abajo son los únicos que mutan esa lista fuera de la creación inicial, así
    # que son responsables de mantener esa invariante (posiciones contiguas + cases coherentes).

    @staticmethod
    def _validate_question_fields(data: dict) -> None:
        choices = data.get("choices")
        correct_answer = data.get("correct_answer")
        if choices is not None and len(choices) < 2:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Se requieren al menos 2 opciones")
        if correct_answer is not None and choices is not None and correct_answer >= len(choices):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "correct_answer fuera de rango")

    async def update_question(self, practical_set_id: str, question_id: str, data: dict) -> dict:
        practical_set = await self.practical_set_repo.get_by_id(practical_set_id)
        if not practical_set:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Practical set not found")

        self._validate_question_fields(data)
        questions = practical_set["questions"]
        target = next((q for q in questions if q["id"] == question_id), None)
        if not target:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")

        for field in ("text", "choices", "correct_answer"):
            if field in data:
                target[field] = data[field]

        await self.practical_set_repo.update(practical_set_id, {"questions": questions})
        return target

    async def add_question(
        self, practical_set_id: str, data: dict, case_position: Optional[int] = None
    ) -> dict:
        practical_set = await self.practical_set_repo.get_by_id(practical_set_id)
        if not practical_set:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Practical set not found")

        self._validate_question_fields(data)
        if "text" not in data or "choices" not in data or "correct_answer" not in data:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "text, choices y correct_answer son obligatorios")

        questions = practical_set["questions"]
        next_position = max((q["position"] for q in questions), default=0) + 1
        new_question = {
            "id": str(uuid.uuid4()),
            "position": next_position,
            "text": data["text"],
            "choices": data["choices"],
            "correct_answer": data["correct_answer"],
        }
        questions.append(new_question)

        update_data = {"questions": questions}
        cases = practical_set.get("cases")
        if case_position is not None and cases:
            target_case = next((c for c in cases if c["position"] == case_position), None)
            if not target_case:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Caso no encontrado")
            target_case["question_positions"].append(next_position)
            update_data["cases"] = cases

        await self.practical_set_repo.update(practical_set_id, update_data)
        return new_question

    async def delete_question(self, practical_set_id: str, question_id: str) -> None:
        practical_set = await self.practical_set_repo.get_by_id(practical_set_id)
        if not practical_set:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Practical set not found")

        questions = practical_set["questions"]
        target = next((q for q in questions if q["id"] == question_id), None)
        if not target:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
        if len(questions) <= 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No se puede dejar el practical_set sin preguntas")

        deleted_position = target["position"]
        remaining = [q for q in questions if q["id"] != question_id]
        for q in remaining:
            if q["position"] > deleted_position:
                q["position"] -= 1

        update_data = {"questions": remaining}
        cases = practical_set.get("cases")
        if cases:
            for case in cases:
                case["question_positions"] = [
                    (pos - 1 if pos > deleted_position else pos)
                    for pos in case["question_positions"]
                    if pos != deleted_position
                ]
            update_data["cases"] = cases

        await self.practical_set_repo.update(practical_set_id, update_data)
