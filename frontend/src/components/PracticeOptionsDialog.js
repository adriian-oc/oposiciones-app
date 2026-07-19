import React, { useState } from 'react';

// Mismo patrón visual que ConfirmDialog, con un checkbox de opciones antes de arrancar una
// práctica. Corrección en directo es opt-in y apagada por defecto: si estuviera activa siempre,
// el estudiante "serio" perdería la posibilidad de autoevaluarse sin pistas -- ver ronda 5.
const PracticeOptionsDialog = ({ title = 'Empezar práctica', onStart, onCancel }) => {
  const [liveCorrection, setLiveCorrection] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
        <p className="text-gray-900 text-sm font-medium mb-3">{title}</p>
        <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={liveCorrection}
            onChange={(e) => setLiveCorrection(e.target.checked)}
            className="mt-0.5"
            data-testid="live-correction-checkbox"
          />
          <span>
            Corrección en directo
            <span className="block text-xs text-gray-500">
              Ver al momento si has acertado cada pregunta, en vez de esperar a terminar.
            </span>
          </span>
        </label>
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
            onClick={() => onStart(liveCorrection)}
            className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            data-testid="practice-options-start"
          >
            Empezar ▶
          </button>
        </div>
      </div>
    </div>
  );
};

export default PracticeOptionsDialog;
