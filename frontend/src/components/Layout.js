import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useExamGuard } from '../context/ExamGuardContext';
import ConfirmDialog from './ConfirmDialog';
import { messageService } from '../services/messageService';

const UNREAD_POLL_MS = 30000;

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { guarded, setGuarded } = useExamGuard();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingNav, setPendingNav] = useState(null); // { to } | { logout: true } | null
  const [hasUnread, setHasUnread] = useState(false);

  // Sondeo simple del punto rojo de notificaciones -- se re-consulta al cambiar de página (para
  // que se apague nada más leer el hilo, ver MessageService.get_thread que marca como leído) y
  // cada 30s de fondo para detectar mensajes nuevos sin recargar.
  useEffect(() => {
    if (!user || !['student', 'profesor', 'admin'].includes(user.role)) return;
    let cancelled = false;
    const checkUnread = () => {
      messageService.getUnreadSummary()
        .then((data) => { if (!cancelled) setHasUnread(data.has_unread); })
        .catch(() => {});
    };
    checkUnread();
    const interval = setInterval(checkUnread, UNREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, location.pathname]);

  const notificationsLink = user?.role === 'student' ? '/chat' : user?.role === 'profesor' ? '/profesor' : '/admin';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Mientras hay un examen sin terminar, cualquier salida por el nav (incluido cerrar sesión)
  // pasa primero por un aviso -- el examen sigue guardado y se puede retomar desde el
  // Historial en Mi Progreso, así que se lo decimos explícitamente en el mensaje.
  const guardedNavigate = (e, to) => {
    if (!guarded) return;
    e.preventDefault();
    setMobileMenuOpen(false);
    setPendingNav({ to });
  };

  const guardedLogout = (e) => {
    if (guarded) {
      e.preventDefault();
      setPendingNav({ logout: true });
      return;
    }
    handleLogout();
  };

  const confirmLeave = async () => {
    const nav = pendingNav;
    setPendingNav(null);
    setGuarded(false);
    if (nav.logout) {
      await handleLogout();
    } else {
      navigate(nav.to);
    }
  };

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Fuente única de los enlaces del nav -- se pintan tanto en la barra de escritorio como en el
  // menú desplegable de móvil, evitando duplicar el JSX y el riesgo de que se desincronicen.
  const navLinks = [
    { to: '/', label: 'Inicio', show: true, exact: true },
    { to: '/cuadernos', label: '📚 Cuadernos', show: true },
    { to: '/progreso', label: '📊 Mi Progreso', show: user?.role !== 'profesor' },
    { to: '/calendario', label: '📅 Calendario', show: user?.role === 'student' },
    { to: '/chat', label: '💬 Mi profesor', show: user?.role === 'student' },
    { to: '/profesor', label: 'Mis Alumnos', show: user?.role === 'profesor' },
    { to: '/admin', label: 'Administración', show: user?.role === 'admin' || user?.role === 'curator' },
    { to: '/mi-perfil', label: '👤 Mi perfil', show: user?.role === 'profesor' || user?.role === 'student' },
  ].filter((link) => link.show);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/" onClick={(e) => guardedNavigate(e, '/')} className="flex items-center">
                  <img src="/branding/logo.png" alt="ADOC" className="h-12 w-auto object-contain" />
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={(e) => guardedNavigate(e, link.to)}
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
              <Link
                to={notificationsLink}
                onClick={(e) => guardedNavigate(e, notificationsLink)}
                className="relative mr-4 p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                aria-label="Notificaciones"
                data-testid="notifications-bell"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {hasUnread && (
                  <span className="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" data-testid="notifications-dot" />
                )}
              </Link>
              <span className="text-sm text-gray-700 mr-4">
                {user?.display_name} <span className="text-xs text-gray-500">({user?.role})</span>
              </span>
              <button
                onClick={guardedLogout}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                data-testid="logout-button"
              >
                Cerrar sesión
              </button>
            </div>

            {/* Móvil: botón hamburguesa en vez de intentar encajar todo en la misma fila */}
            <div className="flex items-center gap-1 sm:hidden">
              <Link
                to={notificationsLink}
                onClick={(e) => {
                  setMobileMenuOpen(false);
                  guardedNavigate(e, notificationsLink);
                }}
                className="relative p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                aria-label="Notificaciones"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {hasUnread && (
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </Link>
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
                  onClick={(e) => {
                    if (guarded) {
                      guardedNavigate(e, link.to);
                    } else {
                      setMobileMenuOpen(false);
                    }
                  }}
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
                onClick={guardedLogout}
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

      {pendingNav && (
        <ConfirmDialog
          message="Tienes un examen sin terminar. Si sales ahora, puedes continuarlo más tarde desde Mi Progreso → Historial. ¿Seguro que quieres salir?"
          confirmLabel="Salir"
          danger
          onConfirm={confirmLeave}
          onCancel={() => setPendingNav(null)}
        />
      )}
    </div>
  );
};

export default Layout;
