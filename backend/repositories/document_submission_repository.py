from config.database import get_database
from models.document_submission import DocumentSubmissionInDB
from typing import List, Optional
from datetime import datetime, timezone

class DocumentSubmissionRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.document_submissions

    async def create(self, doc: DocumentSubmissionInDB) -> DocumentSubmissionInDB:
        await self.collection.insert_one(doc.model_dump())
        return doc

    async def get_by_id(self, doc_id: str) -> Optional[dict]:
        return await self.collection.find_one({"id": doc_id}, {"_id": 0})

    async def list_by_status(self, status: str) -> List[dict]:
        return await self.collection.find({"status": status}, {"_id": 0}).sort("created_at", -1).to_list(length=None)

    async def list_by_uploader(self, uploaded_by: str) -> List[dict]:
        return await self.collection.find({"uploaded_by": uploaded_by}, {"_id": 0}).sort("created_at", -1).to_list(length=None)

    async def list_approved_by_uploader(self, uploaded_by: str) -> List[dict]:
        return await self.collection.find(
            {"uploaded_by": uploaded_by, "status": "approved"}, {"_id": 0}
        ).to_list(length=None)

    async def update_status(self, doc_id: str, status: str, reviewed_by: str) -> Optional[dict]:
        await self.collection.update_one(
            {"id": doc_id},
            {"$set": {"status": status, "reviewed_by": reviewed_by, "reviewed_at": datetime.now(timezone.utc)}},
        )
        return await self.get_by_id(doc_id)
