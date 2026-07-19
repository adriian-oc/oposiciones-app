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

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()