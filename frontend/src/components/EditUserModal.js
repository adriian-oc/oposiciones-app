import React, { useState } from 'react';
import ContentAccessChecklist from './ContentAccessChecklist';

const STUDENT_TYPE_OPTIONS = [
  { value: '', label: '🏫 Centro (alumno general de la academia)' },
  { value: 'propio', label: '🏠 Propio (clientela privada de este profesor)' },
];

// adminOnly=false oculta reasignar profesor y el tipo propio/centro -- son poderes que se
// quedan siempre en el admin, ni el propio profesor los toca sobre sus alumnos (ver
// ProfesorDashboard.js, que reusa este mismo modal con adminOnly={false}).
const EditUserModal = ({ user, profesores, onClose, onSave, adminOnly = true }) => {
  const [allowedContent, setAllowedContent] = useState(user.allowed_content ?? null);
  const [assignedProfesorId, setAssignedProfesorId] = useState(user.assigned_profesor_id || '');
  const [studentType, setStudentType] = useState(user.student_type || '');
  const [paymentType, setPaymentType] = useState(user.payment_type || 'gratis');
  const [payments, setPayments] = useState(user.payments_received || []);
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentNote, setNewPaymentNote] = useState('');

  const addPayment = () => {
    if (!newPaymentAmount) return;
    setPayments([
      ...payments,
      { amount: parseFloat(newPaymentAmount), date: new Date().toISOString().slice(0, 10), note: newPaymentNote },
    ]);
    setNewPaymentAmount('');
    setNewPaymentNote('');
  };

  const removePayment = (idx) => setPayments(payments.filter((_, i) => i !== idx));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      allowed_content: allowedContent,
      payment_type: paymentType || null,
      payments_received: payments,
      ...(adminOnly && {
        assigned_profesor_id: assignedProfesorId || null,
        student_type: assignedProfesorId ? studentType || null : null,
      }),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Editar acceso — {user.display_name}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contenido disponible</label>
            <ContentAccessChecklist value={allowedContent} onChange={setAllowedContent} />
          </div>
          {user.role === 'student' && adminOnly && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Profesor asignado</label>
              <select
                value={assignedProfesorId}
                onChange={(e) => setAssignedProfesorId(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Sin asignar</option>
                {profesores.map((p) => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
              </select>
            </div>
          )}
          {user.role === 'student' && adminOnly && assignedProfesorId && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Tipo de alumno</label>
              <select
                value={studentType}
                onChange={(e) => setStudentType(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {STUDENT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                "Propio" le da al profesor acceso a gestionar a este alumno (contenido, pagos,
                expiración, restablecer contraseña, revocar) desde su propia pestaña de
                administración -- "Centro" se queda como hasta ahora, solo seguimiento.
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Tipo de pago</label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="gratis">🎁 Gratis</option>
              <option value="pago">💰 Pago</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pagos recibidos</label>
            {payments.length > 0 && (
              <ul className="text-sm text-gray-700 mb-2 space-y-1">
                {payments.map((p, idx) => (
                  <li key={idx} className="flex justify-between items-center bg-gray-50 rounded px-2 py-1">
                    <span>{p.amount}€ — {p.date} {p.note && `(${p.note})`}</span>
                    <button type="button" onClick={() => removePayment(idx)} className="text-red-500 text-xs">✕</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Importe"
                value={newPaymentAmount}
                onChange={(e) => setNewPaymentAmount(e.target.value)}
                className="w-24 px-2 py-1 border border-gray-300 rounded-md text-sm"
              />
              <input
                type="text"
                placeholder="Nota"
                value={newPaymentNote}
                onChange={(e) => setNewPaymentNote(e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm"
              />
              <button type="button" onClick={addPayment} className="px-2 py-1 bg-gray-200 rounded-md text-sm">+</button>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700">
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;
