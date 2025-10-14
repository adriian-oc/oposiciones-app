from repositories.exam_repository import ExamRepository
from repositories.question_repository import QuestionRepository
from models.exam import (
    ExamCreate, ExamInDB, QuestionSnapshot, 
    AttemptStart, AttemptInDB, AnswerSubmit
)
from typing import List, Dict, Any
from fastapi import HTTPException, status
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class ExamService:
    def __init__(self):
        self.exam_repo = ExamRepository()
        self.question_repo = QuestionRepository()
    
    def generate_exam(self, exam_data: ExamCreate, user_id: str) -> dict:
        """Generate an exam by selecting random questions from specified themes"""
        
        # Validate theme_ids
        if not exam_data.theme_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one theme must be specified"
            )
        
        # Get random questions from themes
        questions = self.question_repo.get_random_by_themes(
            exam_data.theme_ids,
            exam_data.question_count
        )
        
        if len(questions) < exam_data.question_count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Not enough questions available. Found {len(questions)}, requested {exam_data.question_count}"
            )
        
        # Create snapshots of questions
        question_snapshots = []
        for q in questions:
            snapshot = QuestionSnapshot(
                question_id=q["id"],
                text=q["text"],
                choices=q["choices"],
                correct_answer=q["correct_answer"],
                theme_id=q["theme_id"]
            )
            question_snapshots.append(snapshot)
        
        # Create exam
        exam = ExamInDB(
            type=exam_data.type,
            name=exam_data.name,
            theme_ids=exam_data.theme_ids,
            questions=question_snapshots,
            created_by=user_id
        )
        
        created_exam = self.exam_repo.create_exam(exam)
        
        return {
            "id": created_exam.id,
            "type": created_exam.type,
            "name": created_exam.name,
            "theme_ids": created_exam.theme_ids,
            "question_count": len(created_exam.questions),
            "created_at": created_exam.created_at
        }
    
    def get_exam(self, exam_id: str) -> dict:
        """Get exam details"""
        exam = self.exam_repo.get_exam_by_id(exam_id)
        if not exam:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exam not found"
            )
        return exam
    
    def start_attempt(self, exam_id: str, user_id: str) -> dict:
        """Start a new exam attempt"""
        exam = self.exam_repo.get_exam_by_id(exam_id)
        if not exam:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exam not found"
            )
        
        attempt = AttemptInDB(
            exam_id=exam_id,
            user_id=user_id
        )
        
        created_attempt = self.exam_repo.create_attempt(attempt)
        
        return {
            "id": created_attempt.id,
            "exam_id": created_attempt.exam_id,
            "started_at": created_attempt.started_at,
            "exam": exam
        }
    
    def submit_answer(self, attempt_id: str, answer: AnswerSubmit, user_id: str) -> dict:
        """Submit an answer for a question in an attempt"""
        attempt = self.exam_repo.get_attempt_by_id(attempt_id)
        if not attempt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attempt not found"
            )
        
        if attempt["user_id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized"
            )
        
        if attempt.get("finished_at"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Attempt already finished"
            )
        
        # Update answers
        answers = attempt.get("answers", {})
        answers[answer.question_id] = answer.selected_answer
        
        self.exam_repo.update_attempt(attempt_id, {"answers": answers})
        
        return {"message": "Answer recorded", "question_id": answer.question_id}
    
    def finish_attempt(self, attempt_id: str, user_id: str) -> dict:
        """Finish attempt and calculate score"""
        attempt = self.exam_repo.get_attempt_by_id(attempt_id)
        if not attempt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attempt not found"
            )
        
        if attempt["user_id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized"
            )
        
        if attempt.get("finished_at"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Attempt already finished"
            )
        
        # Get exam
        exam = self.exam_repo.get_exam_by_id(attempt["exam_id"])
        if not exam:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exam not found"
            )
        
        # Calculate score
        score_result = self._calculate_score(exam["questions"], attempt.get("answers", {}))
        
        # Update attempt
        update_data = {
            "finished_at": datetime.utcnow(),
            "score": score_result["final_score"],
            "details": score_result
        }
        
        self.exam_repo.update_attempt(attempt_id, update_data)
        
        return {
            "attempt_id": attempt_id,
            "score": score_result["final_score"],
            "details": score_result
        }
    
    def _calculate_score(self, questions: List[dict], answers: Dict[str, Any]) -> dict:
        """Calculate exam score based on rules: +1 correct, -0.25 incorrect, 0 unanswered"""
        total_questions = len(questions)
        correct = 0
        incorrect = 0
        unanswered = 0
        results = []
        
        for question in questions:
            question_id = question["question_id"]
            correct_answer = question["correct_answer"]
            selected_answer = answers.get(question_id)
            
            is_correct = False
            status = "unanswered"
            
            if selected_answer is None:
                unanswered += 1
                status = "unanswered"
            elif selected_answer == correct_answer:
                correct += 1
                is_correct = True
                status = "correct"
            else:
                incorrect += 1
                status = "incorrect"
            
            results.append({
                "question_id": question_id,
                "question_text": question["text"],
                "selected_answer": selected_answer,
                "correct_answer": correct_answer,
                "is_correct": is_correct,
                "status": status
            })
        
        # Calculate raw score
        raw_score = (correct * 1.0) + (incorrect * -0.25)
        raw_score = max(raw_score, 0)  # Non-negative
        
        # Scale to 70 points (as per requirements)
        final_score = (raw_score / total_questions) * 70 if total_questions > 0 else 0
        
        return {
            "total_questions": total_questions,
            "correct": correct,
            "incorrect": incorrect,
            "unanswered": unanswered,
            "raw_score": raw_score,
            "final_score": round(final_score, 2),
            "results": results
        }
    
    def get_attempt_results(self, attempt_id: str, user_id: str) -> dict:
        """Get attempt results"""
        attempt = self.exam_repo.get_attempt_by_id(attempt_id)
        if not attempt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attempt not found"
            )
        
        if attempt["user_id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized"
            )
        
        return attempt