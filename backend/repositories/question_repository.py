from config.database import get_database
from models.question import QuestionInDB, QuestionCreate
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

class QuestionRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.questions

    async def create(self, question_data: QuestionCreate, created_by: str) -> QuestionInDB:
        question = QuestionInDB(**question_data.model_dump(), created_by=created_by)
        question_dict = question.model_dump()
        await self.collection.insert_one(question_dict)
        logger.info(f"Question created: {question.id}")
        return question

    async def get_by_id(self, question_id: str) -> Optional[dict]:
        return await self.collection.find_one({"id": question_id}, {"_id": 0})

    async def get_all(
        self,
        theme_id: Optional[str] = None,
        limit: int = 100,
        skip: int = 0,
        content_area: Optional[str] = None,
    ) -> List[dict]:
        query = {}
        if theme_id:
            query["theme_id"] = theme_id
        if content_area:
            query["content_area"] = content_area

        return await (
            self.collection.find(query, {"_id": 0})
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
            .to_list(length=limit)
        )

    async def update(self, question_id: str, question_data: dict) -> bool:
        result = await self.collection.update_one(
            {"id": question_id},
            {"$set": question_data}
        )
        return result.modified_count > 0

    async def append_edit_history(self, question_id: str, entry: dict) -> None:
        from models.question import QuestionEditHistoryEntry
        await self.collection.update_one(
            {"id": question_id},
            {"$push": {"edit_history": QuestionEditHistoryEntry(**entry).model_dump()}},
        )

    async def delete(self, question_id: str) -> bool:
        result = await self.collection.delete_one({"id": question_id})
        return result.deleted_count > 0

    async def get_random_by_themes(self, theme_ids: List[str], count: int) -> List[dict]:
        """Get random questions from specified themes"""
        pipeline = [
            {"$match": {"theme_id": {"$in": theme_ids}}},
            {"$sample": {"size": count}},
            {"$project": {"_id": 0}}
        ]
        return await self.collection.aggregate(pipeline).to_list(length=count)

    async def bulk_create(self, questions: List[QuestionInDB]):
        """Bulk insert questions"""
        if questions:
            question_docs = [q.model_dump() for q in questions]
            await self.collection.insert_many(question_docs)
            logger.info(f"Bulk created {len(question_docs)} questions")

    async def count_by_theme(self, theme_id: str) -> int:
        return await self.collection.count_documents({"theme_id": theme_id})

    async def count_by_theme_grouped(self, content_area: str) -> dict:
        """Nº de preguntas por tema para un área de contenido, en una sola query -- evita N+1
        desde Cuadernos.js al decidir qué temas de Test de Teoría son practicables."""
        pipeline = [
            {"$match": {"content_area": content_area}},
            {"$group": {"_id": "$theme_id", "count": {"$sum": 1}}},
        ]
        rows = await self.collection.aggregate(pipeline).to_list(length=None)
        return {row["_id"]: row["count"] for row in rows}
