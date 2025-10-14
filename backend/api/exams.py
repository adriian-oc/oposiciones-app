from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from models.exam import ExamCreate, ExamResponse, AttemptStart, AnswerSubmit, AttemptResponse
from services.exam_service import ExamService
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/exams", tags=["exams"])
exam_service = ExamService()

@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_exam(
    exam_data: ExamCreate,
    current_user: dict = Depends(get_current_user)
):
    """Generate a new exam with random questions from selected themes"""
    exam = exam_service.generate_exam(exam_data, current_user["id"])
    return exam

@router.get("/{exam_id}")
async def get_exam(
    exam_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get exam details"""
    exam = exam_service.get_exam(exam_id)
    return exam

@router.post("/start", status_code=status.HTTP_201_CREATED)
async def start_attempt(
    attempt_data: AttemptStart,
    current_user: dict = Depends(get_current_user)
):
    """Start a new exam attempt"""
    attempt = exam_service.start_attempt(attempt_data.exam_id, current_user["id"])
    return attempt

@router.post("/attempts/{attempt_id}/answer")
async def submit_answer(
    attempt_id: str,
    answer: AnswerSubmit,
    current_user: dict = Depends(get_current_user)
):
    """Submit an answer for a question in an attempt"""
    result = exam_service.submit_answer(attempt_id, answer, current_user["id"])
    return result

@router.post("/attempts/{attempt_id}/finish")
async def finish_attempt(
    attempt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Finish attempt and get results"""
    result = exam_service.finish_attempt(attempt_id, current_user["id"])
    return result

@router.get("/attempts/{attempt_id}/results")
async def get_attempt_results(
    attempt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get attempt results"""
    result = exam_service.get_attempt_results(attempt_id, current_user["id"])
    return result