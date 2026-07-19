from fastapi import APIRouter, Depends, HTTPException, status

from models.auth import LoginRequest, TokenResponse, ResetPasswordRequest
from models.user import UserResponse, UserUpdate, SelfProfileUpdate
from middleware.auth import get_current_user
from repositories.user_repository import UserRepository
from services.auth_service import (
    verify_password,
    create_access_token,
    hash_password,
    hash_reset_token,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest):
    user_repo = UserRepository()
    user = await user_repo.get_by_email(data.email)
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Correo o contraseña incorrectos")
    return TokenResponse(access_token=create_access_token(user["id"]))


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest):
    """Fija una contraseña nueva a partir de un enlace de un solo uso generado por un admin
    (ver POST /api/admin/students/{id}/send-password-reset) -- público, la identidad la aporta
    el propio token, no una sesión."""
    if len(data.new_password) < 8:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La contraseña debe tener al menos 8 caracteres")

    user_repo = UserRepository()
    user = await user_repo.get_by_reset_token_hash(hash_reset_token(data.token))
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Enlace no válido o caducado")

    await user_repo.set_password_hash(user["id"], hash_password(data.new_password))
    return {"message": "Contraseña actualizada"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse(**current_user)


@router.patch("/me", response_model=UserResponse)
async def update_own_profile(data: SelfProfileUpdate, current_user: dict = Depends(get_current_user)):
    """Autoservicio: cualquier usuario autenticado edita su propio nombre y perfil -- el resto
    del roster (role/revoked/allowed_content/...) sigue siendo solo-admin vía
    PATCH /api/admin/students/{id}."""
    user_repo = UserRepository()
    update = UserUpdate(**data.model_dump(exclude_unset=True))
    updated = await user_repo.update_fields(current_user["id"], update)
    return UserResponse(**updated)
