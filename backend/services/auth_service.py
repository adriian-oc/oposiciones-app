from repositories.user_repository import UserRepository
from models.user import UserCreate, UserLogin, UserInDB, Token
from utils.security import verify_password, create_access_token
from fastapi import HTTPException, status
from datetime import timedelta
from config.settings import settings
import logging

logger = logging.getLogger(__name__)

class AuthService:
    def __init__(self):
        self.user_repo = UserRepository()
    
    def register(self, user_data: UserCreate) -> UserInDB:
        # Check if email already exists
        if self.user_repo.email_exists(user_data.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        user = self.user_repo.create(user_data)
        return user
    
    def login(self, credentials: UserLogin) -> Token:
        user = self.user_repo.get_by_email(credentials.email)
        
        if not user or not verify_password(credentials.password, user["hashed_password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        
        if not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user"
            )
        
        access_token_expires = timedelta(minutes=settings.jwt_access_token_expire_minutes)
        access_token = create_access_token(
            data={"sub": user["email"], "role": user["role"]},
            expires_delta=access_token_expires
        )
        
        return Token(access_token=access_token, token_type="bearer")