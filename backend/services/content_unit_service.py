from repositories.content_unit_repository import ContentUnitRepository
from typing import List

class ContentUnitService:
    def __init__(self):
        self.repo = ContentUnitRepository()

    def get_by_area(self, area_id: str) -> List[dict]:
        return self.repo.get_by_area(area_id)
