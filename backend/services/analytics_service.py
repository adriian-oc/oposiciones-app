from repositories.analytics_repository import AnalyticsRepository
from repositories.theme_repository import ThemeRepository
from repositories.exam_repository import ExamRepository
from repositories.user_repository import UserRepository
from models.analytics import (
    FailureRecord, FailureAnalytics, StudyPlanItem,
    StudyPlanResponse, OverallStats, TopFailedQuestion
)
from typing import List, Optional
from fastapi import HTTPException, status
import logging

logger = logging.getLogger(__name__)

class AnalyticsService:
    def __init__(self):
        self.analytics_repo = AnalyticsRepository()
        self.theme_repo = ThemeRepository()
        self.exam_repo = ExamRepository()
        self.user_repo = UserRepository()

    async def record_attempt_results(self, attempt_id: str, user_id: str, results: List[dict]) -> None:
        """Process attempt results and record failures and stats"""
        # Group results by theme
        theme_stats = {}

        for result in results:
            # theme_id == "" es válido para Supuestos Prácticos (kind:'numbered', no ligados a
            # un tema SPECIFIC/GENERAL) -- solo se descarta si falta de verdad (None), si no,
            # sus fallos nunca aparecerían en el panel de refuerzo de preguntas más falladas.
            theme_id = result.get("theme_id")
            if theme_id is None:
                continue

            if theme_id not in theme_stats:
                theme_stats[theme_id] = {
                    "correct": 0,
                    "incorrect": 0,
                    "unanswered": 0
                }

            # Record failure if incorrect
            if result["status"] == "incorrect":
                failure = FailureRecord(
                    user_id=user_id,
                    question_id=result["question_id"],
                    question_text=result.get("question_text", ""),
                    choices=result.get("choices", []),
                    theme_id=theme_id,
                    attempt_id=attempt_id,
                    selected_answer=result.get("selected_answer"),
                    correct_answer=result["correct_answer"]
                )
                await self.analytics_repo.record_failure(failure)
                theme_stats[theme_id]["incorrect"] += 1
            elif result["status"] == "correct":
                theme_stats[theme_id]["correct"] += 1
            elif result["status"] == "unanswered":
                theme_stats[theme_id]["unanswered"] += 1

        # Update stats for each theme
        for theme_id, stats in theme_stats.items():
            await self.analytics_repo.update_user_theme_stats(
                user_id=user_id,
                theme_id=theme_id,
                correct=stats["correct"],
                incorrect=stats["incorrect"],
                unanswered=stats["unanswered"]
            )

        logger.info(f"Recorded results for attempt {attempt_id}, user {user_id}")

    async def get_failure_analytics(self, user_id: str, theme_id: Optional[str] = None,
                            top: int = 10) -> List[FailureAnalytics]:
        """Get failure analytics for a user"""
        # Get theme stats
        theme_stats = await self.analytics_repo.get_user_theme_stats(user_id, theme_id)

        # Get failure counts
        failure_stats = await self.analytics_repo.get_failure_stats_by_theme(user_id)
        failure_map = {stat["_id"]: stat for stat in failure_stats}

        analytics = []

        for stat in theme_stats[:top]:
            theme = await self.theme_repo.get_by_id(stat["theme_id"])
            if not theme:
                continue

            failure_info = failure_map.get(stat["theme_id"], {})

            analytics.append(FailureAnalytics(
                theme_id=stat["theme_id"],
                theme_name=theme["name"],
                theme_code=theme["code"],
                failure_count=failure_info.get("failure_count", 0),
                total_attempts=stat["total_questions_attempted"],
                accuracy_rate=stat["accuracy_rate"],
                last_failed_at=failure_info.get("last_failed_at")
            ))

        return analytics

    async def generate_study_plan(self, user_id: str, threshold: float = 70.0,
                          max_themes: int = 10) -> StudyPlanResponse:
        """Generate a personalized study plan based on weak areas"""
        # Get weak themes
        weak_themes = await self.analytics_repo.get_weak_themes(user_id, threshold, max_themes)

        # Get failure counts
        failure_stats = await self.analytics_repo.get_failure_stats_by_theme(user_id)
        failure_map = {stat["_id"]: stat for stat in failure_stats}

        study_items = []

        for idx, weak_theme in enumerate(weak_themes, 1):
            theme = await self.theme_repo.get_by_id(weak_theme["theme_id"])
            if not theme:
                continue

            failure_count = failure_map.get(weak_theme["theme_id"], {}).get("failure_count", 0)

            # Calculate recommended practice count based on accuracy
            # Lower accuracy = more practice needed
            accuracy = weak_theme["accuracy_rate"]
            if accuracy < 40:
                recommended_practice = 20
            elif accuracy < 55:
                recommended_practice = 15
            elif accuracy < 70:
                recommended_practice = 10
            else:
                recommended_practice = 5

            study_items.append(StudyPlanItem(
                theme_id=weak_theme["theme_id"],
                theme_name=theme["name"],
                theme_code=theme["code"],
                priority=idx,
                failure_count=failure_count,
                accuracy_rate=accuracy,
                recommended_practice_count=recommended_practice
            ))

        return StudyPlanResponse(
            user_id=user_id,
            weak_themes=study_items,
            total_weak_areas=len(study_items)
        )

    async def get_top_failed_questions_for_staff(
        self, staff_user: dict, theme_id: Optional[str] = None, limit: int = 20
    ) -> List[TopFailedQuestion]:
        """Panel de refuerzo: preguntas con más fallos. admin ve de todos los alumnos; profesor
        solo de sus alumnos asignados -- mismo criterio de alcance que 'Mis Alumnos' (Fase 5)."""
        user_ids = None
        if staff_user["role"] == "profesor":
            assigned = await self.user_repo.list_by_assigned_profesor(staff_user["id"])
            user_ids = [u["id"] for u in assigned]
            if not user_ids:
                return []
        elif staff_user["role"] != "admin":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized")

        rows = await self.analytics_repo.get_top_failed_questions(theme_id, user_ids, limit)

        theme_cache: dict = {}
        results = []
        for row in rows:
            t_id = row["theme_id"]
            if t_id not in theme_cache:
                theme_cache[t_id] = await self.theme_repo.get_by_id(t_id)
            theme = theme_cache[t_id]
            results.append(TopFailedQuestion(
                question_id=row["_id"],
                question_text=row["question_text"],
                choices=row["choices"],
                correct_answer=row["correct_answer"],
                theme_id=t_id,
                theme_name=theme["name"] if theme else "Sin tema (Supuesto Práctico)",
                theme_code=theme["code"] if theme else "-",
                failure_count=row["failure_count"],
                distinct_students=row["distinct_students"],
                last_failed_at=row.get("last_failed_at"),
            ))
        return results

    async def get_overall_stats(self, user_id: str) -> OverallStats:
        """Get overall statistics for a user"""
        # Get theme-level stats
        theme_level_stats = await self.analytics_repo.get_overall_stats(user_id)

        # Get exam-level stats
        attempts = await self.exam_repo.get_user_attempts(user_id)

        completed_attempts = [a for a in attempts if a.get("finished_at")]
        scores = [a["score"] for a in completed_attempts if a.get("score") is not None]

        # Get weak themes count
        weak_themes = await self.analytics_repo.get_weak_themes(user_id, threshold=70.0)

        return OverallStats(
            user_id=user_id,
            total_exams_completed=len(completed_attempts),
            total_questions_answered=theme_level_stats.get("total_questions", 0),
            total_correct=theme_level_stats.get("total_correct", 0),
            total_incorrect=theme_level_stats.get("total_incorrect", 0),
            total_unanswered=theme_level_stats.get("total_unanswered", 0),
            overall_accuracy=round(theme_level_stats.get("avg_accuracy", 0.0), 2),
            average_score=round(sum(scores) / len(scores), 2) if scores else 0.0,
            best_score=round(max(scores), 2) if scores else 0.0,
            weak_themes_count=len(weak_themes)
        )
