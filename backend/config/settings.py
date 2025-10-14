from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    mongo_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 43200
    
    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()