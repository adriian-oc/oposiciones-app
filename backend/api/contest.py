from fastapi import APIRouter, Depends, Request, status

from models.contest import ContestSignupCreate
from services.contest_service import ContestService
from middleware.auth import get_current_user, require_role
from utils.rate_limit import limiter

router = APIRouter(prefix="/api/contest", tags=["contest"])


def get_service():
    return ContestService()


@router.get("/config")
async def get_contest_config():
    """Público -- fechas, plazas y contenido del concurso, para pintar la cuenta atrás y las
    reglas en la landing sin necesidad de haber iniciado sesión."""
    return await get_service().get_config()


@router.post("/signup", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
async def signup_for_contest(request: Request, data: ContestSignupCreate):
    """Inscripción pública y automática (a diferencia de /api/access-requests, no pasa por
    revisión manual del admin): crea la cuenta al momento con acceso restringido al contenido
    del concurso y manda el email de bienvenida con el enlace para fijar contraseña."""
    return await get_service().signup(data)


@router.get("/my-entry")
async def get_my_contest_entry(current_user: dict = Depends(get_current_user)):
    """Si el usuario logueado participa en el concurso, devuelve su inscripción; si no, null --
    el frontend lo usa para decidir si mostrar la pestaña Ranking."""
    return await get_service().get_my_entry(current_user["id"])


@router.get("/ranking")
async def get_contest_ranking(current_user: dict = Depends(get_current_user)):
    """Ranking del concurso -- sin emails (ni para el propio participante, salvo staff), solo
    nombre y nota, para no exponer datos de otros participantes."""
    is_staff = current_user["role"] in ("admin", "profesor")
    return await get_service().get_ranking(viewer_user_id=current_user["id"], reveal_emails=is_staff)


@router.get("/admin")
async def get_contest_admin_summary(current_user: dict = Depends(require_role(["admin"]))):
    """Panel de Admin: config completa + ranking con emails, para gestionar premios a mano."""
    return await get_service().get_admin_summary()
