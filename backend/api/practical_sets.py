from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from models.practical_set import (
    PracticalSetCreate, PracticalSetResponse, PracticalSetDetailResponse
)
from services.practical_set_service import PracticalSetService
from middleware.auth import get_current_user, require_role

router = APIRouter(prefix="/api/practical-sets", tags=["practical-sets"])

def get_practical_set_service():
    return PracticalSetService()

@router.post("/", response_model=PracticalSetResponse, status_code=status.HTTP_201_CREATED)
async def create_practical_set(
    practical_set_data: PracticalSetCreate,
    current_user: dict = Depends(require_role(["admin", "curator"]))
):
    """Create a new practical set (admin/curator only)"""
    service = get_practical_set_service()
    practical_set = service.create_practical_set(practical_set_data, current_user["id"])
    return PracticalSetResponse(**practical_set)

@router.get("/", response_model=List[PracticalSetResponse])
async def get_practical_sets(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get all practical sets (summary)"""
    service = get_practical_set_service()
    practical_sets = service.get_all_practical_sets(skip, limit)
    return [PracticalSetResponse(**ps) for ps in practical_sets]

@router.get("/by-theme/{theme_id}", response_model=List[PracticalSetResponse])
async def get_practical_sets_by_theme(
    theme_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get practical sets by theme"""
    service = get_practical_set_service()
    practical_sets = service.get_by_theme(theme_id)
    return [PracticalSetResponse(**ps) for ps in practical_sets]

@router.get("/{practical_set_id}", response_model=PracticalSetDetailResponse)
async def get_practical_set(
    practical_set_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get practical set details with all questions"""
    service = get_practical_set_service()
    practical_set = service.get_practical_set(practical_set_id)
    return PracticalSetDetailResponse(**practical_set)

@router.get("/random/one", response_model=PracticalSetDetailResponse)
async def get_random_practical_set(
    current_user: dict = Depends(get_current_user)
):
    """Get a random practical set for exam"""
    service = get_practical_set_service()
    practical_set = service.get_random_practical_set()
    return PracticalSetDetailResponse(**practical_set)

@router.delete("/{practical_set_id}")
async def delete_practical_set(
    practical_set_id: str,
    current_user: dict = Depends(require_role(["admin", "curator"]))
):
    """Delete a practical set (admin/curator only)"""
    service = get_practical_set_service()
    success = service.delete_practical_set(practical_set_id)
    return {"message": "Practical set deleted successfully", "success": success}
