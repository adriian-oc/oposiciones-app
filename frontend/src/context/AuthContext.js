import React, { createContext, useState, useContext, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Al montar (login persistido tras recargar la página), si hay un token guardado se
    // comprueba que siga siendo válido pidiendo el perfil; si no, no hay sesión que resolver.
    const bootstrap = async () => {
      if (authService.getToken()) {
        try {
          const userData = await authService.getCurrentUser();
          setUser(userData);
        } catch (err) {
          setUser(null);
        }
      }
      setLoading(false);
    };
    bootstrap();
  }, []);

  const login = async (credentials) => {
    const userData = await authService.login(credentials);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  // Tras editar el propio perfil (MiPerfil.js) hace falta refrescar el user en contexto para que
  // el resto de la app (p.ej. la puerta de perfil obligatorio en PrivateRoute) vea los datos ya
  // completos sin necesidad de recargar la página.
  const refreshUser = async () => {
    const userData = await authService.getCurrentUser();
    setUser(userData);
    return userData;
  };

  const value = {
    user,
    login,
    logout,
    refreshUser,
    isAuthenticated: !!user,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
