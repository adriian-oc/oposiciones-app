from models.notification import NotificationInDB
from repositories.notification_repository import NotificationRepository
from repositories.user_repository import UserRepository

class NotificationService:
    def __init__(self):
        self.repo = NotificationRepository()
        self.user_repo = UserRepository()

    async def notify(self, user_id: str, type: str, title: str, message: str, link: str) -> None:
        await self.repo.create(NotificationInDB(user_id=user_id, type=type, title=title, message=message, link=link))

    async def notify_admins(self, type: str, title: str, message: str, link: str) -> None:
        """Un aviso por cada admin -- no hay un único "buzón de administración", cada admin
        tiene su propia campanita."""
        admins = [u for u in await self.user_repo.list_all() if u.get("role") == "admin"]
        for admin in admins:
            await self.notify(admin["id"], type, title, message, link)

    async def notify_all_students(self, type: str, title: str, message: str, link: str) -> int:
        """Difusión masiva (p.ej. novedad de temario) a todos los alumnos no revocados.
        Devuelve el número de alumnos avisados."""
        students = [
            u for u in await self.user_repo.list_all()
            if u.get("role") == "student" and not u.get("revoked")
        ]
        for student in students:
            await self.notify(student["id"], type, title, message, link)
        return len(students)

    async def get_unread(self, user_id: str) -> list:
        return await self.repo.get_unread(user_id)

    async def mark_read(self, notification_id: str, user_id: str) -> None:
        await self.repo.mark_read(notification_id, user_id)
