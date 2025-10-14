from repositories.analytics_repository import AnalyticsRepository
from repositories.theme_repository import ThemeRepository
from repositories.exam_repository import ExamRepository
from models.analytics import (
    FailureRecord, FailureAnalytics, StudyPlanItem, 
    StudyPlanResponse, OverallStats
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
    
    def record_attempt_results(self, attempt_id: str, user_id: str, results: List[dict]) -> None:
        """Process attempt results and record failures and stats"""
        # Group results by theme
        theme_stats = {}
        
        for result in results:
            theme_id = result.get("theme_id")
            if not theme_id:
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
                    theme_id=theme_id,
                    attempt_id=attempt_id,
                    selected_answer=result.get("selected_answer"),
                    correct_answer=result["correct_answer"]
                )
                self.analytics_repo.record_failure(failure)
                theme_stats[theme_id]["incorrect"] += 1
            elif result["status"] == "correct":
                theme_stats[theme_id]["correct"] += 1
            elif result["status"] == "unanswered":
                theme_stats[theme_id]["unanswered"] += 1
        
        # Update stats for each theme
        for theme_id, stats in theme_stats.items():
            self.analytics_repo.update_user_theme_stats(
                user_id=user_id,
                theme_id=theme_id,
                correct=stats["correct"],
                incorrect=stats["incorrect"],
                unanswered=stats["unanswered"]
            )
        
        logger.info(f"Recorded results for attempt {attempt_id}, user {user_id}")
    
    def get_failure_analytics(self, user_id: str, theme_id: Optional[str] = None, 
                            top: int = 10) -> List[FailureAnalytics]:
        """Get failure analytics for a user"""
        # Get theme stats
        theme_stats = self.analytics_repo.get_user_theme_stats(user_id, theme_id)
        
        # Get failure counts
        failure_stats = self.analytics_repo.get_failure_stats_by_theme(user_id)
        failure_map = {stat["_id"]: stat for stat in failure_stats}
        
        analytics = []
        
        for stat in theme_stats[:top]:
            theme = self.theme_repo.get_by_id(stat["theme_id"])
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
    
    def generate_study_plan(self, user_id: str, threshold: float = 70.0, 
                          max_themes: int = 10) -> StudyPlanResponse:
        """Generate a personalized study plan based on weak areas"""
        # Get weak themes
        weak_themes = self.analytics_repo.get_weak_themes(user_id, threshold, max_themes)
        
        # Get failure counts
        failure_stats = self.analytics_repo.get_failure_stats_by_theme(user_id)
        failure_map = {stat["_id"]: stat for stat in failure_stats}
        
        study_items = []
        
        for idx, weak_theme in enumerate(weak_themes, 1):
            theme = self.theme_repo.get_by_id(weak_theme["theme_id"])
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
    
    def get_overall_stats(self, user_id: str) -> OverallStats:
        """Get overall statistics for a user"""
        # Get theme-level stats
        theme_level_stats = self.analytics_repo.get_overall_stats(user_id)
        
        # Get exam-level stats
        attempts = self.exam_repo.get_user_attempts(user_id)
        
        completed_attempts = [a for a in attempts if a.get("finished_at")]
        scores = [a["score"] for a in completed_attempts if a.get("score") is not None]
        
        # Get weak themes count
        weak_themes = self.analytics_repo.get_weak_themes(user_id, threshold=70.0)
        
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
