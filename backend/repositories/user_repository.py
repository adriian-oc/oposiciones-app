from config.database import get_database
from models.user import UserInDB, UserCreate, UserUpdate
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

class UserRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.users

    async def create_from_firebase(self, user_data: UserCreate, firebase_uid: str) -> UserInDB:
        user = UserInDB(
            email=user_data.email,
            display_name=user_data.display_name,
            role=user_data.role,
            firebase_uid=firebase_uid,
        )
        await self.collection.insert_one(user.model_dump())
        logger.info(f"User created: {user.email} (firebase_uid={firebase_uid})")
        return user

    async def get_by_email(self, email: str) -> Optional[dict]:
        return await self.collection.find_one({"email": email}, {"_id": 0})

    async def get_by_id(self, user_id: str) -> Optional[dict]:
        return await self.collection.find_one({"id": user_id}, {"_id": 0})

    async def get_by_firebase_uid(self, firebase_uid: str) -> Optional[dict]:
        return await self.collection.find_one({"firebase_uid": firebase_uid}, {"_id": 0})

    async def email_exists(self, email: str) -> bool:
        return await self.collection.find_one({"email": email}) is not None

    async def list_all(self) -> List[dict]:
        return await self.collection.find({}, {"_id": 0}).to_list(length=None)

    async def list_by_assigned_profesor(self, profesor_id: str) -> List[dict]:
        return await self.collection.find({"assigned_profesor_id": profesor_id}, {"_id": 0}).to_list(length=None)

    async def update_fields(self, user_id: str, update: UserUpdate) -> Optional[dict]:
        # exclude_unset ya distingue "no venía en el payload" de "venía explícitamente a None" --
        # NO filtrar además los None, porque allowed_content=None es un valor legítimo (acceso
        # completo) que un admin debe poder volver a poner tras haber restringido antes.
        fields = update.model_dump(exclude_unset=True)
        if not fields:
            return await self.get_by_id(user_id)
        await self.collection.update_one({"id": user_id}, {"$set": fields})
        return await self.get_by_id(user_id)

    async def set_revoked(self, user_id: str, revoked: bool) -> Optional[dict]:
        await self.collection.update_one({"id": user_id}, {"$set": {"revoked": revoked}})
        return await self.get_by_id(user_id)

    async def mark_reviewed_by(self, student_id: str, staff_id: str, when) -> None:
        await self.collection.update_one(
            {"id": student_id}, {"$set": {f"last_reviewed_by.{staff_id}": when}}
        )

    async def delete(self, user_id: str) -> None:
        await self.collection.delete_one({"id": user_id})
