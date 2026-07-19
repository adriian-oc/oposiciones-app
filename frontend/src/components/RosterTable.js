import React from 'react';
import { Link } from 'react-router-dom';

// La tabla de roster se ve como tarjetas apiladas en móvil, no una tabla con scroll horizontal
// (inusable para un admin no técnico en el teléfono): dos layouts Tailwind (tabla oculta en
// móvil / tarjetas ocultas en escritorio), aprovechando que React permite renderizado
// condicional nativo en vez de depender de trucos CSS.
const RosterTable = ({
  users,
  profesores,
  onRevoke,
  onReactivate,
  onEditContent,
  onSendReset,
  onMarkReviewed,
  onAssignProfesor,
  onEditExpiry,
  onViewProgress,
  onEditProfile,
}) => {
  const roleLabel = { admin: 'Admin', profesor: 'Profesor', student: 'Alumno', curator: 'Curador' };

  const novedadesBadge = (u) =>
    u.has_novedades && (
      <button
        onClick={() => onMarkReviewed(u)}
        title="Hay actividad nueva -- clic para marcar como revisado"
        className="ml-2 text-xs px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full font-medium"
      >
        🆕 Novedades
      </button>
    );

  const isBlocked = (u) => {
    if (u.revoked) return true;
    if (u.role === 'student' && u.expires_at && new Date(u.expires_at) < new Date()) return true;
    return false;
  };

  const expiryBadge = (u) => {
    if (u.revoked) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Revocado</span>;
    if (u.role !== 'student') return <span className="text-xs text-gray-400">—</span>;
    if (!u.expires_at) return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Sin límite</span>;
    const days = Math.ceil((new Date(u.expires_at) - new Date()) / 86400000);
    const cls = days < 0 ? 'bg-red-100 text-red-700' : days <= 5 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700';
    const text = days < 0 ? 'Expirado' : `${days}d restantes`;
    return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{text}</span>;
  };

  const paymentBadge = (u) =>
    u.payment_type && u.payment_type !== 'gratis' ? (
      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">💰 {u.payment_type}</span>
    ) : (
      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">🎁 Gratis</span>
    );

  const progressCell = (u) => {
    const s = u.progress_summary;
    if (!s || s.answered === 0) return <span className="text-xs text-gray-400">Sin actividad</span>;
    const barColor = s.pct >= 70 ? 'bg-green-500' : s.pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
    return (
      <div className="w-28">
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full ${barColor}`} style={{ width: `${s.pct}%` }} />
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{s.pct}% aciertos</div>
      </div>
    );
  };

  const activeUsers = users.filter((u) => !isBlocked(u));
  const blockedUsers = users.filter(isBlocked);

  const profesorSelect = (u) => (
    <select
      value={u.assigned_profesor_id || ''}
      onChange={(e) => onAssignProfesor(u, e.target.value || null)}
      className="text-xs border border-gray-300 rounded px-1 py-1"
    >
      <option value="">Sin asignar</option>
      {profesores.map((p) => (
        <option key={p.id} value={p.id}>
          {p.display_name}
        </option>
      ))}
    </select>
  );

  const actionsFor = (u, blocked) => (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => onViewProgress(u)} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
        📊 Progreso
      </button>
      {u.role === 'student' && (
        <>
          <Link
            to={`/profesor/chat/${u.id}`}
            className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded hover:bg-primary-200"
          >
            💬 Chat
          </Link>
          <button onClick={() => onEditProfile(u)} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
            👤 Perfil
          </button>
          <button onClick={() => onEditContent(u)} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
            ✏️ Acceso
          </button>
          <button onClick={() => onEditExpiry(u)} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
            📅 Expira
          </button>
        </>
      )}
      <button onClick={() => onSendReset(u)} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
        🔑 Restablecer
      </button>
      {blocked ? (
        <button onClick={() => onReactivate(u)} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">
          Reactivar
        </button>
      ) : (
        <button onClick={() => onRevoke(u)} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">
          Revocar
        </button>
      )}
    </div>
  );

  const renderTable = (list, blocked) => (
    <div className="hidden sm:block overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expira</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pago</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Progreso</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Profesor asignado</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {list.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3 text-sm text-gray-900">{u.display_name}{novedadesBadge(u)}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{roleLabel[u.role] || u.role}</td>
              <td className="px-4 py-3">{expiryBadge(u)}</td>
              <td className="px-4 py-3">{u.role === 'student' ? paymentBadge(u) : <span className="text-xs text-gray-400">—</span>}</td>
              <td className="px-4 py-3">{u.role === 'student' ? progressCell(u) : <span className="text-xs text-gray-400">—</span>}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{u.role === 'student' ? profesorSelect(u) : '—'}</td>
              <td className="px-4 py-3">{actionsFor(u, blocked)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderCards = (list, blocked) => (
    <div className="sm:hidden space-y-3">
      {list.map((u) => (
        <div key={u.id} className="border border-gray-200 rounded-lg p-4">
          <div className="font-medium text-gray-900">{u.display_name}{novedadesBadge(u)}</div>
          <div className="text-sm text-gray-600">{u.email}</div>
          <div className="text-sm text-gray-600 mt-1 flex flex-wrap items-center gap-2">
            <span>{roleLabel[u.role] || u.role}</span>
            {expiryBadge(u)}
            {u.role === 'student' && paymentBadge(u)}
          </div>
          {u.role === 'student' && <div className="mt-2">{progressCell(u)}</div>}
          {u.role === 'student' && <div className="text-sm text-gray-600 mt-2">Profesor: {profesorSelect(u)}</div>}
          <div className="mt-3">{actionsFor(u, blocked)}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Alumnos activos ({activeUsers.length})</h3>
        {activeUsers.length === 0 ? (
          <p className="text-sm text-gray-500">No hay usuarios activos.</p>
        ) : (
          <>
            {renderTable(activeUsers, false)}
            {renderCards(activeUsers, false)}
          </>
        )}
      </div>
      {blockedUsers.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">🗄 Antiguos Alumnos ({blockedUsers.length})</h3>
          {renderTable(blockedUsers, true)}
          {renderCards(blockedUsers, true)}
        </div>
      )}
    </div>
  );
};

export default RosterTable;
