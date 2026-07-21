const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

// Archivos subidos (avatares, documentos de profesor, adjuntos de chat) se guardan ahora en
// Cloudflare R2 -- el backend devuelve la URL pública completa (ver StorageService.save). Los
// que se guardaron ANTES de esa migración, o los que se guardan en desarrollo local sin cuenta
// de R2, siguen siendo una ruta relativa ("avatars/<uuid>.jpg") servida desde /uploads.
export function resolveFileUrl(value) {
  if (!value) return null;
  return value.startsWith('http') ? value : `${API_BASE_URL}/uploads/${value}`;
}
