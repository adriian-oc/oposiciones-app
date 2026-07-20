from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class NotificationInDB(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str  # 'content_access' | 'document_pending' | 'access_request_pending'
    title: str
    message: str
    link: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    read_at: Optional[datetime] = None

class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    link: str
    created_at: datetime
