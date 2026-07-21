import { resolveFileUrl } from './fileUrl';

export function avatarUrl(user) {
  return resolveFileUrl(user?.avatar_path);
}
