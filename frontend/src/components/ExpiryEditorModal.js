import React, { useState } from 'react';

const ExpiryEditorModal = ({ user, onClose, onSave }) => {
  const [date, setDate] = useState(user.expires_at ? user.expires_at.slice(0, 10) : '');
  const [noLimit, setNoLimit] = useState(!user.expires_at);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(noLimit ? null : new Date(date + 'T23:59:59').toISOString());
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Caducidad de acceso — {user.display_name}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={noLimit} onChange={(e) => setNoLimit(e.target.checked)} />
            Sin límite
          </label>
          {!noLimit && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Fecha de caducidad</label>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          )}
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

export default ExpiryEditorModal;
