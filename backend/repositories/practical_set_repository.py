from config.database import get_database
from models.practical_set import PracticalSetInDB, PracticalSetCreate, PracticalSetQuestionInDB
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

class PracticalSetRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.practical_sets
    
    def create(self, practical_set_data: PracticalSetCreate, created_by: str) -> PracticalSetInDB:
        """Create a new practical set"""
        # Convert questions to InDB format
        questions_in_db = [
            PracticalSetQuestionInDB(**q.model_dump())
            for q in practical_set_data.questions
        ]
        
        practical_set = PracticalSetInDB(
            title=practical_set_data.title,
            description=practical_set_data.description,
            theme_ids=practical_set_data.theme_ids,
            questions=questions_in_db,
            created_by=created_by
        )
        
        practical_set_dict = practical_set.model_dump()
        self.collection.insert_one(practical_set_dict)
        logger.info(f"Practical set created: {practical_set.id}")
        return practical_set
    
    def get_by_id(self, practical_set_id: str) -> Optional[dict]:
        """Get practical set by ID"""
        return self.collection.find_one(
            {"id": practical_set_id, "is_active": True},
            {"_id": 0}
        )
    
    def get_all(self, skip: int = 0, limit: int = 50) -> List[dict]:
        """Get all practical sets"""
        practical_sets = list(
            self.collection.find({"is_active": True}, {"_id": 0})
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )
        return practical_sets
    
    def get_by_theme(self, theme_id: str) -> List[dict]:
        """Get practical sets that include a specific theme"""
        practical_sets = list(
            self.collection.find(
                {"theme_ids": theme_id, "is_active": True},
                {"_id": 0}
            ).sort("created_at", -1)
        )
        return practical_sets
    
    def get_random(self, count: int = 1) -> List[dict]:
        """Get random practical sets"""
        pipeline = [
            {"$match": {"is_active": True}},
            {"$sample": {"size": count}},
            {"$project": {"_id": 0}}
        ]
        practical_sets = list(self.collection.aggregate(pipeline))
        return practical_sets
    
    def update(self, practical_set_id: str, update_data: dict) -> bool:
        """Update a practical set"""
        result = self.collection.update_one(
            {"id": practical_set_id},
            {"$set": update_data}
        )
        return result.modified_count > 0
    
    def soft_delete(self, practical_set_id: str) -> bool:
        """Soft delete a practical set"""
        result = self.collection.update_one(
            {"id": practical_set_id},
            {"$set": {"is_active": False}}
        )
        return result.modified_count > 0
    
    def count(self) -> int:
        """Count active practical sets"""
        return self.collection.count_documents({"is_active": True})
