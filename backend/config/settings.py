from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    mongo_url: str
    mongo_db_name: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 43200

    # Base del frontend, para construir enlaces de restablecimiento de contraseña que el admin
    # comparte manualmente con el usuario.
    frontend_base_url: str = "http://localhost:3000"

    # Avisos por email de mensajes nuevos (ver services/email_service.py). Sin API key, el envío
    # se omite silenciosamente -- no bloquea el flujo de mensajería en local/desarrollo.
    brevo_api_key: str = ""
    brevo_sender_email: str = "oposicionesadoc@gmail.com"
    brevo_sender_name: str = "ADOC"

    # Almacenamiento persistente de archivos (avatares, documentos de profesor, adjuntos de
    # chat) en Cloudflare R2 -- reemplaza el disco local de backend/uploads/, que en Render se
    # borra en cada reinicio/sueño del servicio (ver services/storage_service.py). Sin
    # r2_account_id configurado, los servicios de subida caen de vuelta al disco local (por si
    # se quiere seguir desarrollando sin cuenta de R2).
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "adoc-uploads"
    r2_public_url: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()