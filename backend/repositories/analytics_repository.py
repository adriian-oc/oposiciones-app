from config.database import get_database
from models.analytics import FailureRecord, UserThemeStats
from typing import List, Optional, Dict
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class AnalyticsRepository:
    def __init__(self):
        self.db = get_database()
        self.failures_collection = self.db.analytics_failures
        self.stats_collection = self.db.user_theme_stats
    
    def record_failure(self, failure: FailureRecord) -> None:
        """Record a failed question answer"""
        failure_dict = failure.model_dump()
        self.failures_collection.insert_one(failure_dict)
        logger.info(f"Failure recorded for user {failure.user_id} on theme {failure.theme_id}")
    
    def get_user_failures_by_theme(self, user_id: str, theme_id: Optional[str] = None) -> List[dict]:
        """Get user's failures, optionally filtered by theme"""
        query = {"user_id": user_id}
        if theme_id:
            query["theme_id"] = theme_id
        
        failures = list(
            self.failures_collection.find(query, {"_id": 0})
            .sort("failed_at", -1)
        )
        return failures
    
    def get_failure_stats_by_theme(self, user_id: str) -> List[Dict]:
        """Aggregate failure statistics by theme"""
        pipeline = [
            {"$match": {"user_id": user_id}},
            {
                "$group": {
                    "_id": "$theme_id",
                    "failure_count": {"$sum": 1},
                    "last_failed_at": {"$max": "$failed_at"}
                }
            },
            {"$sort": {"failure_count": -1}}
        ]
        
        stats = list(self.failures_collection.aggregate(pipeline))
        return stats
    
    def update_user_theme_stats(self, user_id: str, theme_id: str, 
                                correct: int, incorrect: int, unanswered: int) -> None:
        """Update or create user theme statistics"""
        existing_stats = self.stats_collection.find_one({
            "user_id": user_id,
            "theme_id": theme_id
        })
        
        if existing_stats:
            # Update existing stats
            new_total = existing_stats["total_questions_attempted"] + correct + incorrect + unanswered
            new_correct = existing_stats["correct_answers"] + correct
            new_incorrect = existing_stats["incorrect_answers"] + incorrect
            new_unanswered = existing_stats["unanswered"] + unanswered
            
            accuracy = (new_correct / new_total * 100) if new_total > 0 else 0.0
            
            self.stats_collection.update_one(
                {"user_id": user_id, "theme_id": theme_id},
                {
                    "$set": {
                        "total_questions_attempted": new_total,
                        "correct_answers": new_correct,
                        "incorrect_answers": new_incorrect,
                        "unanswered": new_unanswered,
                        "accuracy_rate": round(accuracy, 2),
                        "last_updated": datetime.utcnow()
                    }
                }
            )
        else:
            # Create new stats
            total = correct + incorrect + unanswered
            accuracy = (correct / total * 100) if total > 0 else 0.0
            
            stats = UserThemeStats(
                user_id=user_id,
                theme_id=theme_id,
                total_questions_attempted=total,
                correct_answers=correct,
                incorrect_answers=incorrect,
                unanswered=unanswered,
                accuracy_rate=round(accuracy, 2)
            )
            
            self.stats_collection.insert_one(stats.model_dump())
        
        logger.info(f"Updated stats for user {user_id} on theme {theme_id}")
    
    def get_user_theme_stats(self, user_id: str, theme_id: Optional[str] = None) -> List[dict]:
        """Get user's statistics by theme"""
        query = {"user_id": user_id}
        if theme_id:
            query["theme_id"] = theme_id
        
        stats = list(
            self.stats_collection.find(query, {"_id": 0})
            .sort("accuracy_rate", 1)  # Worst accuracy first
        )
        return stats
    
    def get_weak_themes(self, user_id: str, threshold: float = 70.0, limit: int = 10) -> List[dict]:
        """Get themes where user has low accuracy (below threshold)"""
        query = {
            "user_id": user_id,
            "accuracy_rate": {"$lt": threshold},
            "total_questions_attempted": {"$gte": 3}  # At least 3 questions attempted
        }
        
        weak_themes = list(
            self.stats_collection.find(query, {"_id": 0})
            .sort("accuracy_rate", 1)
            .limit(limit)
        )
        return weak_themes
    
    def get_overall_stats(self, user_id: str) -> Dict:
        """Get overall statistics for a user"""
        pipeline = [
            {"$match": {"user_id": user_id}},
            {
                "$group": {
                    "_id": None,
                    "total_questions": {"$sum": "$total_questions_attempted"},
                    "total_correct": {"$sum": "$correct_answers"},
                    "total_incorrect": {"$sum": "$incorrect_answers"},
                    "total_unanswered": {"$sum": "$unanswered"},
                    "avg_accuracy": {"$avg": "$accuracy_rate"}
                }
            }
        ]
        
        result = list(self.stats_collection.aggregate(pipeline))
        
        if result:
            return result[0]
        
        return {
            "total_questions": 0,
            "total_correct": 0,
            "total_incorrect": 0,
            "total_unanswered": 0,
            "avg_accuracy": 0.0
        }
