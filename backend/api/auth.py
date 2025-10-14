from fastapi import APIRouter, Depends, HTTPException, status
from models.user import UserCreate, UserLogin, Token, UserResponse
from services.auth_service import AuthService
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

def get_auth_service():
    return AuthService()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    """Register a new user"""
    auth_service = get_auth_service()
    user = auth_service.register(user_data)
    return UserResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at
    )

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    """Login and get access token"""
    return auth_service.login(credentials)

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse(**current_user)