"""
Marca como NEW los content_units de PDF descargable afectados por una actualización de
temario, y opcionalmente envía un aviso (campanita) a todos los alumnos.

Uso:
  cd backend && source venv/bin/activate
  python ../scripts/mark_temario_novedad.py                 # solo marca NEW (idempotente)
  python ../scripts/mark_temario_novedad.py --notify         # además notifica a los alumnos

Apunta a la base de datos de MONGO_URL/MONGO_DB_NAME de backend/.env -- para producción,
usar las credenciales reales de producción en ese .env (o exportarlas en el entorno) antes de
ejecutar, nunca escribirlas en este script.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from config.database import connect_to_mongo  # noqa: E402
from repositories.theme_repository import ThemeRepository  # noqa: E402
from repositories.content_unit_repository import ContentUnitRepository  # noqa: E402
from services.notification_service import NotificationService  # noqa: E402

# tema_code -> (mensaje breve para la notificación)
AFFECTED = {
    "SPECIFIC_4": "Tema 4 (Cotización): nuevo convenio especial para recuperar cotización por prácticas anteriores a 2024.",
    "SPECIFIC_12": "Tema 12 (IMV): reforma de la Ley 1/2026 (revisión de la unidad de convivencia y doble actualización anual).",
}


async def main():
    notify = "--notify" in sys.argv
    await connect_to_mongo()

    theme_repo = ThemeRepository()
    unit_repo = ContentUnitRepository()

    marked = []
    for code in AFFECTED:
        theme = await theme_repo.get_by_code(code)
        if not theme:
            print(f"AVISO: no existe el tema {code}, se omite")
            continue
        await unit_repo.set_is_new("tesp", theme["id"], True)
        marked.append(theme["name"])
        print(f"Marcado NEW: {theme['name']} (tesp)")

    if not marked:
        print("Nada que marcar, saliendo sin notificar.")
        return

    if notify:
        notif_service = NotificationService()
        title = "Temario actualizado"
        message = "Se ha actualizado el temario: " + " ".join(AFFECTED.values())
        count = await notif_service.notify_all_students(
            "content_update", title, message, "/cuadernos"
        )
        print(f"Notificados {count} alumnos.")
    else:
        print("(no se ha notificado a los alumnos -- pasa --notify para avisarles)")


if __name__ == "__main__":
    asyncio.run(main())
