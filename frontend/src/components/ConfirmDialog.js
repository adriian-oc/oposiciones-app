import React from 'react';

// Reemplaza window.confirm() en toda la app: además de dar mejor UX, window.confirm() se
// bloqueaba de forma intermitente en el navegador de pruebas (mismo problema ya documentado
// para window.prompt() -- ver CONTINUATION.md), colgando la sesión entera del navegador.
const ConfirmDialog = ({ message, confirmLabel = 'Confirmar', danger = false, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
      <p className="text-gray-900 text-sm">{message}</p>
      <div className="flex gap-2 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`flex-1 py-2 px-4 text-white rounded-md ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

export default ConfirmDialog;
