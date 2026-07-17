from config.database import get_database
from models.user import UserInDB, UserCreate, UserUpdate
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

class UserRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.users

    def create_from_firebase(self, user_data: UserCreate, firebase_uid: str) -> UserInDB:
        user = UserInDB(
            email=user_data.email,
            display_name=user_data.display_name,
            role=user_data.role,
            firebase_uid=firebase_uid,
        )
        self.collection.insert_one(user.model_dump())
        logger.info(f"User created: {user.email} (firebase_uid={firebase_uid})")
        return user

    def get_by_email(self, email: str) -> Optional[dict]:
        return self.collection.find_one({"email": email}, {"_id": 0})

    def get_by_id(self, user_id: str) -> Optional[dict]:
        return self.collection.find_one({"id": user_id}, {"_id": 0})

    def get_by_firebase_uid(self, firebase_uid: str) -> Optional[dict]:
        return self.collection.find_one({"firebase_uid": firebase_uid}, {"_id": 0})

    def email_exists(self, email: str) -> bool:
        return self.collection.find_one({"email": email}) is not None

    def list_all(self) -> List[dict]:
        return list(self.collection.find({}, {"_id": 0}))

    def list_by_assigned_profesor(self, profesor_id: str) -> List[dict]:
        return list(self.collection.find({"assigned_profesor_id": profesor_id}, {"_id": 0}))

    def update_fields(self, user_id: str, update: UserUpdate) -> Optional[dict]:
        fields = {k: v for k, v in update.model_dump(exclude_unset=True).items() if v is not None}
        if not fields:
            return self.get_by_id(user_id)
        self.collection.update_one({"id": user_id}, {"$set": fields})
        return self.get_by_id(user_id)

    def set_revoked(self, user_id: str, revoked: bool) -> Optional[dict]:
        self.collection.update_one({"id": user_id}, {"$set": {"revoked": revoked}})
        return self.get_by_id(user_id)

    def mark_reviewed_by(self, student_id: str, staff_id: str, when) -> None:
        self.collection.update_one(
            {"id": student_id}, {"$set": {f"last_reviewed_by.{staff_id}": when}}
        )

    def delete(self, user_id: str) -> None:
        self.collection.delete_one({"id": user_id})
