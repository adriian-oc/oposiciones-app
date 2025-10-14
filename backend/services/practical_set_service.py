from repositories.practical_set_repository import PracticalSetRepository
from repositories.theme_repository import ThemeRepository
from models.practical_set import PracticalSetCreate, PracticalSetInDB
from typing import List, Optional
from fastapi import HTTPException, status
import logging

logger = logging.getLogger(__name__)

class PracticalSetService:
    def __init__(self):
        self.practical_set_repo = PracticalSetRepository()
        self.theme_repo = ThemeRepository()
    
    def create_practical_set(self, practical_set_data: PracticalSetCreate, user_id: str) -> dict:
        """Create a new practical set"""
        # Validate themes exist
        for theme_id in practical_set_data.theme_ids:
            theme = self.theme_repo.get_by_id(theme_id)
            if not theme:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Theme {theme_id} not found"
                )
        
        # Create practical set
        practical_set = self.practical_set_repo.create(practical_set_data, user_id)
        
        return {
            "id": practical_set.id,
            "title": practical_set.title,
            "description": practical_set.description,
            "theme_ids": practical_set.theme_ids,
            "question_count": len(practical_set.questions),
            "created_by": practical_set.created_by,
            "created_at": practical_set.created_at
        }
    
    def get_practical_set(self, practical_set_id: str) -> dict:
        """Get a practical set by ID"""
        practical_set = self.practical_set_repo.get_by_id(practical_set_id)
        if not practical_set:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Practical set not found"
            )
        return practical_set
    
    def get_all_practical_sets(self, skip: int = 0, limit: int = 50) -> List[dict]:
        """Get all practical sets (summary)"""
        practical_sets = self.practical_set_repo.get_all(skip, limit)
        
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
    
    def get_by_theme(self, theme_id: str) -> List[dict]:
        """Get practical sets by theme"""
        practical_sets = self.practical_set_repo.get_by_theme(theme_id)
        
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
    
    def get_random_practical_set(self) -> dict:
        """Get a random practical set for exam"""
        practical_sets = self.practical_set_repo.get_random(1)
        
        if not practical_sets:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No practical sets available"
            )
        
        return practical_sets[0]
    
    def delete_practical_set(self, practical_set_id: str) -> bool:
        """Soft delete a practical set"""
        success = self.practical_set_repo.soft_delete(practical_set_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Practical set not found"
            )
        return success
