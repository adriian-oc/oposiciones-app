from config.database import get_database
from models.theme import ThemeInDB, ThemeCreate
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

class ThemeRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.themes
    
    def create(self, theme_data: ThemeCreate) -> ThemeInDB:
        theme = ThemeInDB(**theme_data.model_dump())
        theme_dict = theme.model_dump()
        self.collection.insert_one(theme_dict)
        logger.info(f"Theme created: {theme.code}")
        return theme
    
    def get_all(self, part: Optional[str] = None) -> List[dict]:
        query = {}
        if part:
            query["part"] = part
        
        themes = list(self.collection.find(query, {"_id": 0}).sort("order", 1))
        return themes
    
    def get_by_id(self, theme_id: str) -> Optional[dict]:
        return self.collection.find_one({"id": theme_id}, {"_id": 0})
    
    def get_by_code(self, code: str) -> Optional[dict]:
        return self.collection.find_one({"code": code}, {"_id": 0})
    
    def bulk_create(self, themes: List[ThemeCreate]):
        theme_docs = [ThemeInDB(**t.model_dump()).model_dump() for t in themes]
        if theme_docs:
            self.collection.insert_many(theme_docs)
            logger.info(f"Bulk created {len(theme_docs)} themes")