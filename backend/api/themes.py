from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from models.theme import ThemeCreate, ThemeResponse
from services.theme_service import ThemeService
from middleware.auth import get_current_user, require_role

router = APIRouter(prefix="/api/themes", tags=["themes"])
theme_service = ThemeService()

@router.get("/", response_model=List[ThemeResponse])
async def get_themes(
    part: Optional[str] = Query(None, description="Filter by part: GENERAL or SPECIFIC"),
    current_user: dict = Depends(get_current_user)
):
    """Get all themes, optionally filtered by part"""
    themes = theme_service.get_all_themes(part)
    return [ThemeResponse(**theme) for theme in themes]

@router.post("/", response_model=ThemeResponse)
async def create_theme(
    theme_data: ThemeCreate,
    current_user: dict = Depends(require_role(["admin"]))
):
    """Create a new theme (admin only)"""
    theme = theme_service.create_theme(theme_data)
    return ThemeResponse(**theme)

@router.get("/{theme_id}", response_model=ThemeResponse)
async def get_theme(
    theme_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get theme by ID"""
    theme = theme_service.get_theme_by_id(theme_id)
    return ThemeResponse(**theme)