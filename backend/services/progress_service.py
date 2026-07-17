from datetime import datetime, date, timedelta
import logging

from repositories.progress_repository import ProgressRepository

logger = logging.getLogger(__name__)


class ProgressService:
    def __init__(self):
        self.progress_repo = ProgressRepository()

    def get_progress(self, user_id: str) -> dict:
        existing = self.progress_repo.get_by_user(user_id)
        return existing or {
            "user_id": user_id,
            "content_scores": {},
            "streak": {"count": 0, "last_active_date": None},
            "updated_at": None,
        }

    def record_practice_result(self, user_id: str, content_unit_key: str, correct: int, total: int) -> None:
        """Rollup de lectura rápida para 'Mi Progreso', escrito como efecto secundario de
        finish_attempt (mismo patrón que analytics_service.record_attempt_results) -- no es una
        segunda fuente de verdad, `attempts` sigue siendo el detalle completo."""
        existing = self.progress_repo.get_by_user(user_id) or {}
        content_scores = existing.get("content_scores", {})
        pct = round((correct / total) * 100, 2) if total else 0.0
        content_scores[content_unit_key] = {
            "correct": correct,
            "total": total,
            "pct": pct,
            "updated_at": datetime.utcnow(),
        }

        streak = self._advance_streak(existing.get("streak", {}))

        self.progress_repo.upsert(user_id, {
            "user_id": user_id,
            "content_scores": content_scores,
            "streak": streak,
            "updated_at": datetime.utcnow(),
        })

    @staticmethod
    def _advance_streak(streak: dict) -> dict:
        today = date.today()
        last_active_raw = streak.get("last_active_date")
        last_active = None
        if isinstance(last_active_raw, str):
            last_active = date.fromisoformat(last_active_raw)
        elif isinstance(last_active_raw, date):
            last_active = last_active_raw

        count = streak.get("count", 0)
        if last_active == today:
            pass  # ya contaba hoy, no se incrementa dos veces
        elif last_active == today - timedelta(days=1):
            count += 1
        else:
            count = 1

        return {"count": count, "last_active_date": today.isoformat()}
