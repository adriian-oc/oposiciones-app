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
    
    def create_exam(self, exam: ExamInDB) -> ExamInDB:
        exam_dict = exam.model_dump()
        self.exam_collection.insert_one(exam_dict)
        logger.info(f"Exam created: {exam.id}")
        return exam
    
    def get_exam_by_id(self, exam_id: str) -> Optional[dict]:
        return self.exam_collection.find_one({"id": exam_id}, {"_id": 0})
    
    def get_exams_by_user(self, user_id: str, limit: int = 50) -> List[dict]:
        return list(
            self.exam_collection.find({"created_by": user_id}, {"_id": 0})
            .sort("created_at", -1)
            .limit(limit)
        )
    
    # Attempts
    def create_attempt(self, attempt: AttemptInDB) -> AttemptInDB:
        attempt_dict = attempt.model_dump()
        self.attempt_collection.insert_one(attempt_dict)
        logger.info(f"Attempt created: {attempt.id}")
        return attempt
    
    def get_attempt_by_id(self, attempt_id: str) -> Optional[dict]:
        return self.attempt_collection.find_one({"id": attempt_id}, {"_id": 0})
    
    def update_attempt(self, attempt_id: str, update_data: dict) -> bool:
        result = self.attempt_collection.update_one(
            {"id": attempt_id},
            {"$set": update_data}
        )
        return result.modified_count > 0
    
    def get_attempts_by_user(self, user_id: str, limit: int = 50) -> List[dict]:
        return list(
            self.attempt_collection.find({"user_id": user_id}, {"_id": 0})
            .sort("started_at", -1)
            .limit(limit)
        )