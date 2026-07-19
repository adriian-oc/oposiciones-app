import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">Acceso Denegado</h2>
          <p className="mt-2 text-gray-600">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  // Un alumno con el perfil incompleto (sin nombre o fecha de nacimiento) no puede usar el
  // resto de la app hasta completarlo -- se le manda a /mi-perfil en vez de a cualquier ruta
  // pedida. useLocation() evita el bucle: la propia ruta /mi-perfil nunca se redirige a sí misma.
  const profileIncomplete = user.role === 'student' && (!user.profile?.full_name || !user.profile?.birth_date);
  if (profileIncomplete && location.pathname !== '/mi-perfil') {
    return <Navigate to="/mi-perfil" state={{ mandatory: true }} />;
  }

  return children;
};

export default PrivateRoute;