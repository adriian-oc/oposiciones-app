import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Fuente única de los enlaces del nav -- se pintan tanto en la barra de escritorio como en el
  // menú desplegable de móvil, evitando duplicar el JSX (y el bug de solapamiento que tenía la
  // barra fija original en pantallas estrechas, ver mejoras post-migración).
  const navLinks = [
    { to: '/', label: 'Inicio', show: true, exact: true },
    { to: '/exams/new', label: 'Exámenes', show: user?.role !== 'profesor' },
    { to: '/practice', label: 'Práctica', show: user?.role !== 'profesor' },
    { to: '/chat', label: '💬 Mi profesor', show: user?.role === 'student' },
    { to: '/profesor', label: 'Mis Alumnos', show: user?.role === 'profesor' },
    { to: '/admin', label: 'Administración', show: user?.role === 'admin' || user?.role === 'curator' },
  ].filter((link) => link.show);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/" className="text-2xl font-bold text-primary-600">
                  Opositores App
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      (link.exact ? location.pathname === link.to : isActive(link.to))
                        ? 'border-primary-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Escritorio: nombre + cerrar sesión visibles siempre */}
            <div className="hidden sm:flex sm:items-center">
              <span className="text-sm text-gray-700 mr-4">
                {user?.display_name} <span className="text-xs text-gray-500">({user?.role})</span>
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                data-testid="logout-button"
              >
                Cerrar sesión
              </button>
            </div>

            {/* Móvil: botón hamburguesa en vez de intentar encajar todo en la misma fila */}
            <div className="flex items-center sm:hidden">
              <button
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                aria-label="Abrir menú"
                aria-expanded={mobileMenuOpen}
                data-testid="mobile-menu-button"
              >
                {mobileMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Panel desplegable de móvil */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-200" data-testid="mobile-menu">
            <div className="pt-2 pb-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-2 text-base font-medium ${
                    (link.exact ? location.pathname === link.to : isActive(link.to))
                      ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-500'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="pt-4 pb-3 border-t border-gray-200 px-4">
              <div className="text-sm text-gray-700 mb-3">
                {user?.display_name} <span className="text-xs text-gray-500">({user?.role})</span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
