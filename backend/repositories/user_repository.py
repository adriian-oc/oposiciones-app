from config.database import get_database
from models.user import UserInDB, UserCreate, UserUpdate
from typing import List, Optional
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

class UserRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.users

    async def create_with_password(self, user_data: UserCreate, password_hash: str) -> UserInDB:
        user = UserInDB(
            email=user_data.email,
            display_name=user_data.display_name,
            role=user_data.role,
            password_hash=password_hash,
            expires_at=user_data.expires_at,
            allowed_content=user_data.allowed_content,
            profile=user_data.profile,
        )
        await self.collection.insert_one(user.model_dump())
        logger.info(f"User created: {user.email}")
        return user

    async def get_by_email(self, email: str) -> Optional[dict]:
        return await self.collection.find_one({"email": email}, {"_id": 0})

    async def get_by_id(self, user_id: str) -> Optional[dict]:
        return await self.collection.find_one({"id": user_id}, {"_id": 0})

    async def get_by_reset_token_hash(self, token_hash: str) -> Optional[dict]:
        return await self.collection.find_one(
            {
                "password_reset_token_hash": token_hash,
                "password_reset_expires": {"$gt": datetime.now(timezone.utc)},
            },
            {"_id": 0},
        )

    async def set_reset_token(self, user_id: str, token_hash: str, expires: datetime) -> None:
        await self.collection.update_one(
            {"id": user_id},
            {"$set": {"password_reset_token_hash": token_hash, "password_reset_expires": expires}},
        )

    async def set_password_hash(self, user_id: str, password_hash: str) -> None:
        # Limpia el token de reset a la vez que fija la contraseña nueva -- así un token ya
        # usado no se puede reutilizar (es de un solo uso).
        await self.collection.update_one(
            {"id": user_id},
            {
                "$set": {"password_hash": password_hash},
                "$unset": {"password_reset_token_hash": "", "password_reset_expires": ""},
            },
        )

    async def set_avatar_path(self, user_id: str, avatar_path: str) -> None:
        await self.collection.update_one({"id": user_id}, {"$set": {"avatar_path": avatar_path}})

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
