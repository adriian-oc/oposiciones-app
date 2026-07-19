import React from 'react';

// Banner de "modo solo lectura" cuando admin/profesor ve el progreso de un alumno.
const ViewingBanner = ({ label, onExit }) => (
  <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-4 py-3 mb-6 flex items-center justify-between gap-3 text-sm">
    <span>
      👁 Estás viendo el progreso de <strong>{label}</strong> (solo lectura)
    </span>
    <button
      onClick={onExit}
      className="px-3 py-1.5 bg-amber-400 text-amber-950 rounded-md font-semibold hover:bg-amber-500"
    >
      Volver
    </button>
  </div>
);

export default ViewingBanner;
