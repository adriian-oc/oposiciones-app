import React from 'react';
import { avatarUrl } from '../utils/avatarUrl';

const SIZES = { sm: 'h-8 w-8 text-xs', md: 'h-12 w-12 text-sm', lg: 'h-24 w-24 text-2xl' };

// Foto de perfil si hay, si no un círculo con la inicial -- mismo componente para header,
// roster y Mi Perfil, así el criterio de "quién tiene foto" no se repite en cada sitio.
const Avatar = ({ user, size = 'sm', className = '' }) => {
  const url = avatarUrl(user);
  const sizeClass = SIZES[size] || SIZES.sm;
  const initial = (user?.display_name || '?').trim().charAt(0).toUpperCase();

  if (url) {
    return (
      <img
        src={url}
        alt={user?.display_name || 'Avatar'}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold flex-shrink-0 ${className}`}
    >
      {initial}
    </span>
  );
};

export default Avatar;
