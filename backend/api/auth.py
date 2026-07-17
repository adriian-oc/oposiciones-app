from fastapi import APIRouter, Depends
from models.user import UserResponse
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

# La identidad (registro/login) vive en Firebase Auth, no aquí -- el frontend habla
# directamente con el SDK de Firebase (ver frontend/src/services/authService.js) y solo
# manda el ID token resultante al backend. /register y /login (JWT propio con bcrypt) se
# retiran para no mantener dos sistemas de auth en paralelo.


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse(**current_user)
