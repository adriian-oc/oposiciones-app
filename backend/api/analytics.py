from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from models.analytics import FailureAnalytics, StudyPlanResponse, OverallStats
from services.analytics_service import AnalyticsService
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

def get_analytics_service():
    return AnalyticsService()

@router.get("/failures", response_model=List[FailureAnalytics])
async def get_failure_analytics(
    theme_id: Optional[str] = Query(None, description="Filter by theme ID"),
    top: int = Query(10, ge=1, le=50, description="Top N themes to return"),
    current_user: dict = Depends(get_current_user)
):
    """Get failure analytics for current user"""
    service = get_analytics_service()
    analytics = service.get_failure_analytics(current_user["id"], theme_id, top)
    return analytics

@router.get("/study-plan", response_model=StudyPlanResponse)
async def generate_study_plan(
    threshold: float = Query(70.0, ge=0, le=100, description="Accuracy threshold for weak themes"),
    max_themes: int = Query(10, ge=1, le=20, description="Maximum themes in study plan"),
    current_user: dict = Depends(get_current_user)
):
    """Generate personalized study plan based on weak areas"""
    service = get_analytics_service()
    study_plan = service.generate_study_plan(current_user["id"], threshold, max_themes)
    return study_plan

@router.get("/overall-stats", response_model=OverallStats)
async def get_overall_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get overall statistics for current user"""
    service = get_analytics_service()
    stats = service.get_overall_stats(current_user["id"])
    return stats
