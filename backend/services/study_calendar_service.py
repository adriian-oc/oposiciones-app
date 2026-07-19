import logging
from datetime import date, timedelta
from itertools import cycle
from typing import List, Optional

from fastapi import HTTPException, status

from models.study_calendar import (
    WEEKDAYS, StudyPreferencesUpdate, StudyPreferencesInDB, StudyCalendarEntryInDB,
)
from repositories.study_calendar_repository import StudyCalendarRepository
from repositories.practical_set_repository import PracticalSetRepository
from repositories.progress_repository import ProgressRepository
from repositories.theme_repository import ThemeRepository
from services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)

DAYS_AHEAD = 14
BLOCK_MINUTES = 45
MAX_CANDIDATES_PER_THEME = 2
MAX_REPEATS_PER_CANDIDATE = 3


class StudyCalendarService:
    def __init__(self):
        self.repo = StudyCalendarRepository()
        self.practical_set_repo = PracticalSetRepository()
        self.analytics_service = AnalyticsService()

    async def get_preferences(self, user_id: str) -> dict:
        prefs = await self.repo.get_preferences(user_id)
        return prefs or {"user_id": user_id, "hours_per_day": {d: 0 for d in WEEKDAYS}, "updated_at": None}

    async def set_preferences(self, user_id: str, update: StudyPreferencesUpdate) -> dict:
        merged = {d: 0 for d in WEEKDAYS}
        existing = await self.repo.get_preferences(user_id)
        if existing:
            merged.update(existing.get("hours_per_day", {}))
        merged.update(update.hours_per_day)

        prefs = StudyPreferencesInDB(user_id=user_id, hours_per_day=merged)
        await self.repo.upsert_preferences(prefs)
        await self.regenerate_calendar(user_id)
        return prefs.model_dump()

    async def get_calendar(self, user_id: str, days: int = DAYS_AHEAD) -> List[dict]:
        start = date.today().isoformat()
        end = (date.today() + timedelta(days=days)).isoformat()
        return await self.repo.get_entries(user_id, start, end)

    async def complete_entry(self, entry_id: str, user_id: str) -> dict:
        entry = await self.repo.get_entry(entry_id, user_id)
        if not entry:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found")
        await self.repo.set_entry_status(entry_id, user_id, "done")
        entry["status"] = "done"
        return entry

    async def regenerate_calendar(self, user_id: str) -> int:
        """(Re)genera las próximas DAYS_AHEAD entradas pendientes según las horas disponibles
        del alumno y sus temas más débiles -- se llama al guardar preferencias, y también como
        efecto secundario best-effort tras cada práctica terminada (ver exam_service), para que
        el calendario 'se actualice automático' según van cambiando los fallos reales."""
        prefs = await self.repo.get_preferences(user_id)
        if not prefs or not any(h > 0 for h in prefs.get("hours_per_day", {}).values()):
            # sin horas configuradas todavía, no hay nada que generar
            return 0

        queue = await self._build_priority_queue(user_id)
        if not queue:
            return 0
        queue_cycle = cycle(queue)

        today = date.today()
        entries: List[StudyCalendarEntryInDB] = []
        for offset in range(DAYS_AHEAD):
            day = today + timedelta(days=offset)
            weekday = WEEKDAYS[day.weekday()]
            hours = prefs["hours_per_day"].get(weekday, 0)
            blocks = int((hours * 60) // BLOCK_MINUTES)
            for _ in range(blocks):
                item = next(queue_cycle)
                entries.append(StudyCalendarEntryInDB(
                    user_id=user_id,
                    date=day.isoformat(),
                    content_unit_key=item["content_unit_key"],
                    theme_id=item["theme_id"],
                    title=item["title"],
                    allocated_minutes=BLOCK_MINUTES,
                    priority_reason=item["priority_reason"],
                    kind=item["kind"],
                ))

        await self.repo.replace_future_pending_entries(user_id, today.isoformat(), entries)
        return len(entries)

    async def _build_priority_queue(self, user_id: str) -> List[dict]:
        """Combina repasos ya vencidos (repetición espaciada real, ver ProgressService._sm2_update)
        con contenido nuevo o débil, intercalados ~2:1 -- prioriza lo que está a punto de
        olvidarse sin dejar de introducir material nuevo (mismo equilibrio entre "reviews" y
        "new cards" por día que usan las apps de repetición espaciada)."""
        review_items = await self._build_review_queue(user_id)
        reviewed_keys = {i["content_unit_key"] for i in review_items}
        new_items = await self._build_new_queue(user_id, exclude_keys=reviewed_keys)

        if not review_items:
            return new_items
        if not new_items:
            return review_items

        queue: List[dict] = []
        ri = ni = 0
        while ri < len(review_items) or ni < len(new_items):
            for _ in range(2):
                if ri < len(review_items):
                    queue.append(review_items[ri])
                    ri += 1
            if ni < len(new_items):
                queue.append(new_items[ni])
                ni += 1
        return queue

    async def _build_review_queue(self, user_id: str) -> List[dict]:
        """Unidades cuyo próximo repaso (SM-2) ya ha vencido, más atrasadas primero."""
        progress = await ProgressRepository().get_by_user(user_id)
        if not progress:
            return []
        today = date.today().isoformat()
        due = [
            (key, score) for key, score in (progress.get("content_scores") or {}).items()
            if score.get("next_review_date") and score["next_review_date"] <= today
        ]
        due.sort(key=lambda kv: kv[1]["next_review_date"])

        items: List[dict] = []
        for key, score in due:
            resolved = await self._resolve_content_unit(key)
            if not resolved:
                continue
            interval = score.get("interval_days", 1)
            items.append({
                "content_unit_key": key,
                "theme_id": resolved["theme_id"],
                "title": resolved["title"],
                "priority_reason": f"Repaso programado -- te toca cada {interval} día{'s' if interval != 1 else ''}",
                "kind": "review",
            })
        return items

    async def _resolve_content_unit(self, content_unit_key: str) -> Optional[dict]:
        """content_unit_key es el id de un practical_set (Cuadernillos/Supuestos), o
        '<area_id>:<theme_id>' para una práctica de Test de Teoría (ver ExamService)."""
        if ":" in content_unit_key:
            area_id, theme_id = content_unit_key.split(":", 1)
            theme = await ThemeRepository().get_by_id(theme_id)
            if not theme:
                return None
            area_label = "Test de Teoría" if area_id in ("ttesp", "ttgen") else area_id
            return {"theme_id": theme_id, "title": f"{area_label} — {theme['name']}"}
        ps = await self.practical_set_repo.get_by_id(content_unit_key)
        if not ps:
            return None
        return {"theme_id": (ps["theme_ids"][0] if ps["theme_ids"] else None), "title": ps["title"]}

    async def _build_new_queue(self, user_id: str, exclude_keys: set) -> List[dict]:
        """Contenido nuevo o con accuracy baja, repitiendo los temas más débiles para que
        aparezcan más veces al hacer round-robin sobre los días disponibles."""
        queue: List[dict] = []
        used_ps_ids: set = set()

        try:
            study_plan = await self.analytics_service.generate_study_plan(user_id, threshold=70.0, max_themes=10)
            weak_items = study_plan.weak_themes
        except Exception as e:
            logger.error(f"No se pudo calcular el plan de estudio para {user_id}: {e}")
            weak_items = []

        for item in weak_items:
            practical_sets = await self.practical_set_repo.get_by_theme(item.theme_id)
            practical_sets = practical_sets[:MAX_CANDIDATES_PER_THEME]
            repeats = min(MAX_REPEATS_PER_CANDIDATE, max(1, item.recommended_practice_count // 5))
            for ps in practical_sets:
                used_ps_ids.add(ps["id"])
                if ps["id"] in exclude_keys:
                    continue
                for _ in range(repeats):
                    queue.append({
                        "content_unit_key": ps["id"],
                        "theme_id": item.theme_id,
                        "title": ps["title"],
                        "priority_reason": f"Tema con más fallos ({round(item.accuracy_rate)}% de acierto)",
                        "kind": "new",
                    })

        # Alumno nuevo sin fallos todavía, o pocos temas débiles: completar con cobertura general
        # para que el calendario nunca quede vacío.
        if len(queue) < DAYS_AHEAD:
            all_sets = await self.practical_set_repo.get_all(skip=0, limit=200)
            for ps in all_sets:
                if ps["id"] in used_ps_ids or ps["id"] in exclude_keys:
                    continue
                queue.append({
                    "content_unit_key": ps["id"],
                    "theme_id": (ps["theme_ids"][0] if ps["theme_ids"] else None),
                    "title": ps["title"],
                    "priority_reason": "Repaso general",
                    "kind": "new",
                })

        return queue
