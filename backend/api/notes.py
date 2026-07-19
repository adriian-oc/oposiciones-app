from fastapi import APIRouter, Depends
from typing import List, Optional

from models.note import NoteUpsert, NoteResponse
from services.note_service import NoteService
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/notes", tags=["notes"])


@router.get("/", response_model=List[NoteResponse])
async def list_my_notes(current_user: dict = Depends(get_current_user)):
    return await NoteService().get_by_user(current_user["id"])


@router.get("/{content_unit_key}/{case_index}", response_model=Optional[NoteResponse])
async def get_note(content_unit_key: str, case_index: int, current_user: dict = Depends(get_current_user)):
    return await NoteService().get_one(current_user["id"], content_unit_key, case_index)


@router.put("/{content_unit_key}/{case_index}", response_model=Optional[NoteResponse])
async def save_note(
    content_unit_key: str,
    case_index: int,
    body: NoteUpsert,
    current_user: dict = Depends(get_current_user),
):
    return await NoteService().upsert(current_user["id"], content_unit_key, case_index, body.text, body.label)
