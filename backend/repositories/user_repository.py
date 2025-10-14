from config.database import get_database
from models.user import UserInDB, UserCreate
from utils.security import get_password_hash
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class UserRepository:
    def __init__(self):
        self.db = get_database()
        self.collection = self.db.users
    
    def create(self, user_data: UserCreate) -> UserInDB:
        user = UserInDB(
            email=user_data.email,
            display_name=user_data.display_name,
            role=user_data.role,
            hashed_password=get_password_hash(user_data.password)
        )
        
        user_dict = user.model_dump()
        self.collection.insert_one(user_dict)
        logger.info(f"User created: {user.email}")
        return user
    
    def get_by_email(self, email: str) -> Optional[dict]:
        return self.collection.find_one({"email": email}, {"_id": 0})
    
    def get_by_id(self, user_id: str) -> Optional[dict]:
        return self.collection.find_one({"id": user_id}, {"_id": 0})
    
    def email_exists(self, email: str) -> bool:
        return self.collection.find_one({"email": email}) is not None