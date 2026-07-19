from config.database import get_database
from models.exam import ExamInDB, AttemptInDB
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

class ExamRepository:
    def __init__(self):
        self.db = get_database()
        self.exam_collection = self.db.exams
        self.attempt_collection = self.db.attempts

    async def create_exam(self, exam: ExamInDB) -> ExamInDB:
        exam_dict = exam.model_dump()
        await self.exam_collection.insert_one(exam_dict)
        logger.info(f"Exam created: {exam.id}")
        return exam

    async def get_exam_by_id(self, exam_id: str) -> Optional[dict]:
        return await self.exam_collection.find_one({"id": exam_id}, {"_id": 0})

    async def get_exams_by_user(self, user_id: str, limit: int = 50) -> List[dict]:
        return await (
            self.exam_collection.find({"created_by": user_id}, {"_id": 0})
            .sort("created_at", -1)
            .limit(limit)
            .to_list(length=limit)
        )

    # Attempts
    async def create_attempt(self, attempt: AttemptInDB) -> AttemptInDB:
        attempt_dict = attempt.model_dump()
        await self.attempt_collection.insert_one(attempt_dict)
        logger.info(f"Attempt created: {attempt.id}")
        return attempt

    async def get_attempt_by_id(self, attempt_id: str) -> Optional[dict]:
        return await self.attempt_collection.find_one({"id": attempt_id}, {"_id": 0})

    async def update_attempt(self, attempt_id: str, update_data: dict) -> bool:
        result = await self.attempt_collection.update_one(
            {"id": attempt_id},
            {"$set": update_data}
        )
        return result.modified_count > 0

    async def delete_attempt(self, attempt_id: str) -> bool:
        result = await self.attempt_collection.delete_one({"id": attempt_id})
        return result.deleted_count > 0

    async def get_attempts_by_user(self, user_id: str, limit: int = 50) -> List[dict]:
        return await (
            self.attempt_collection.find({"user_id": user_id}, {"_id": 0})
            .sort("started_at", -1)
            .limit(limit)
            .to_list(length=limit)
        )

    async def get_user_attempts(self, user_id: str) -> List[dict]:
        """Get all attempts for a user (for analytics)"""
        return await (
            self.attempt_collection.find({"user_id": user_id}, {"_id": 0})
            .sort("started_at", -1)
            .to_list(length=None)
        )

    async def get_attempts_by_user_and_content_unit(self, user_id: str, content_unit_key: str) -> List[dict]:
        """Historial de intentos de práctica de una unidad concreta (para el trend de Mi Estudio)."""
        return await (
            self.attempt_collection.find(
                {"user_id": user_id, "content_unit_key": content_unit_key}, {"_id": 0}
            )
            .sort("started_at", 1)
            .to_list(length=None)
        )

    async def get_finished_practice_attempts(self, user_id: str) -> List[dict]:
        """Todos los intentos de práctica terminados de un alumno, para las stat cards
        acumuladas de Mi Progreso (progress_service.get_summary)."""
        return await (
            self.attempt_collection.find(
                {"user_id": user_id, "mode": "practice", "finished_at": {"$ne": None}}, {"_id": 0}
            )
            .to_list(length=None)
        )

    async def get_practice_stats_by_content_unit(self, user_ids: Optional[List[str]] = None) -> List[dict]:
        """Nota media (ya escalada -- 15 o 70 según details.scale, mismo cálculo que
        ExamService._calculate_score, penalización por fallo incluida) y nº de intentos por
        content_unit_key, agregado sobre TODOS los alumnos (user_ids=None) o un subconjunto
        (alumnos asignados a un profesor) -- base del árbol de Refuerzo. Reutiliza el mismo
        criterio de scope que analytics_repository.get_top_failed_questions."""
        match: dict = {"mode": "practice", "finished_at": {"$ne": None}}
        if user_ids is not None:
            match["user_id"] = {"$in": user_ids}
        pipeline = [
            {"$match": match},
            {
                "$group": {
                    "_id": "$content_unit_key",
                    "avg_score": {"$avg": "$details.final_score"},
                    "scale": {"$first": "$details.scale"},
                    "attempts_count": {"$sum": 1},
                    "distinct_students": {"$addToSet": "$user_id"},
                }
            },
            {"$addFields": {"distinct_students": {"$size": "$distinct_students"}}},
        ]
        return await self.attempt_collection.aggregate(pipeline).to_list(length=None)
