from datetime import datetime
from typing import List

from config.database import get_database
from models.notification import NotificationInDB

class NotificationRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.notifications

    async def create(self, notification: NotificationInDB) -> NotificationInDB:
        await self.collection.insert_one(notification.model_dump())
        return notification

    async def get_unread(self, user_id: str) -> List[dict]:
        return await (
            self.collection.find({"user_id": user_id, "read_at": None}, {"_id": 0})
            .sort("created_at", -1)
            .to_list(length=None)
        )

    async def mark_read(self, notification_id: str, user_id: str) -> None:
        await self.collection.update_one(
            {"id": notification_id, "user_id": user_id},
            {"$set": {"read_at": datetime.utcnow()}},
        )
