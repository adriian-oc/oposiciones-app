import logging
import re
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

logger = logging.getLogger(__name__)

DAYS_AHEAD = 14
BLOCK_MINUTES = 45

# Los temas generales están divididos en dos bloques oficiales del temario (13 + el resto) --
# misma frontera que usa la progresión de contenido nuevo (ver _build_new_queue). El número de
# temas específicos/generales en sí NUNCA se hardcodea: se lee de la colección `themes`.
GENERAL_BLOCK_1_SIZE = 13

# Mismo criterio que el frontend para distinguir Cuadernillos de Supuestos sueltos dentro de
# `practical_sets` (ver frontend/src/utils/contentAccessUnits.js) -- no hay un campo `category`
# separado en el modelo, la convención vive en el título.
CUADERNILLO_PREFIX = "Cuadernillo"
SUPUESTO_RE = re.compile(r"^Supuesto\s+(\d+)", re.IGNORECASE)


class StudyCalendarService:
    def __init__(self):
        self.repo = StudyCalendarRepository()
        self.practical_set_repo = PracticalSetRepository()
        self.theme_repo = ThemeRepository()

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
        """Progresión fija de contenido nuevo (a diferencia del repaso SM-2, que sí prioriza por
        fallos reales): primero una lectura comprensiva de 1 tema/día (todos los específicos +
        el primer bloque de 13 generales, una sola vez en la vida del alumno), y luego un ciclo
        que se repite para siempre: específicos (cuadernillo+supuesto) -> generales bloque 1
        (test de Teoría+supuesto) -> 2ª vuelta de específicos -> resto de generales -> se repite
        desde el principio del ciclo (nunca se repite la lectura). El propio itertools.cycle()
        de regenerate_calendar se encarga de repetir el ciclo indefinidamente con la misma lista;
        por eso aquí no hay que filtrar el ciclo por "ya practicado alguna vez", solo la lectura."""
        specific_themes = await self.theme_repo.get_all(part="SPECIFIC")
        general_themes = await self.theme_repo.get_all(part="GENERAL")
        general_block_1 = general_themes[:GENERAL_BLOCK_1_SIZE]
        general_rest = general_themes[GENERAL_BLOCK_1_SIZE:]

        cuadernillo_by_theme, supuestos_pool = await self._load_practical_set_pools()
        done_reading_theme_ids = await self.repo.get_completed_reading_theme_ids(user_id)

        queue: List[dict] = []
        suelto_idx = 0

        def next_suelto() -> Optional[dict]:
            nonlocal suelto_idx
            for _ in range(len(supuestos_pool)):
                ps = supuestos_pool[suelto_idx % len(supuestos_pool)]
                suelto_idx += 1
                if ps["id"] not in exclude_keys:
                    return ps
            return None

        for theme in specific_themes + general_block_1:
            if theme["id"] in done_reading_theme_ids:
                continue
            queue.append({
                "content_unit_key": None,
                "theme_id": theme["id"],
                "title": f"Lectura comprensiva — {theme['name']}",
                "priority_reason": "Primera pasada de lectura antes de empezar a practicar",
                "kind": "reading",
            })

        def add_specific_round(themes: List[dict]) -> None:
            for theme in themes:
                cuad = cuadernillo_by_theme.get(theme["id"])
                if cuad and cuad["id"] not in exclude_keys:
                    queue.append({
                        "content_unit_key": cuad["id"],
                        "theme_id": theme["id"],
                        "title": cuad["title"],
                        "priority_reason": "Progresión del temario específico",
                        "kind": "new",
                    })
                suelto = next_suelto()
                if suelto:
                    queue.append({
                        "content_unit_key": suelto["id"],
                        "theme_id": None,
                        "title": suelto["title"],
                        "priority_reason": "Progresión del temario específico",
                        "kind": "new",
                    })

        def add_general_round(themes: List[dict]) -> None:
            for theme in themes:
                key = f"ttgen:{theme['id']}"
                if key not in exclude_keys:
                    queue.append({
                        "content_unit_key": key,
                        "theme_id": theme["id"],
                        "title": f"Test de Teoría — {theme['name']}",
                        "priority_reason": "Progresión del temario general",
                        "kind": "new",
                    })
                suelto = next_suelto()
                if suelto:
                    queue.append({
                        "content_unit_key": suelto["id"],
                        "theme_id": None,
                        "title": suelto["title"],
                        "priority_reason": "Progresión del temario general",
                        "kind": "new",
                    })

        add_specific_round(specific_themes)
        add_general_round(general_block_1)
        add_specific_round(specific_themes)
        add_general_round(general_rest)

        return queue

    async def _load_practical_set_pools(self) -> tuple:
        """Separa los practical_sets en cuadernillos (uno por tema específico) y supuestos
        sueltos (sin theme_id, banco numerado), con el mismo criterio de título que usa el
        frontend (ver frontend/src/utils/contentAccessUnits.js) -- no hay campo `category`."""
        all_sets = await self.practical_set_repo.get_all(skip=0, limit=500)
        cuadernillo_by_theme: dict = {}
        supuestos_pool: List[dict] = []
        for ps in all_sets:
            if ps["title"].startswith(CUADERNILLO_PREFIX):
                if ps["theme_ids"]:
                    cuadernillo_by_theme.setdefault(ps["theme_ids"][0], ps)
            else:
                match = SUPUESTO_RE.match(ps["title"])
                if match:
                    supuestos_pool.append((int(match.group(1)), ps))
        supuestos_pool.sort(key=lambda pair: pair[0])
        return cuadernillo_by_theme, [ps for _, ps in supuestos_pool]
