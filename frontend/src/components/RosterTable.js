import React from 'react';

// Port del patrón de ADOC (CLAUDE.md "Mobile responsiveness"): la tabla de roster se ve como
// tarjetas apiladas en móvil, no una tabla con scroll horizontal -- reportado como inusable por
// un admin no técnico en el teléfono. Aquí, en vez del truco CSS de ADOC (display:block + data-label
// + content:attr()), se usan dos layouts Tailwind (tabla oculta en móvil / tarjetas ocultas en
// escritorio) ya que React permite renderizado condicional nativo.
const RosterTable = ({ users, profesores, onRevoke, onReactivate, onEditContent, onSendReset, onMarkReviewed }) => {
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

  const activeUsers = users.filter((u) => !isBlocked(u));
  const blockedUsers = users.filter(isBlocked);

  const profesorName = (id) => profesores.find((p) => p.id === id)?.display_name || '—';

  const actionsFor = (u) => (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onEditContent(u)}
        className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
      >
        Editar acceso
      </button>
      <button
        onClick={() => onSendReset(u)}
        className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
      >
        🔑 Restablecer
      </button>
      {isBlocked(u) ? (
        <button
          onClick={() => onReactivate(u)}
          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
        >
          Reactivar
        </button>
      ) : (
        <button
          onClick={() => onRevoke(u)}
          className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
        >
          Revocar
        </button>
      )}
    </div>
  );

  const renderTable = (list) => (
    <div className="hidden sm:block overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Profesor asignado</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Acceso</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {list.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3 text-sm text-gray-900">{u.display_name}{novedadesBadge(u)}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{roleLabel[u.role] || u.role}</td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {u.role === 'student' ? profesorName(u.assigned_profesor_id) : '—'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {u.allowed_content ? `${u.allowed_content.length} unidades` : 'Completo'}
              </td>
              <td className="px-4 py-3">{actionsFor(u)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderCards = (list) => (
    <div className="sm:hidden space-y-3">
      {list.map((u) => (
        <div key={u.id} className="border border-gray-200 rounded-lg p-4">
          <div className="font-medium text-gray-900">{u.display_name}{novedadesBadge(u)}</div>
          <div className="text-sm text-gray-600">{u.email}</div>
          <div className="text-sm text-gray-600 mt-1">
            {roleLabel[u.role] || u.role}
            {u.role === 'student' && ` · Profesor: ${profesorName(u.assigned_profesor_id)}`}
          </div>
          <div className="text-sm text-gray-600">
            Acceso: {u.allowed_content ? `${u.allowed_content.length} unidades` : 'Completo'}
          </div>
          <div className="mt-3">{actionsFor(u)}</div>
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
            {renderTable(activeUsers)}
            {renderCards(activeUsers)}
          </>
        )}
      </div>
      {blockedUsers.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">🗄 Antiguos Alumnos ({blockedUsers.length})</h3>
          {renderTable(blockedUsers)}
          {renderCards(blockedUsers)}
        </div>
      )}
    </div>
  );
};

export default RosterTable;
