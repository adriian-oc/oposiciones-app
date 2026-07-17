from fastapi import HTTPException, status

from repositories.user_repository import UserRepository
from repositories.exam_repository import ExamRepository
from repositories.progress_repository import ProgressRepository
from services.admin_service import _has_novedades


class ProfesorService:
    def __init__(self):
        self.user_repo = UserRepository()
        self.exam_repo = ExamRepository()
        self.progress_repo = ProgressRepository()

    def list_my_students(self, profesor_id: str) -> list:
        students = self.user_repo.list_by_assigned_profesor(profesor_id)
        result = []
        for s in students:
            attempts = [a for a in self.exam_repo.get_user_attempts(s["id"]) if a.get("finished_at")]
            scores = [a["score"] for a in attempts if a.get("score") is not None]
            progress = self.progress_repo.get_by_user(s["id"])
            result.append({
                **s,
                "attempts_count": len(attempts),
                "average_score": round(sum(scores) / len(scores), 2) if scores else None,
                "last_activity": attempts[0]["started_at"] if attempts else None,
                "has_novedades": _has_novedades(s, progress, profesor_id),
            })
        return result

    def get_student_progress(self, student_id: str, profesor_id: str, is_admin: bool = False) -> dict:
        student = self.user_repo.get_by_id(student_id)
        if not student:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
        if not is_admin and student.get("assigned_profesor_id") != profesor_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")
        attempts = self.exam_repo.get_user_attempts(student_id)
        return {"student": student, "attempts": attempts}
