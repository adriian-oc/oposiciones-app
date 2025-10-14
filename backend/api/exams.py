from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List
from models.exam import ExamCreate, ExamResponse, AttemptStart, AnswerSubmit, AttemptResponse
from services.exam_service import ExamService
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/exams", tags=["exams"])

def get_exam_service():
    return ExamService()

@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_exam(
    exam_data: ExamCreate,
    current_user: dict = Depends(get_current_user)
):
    """Generate a new exam with random questions from selected themes"""
    exam_service = get_exam_service()
    exam = exam_service.generate_exam(exam_data, current_user["id"])
    return exam

@router.get("/history")
async def get_exam_history(
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get user's exam history"""
    exam_service = get_exam_service()
    history = exam_service.get_user_exam_history(current_user["id"], limit)
    return {"history": history, "total": len(history)}

@router.get("/{exam_id}")
async def get_exam(
    exam_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get exam details"""
    exam_service = get_exam_service()
    exam = exam_service.get_exam(exam_id)
    return exam

@router.post("/start", status_code=status.HTTP_201_CREATED)
async def start_attempt(
    attempt_data: AttemptStart,
    current_user: dict = Depends(get_current_user)
):
    """Start a new exam attempt"""
    exam_service = get_exam_service()
    attempt = exam_service.start_attempt(attempt_data.exam_id, current_user["id"])
    return attempt

@router.post("/attempts/{attempt_id}/answer")
async def submit_answer(
    attempt_id: str,
    answer: AnswerSubmit,
    current_user: dict = Depends(get_current_user)
):
    """Submit an answer for a question in an attempt"""
    exam_service = get_exam_service()
    result = exam_service.submit_answer(attempt_id, answer, current_user["id"])
    return result

@router.post("/attempts/{attempt_id}/finish")
async def finish_attempt(
    attempt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Finish attempt and get results"""
    exam_service = get_exam_service()
    result = exam_service.finish_attempt(attempt_id, current_user["id"])
    return result

@router.get("/attempts/{attempt_id}/results")
async def get_attempt_results(
    attempt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get attempt results"""
    exam_service = get_exam_service()
    result = exam_service.get_attempt_results(attempt_id, current_user["id"])
    return result