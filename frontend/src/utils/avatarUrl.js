const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

// avatar_path se guarda relativo ("avatars/<uuid>.jpg"), servido desde /uploads -- mismo patrón
// que documentService.js (ver backend/services/avatar_service.py).
export function avatarUrl(user) {
  return user?.avatar_path ? `${API_BASE_URL}/uploads/${user.avatar_path}` : null;
}
