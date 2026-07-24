import React, { useEffect, useState } from 'react';
import { contestService } from '../services/contestService';
import ContestCountdown from './ContestCountdown';

const medal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null);

const ContestAdminPanel = () => {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    contestService.getAdminSummary()
      .then(setSummary)
      .catch((err) => setError(err.response?.data?.detail || 'No se pudo cargar el concurso'));
  }, []);

  if (error) return <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">{error}</div>;
  if (!summary) return <p className="text-gray-500">Cargando...</p>;

  const { config, participants_count: participantsCount, ranking } = summary;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Participantes</p>
          <p className="text-2xl font-bold text-gray-900">{participantsCount} / {config.max_participants}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-2">Cierre de inscripción</p>
          <ContestCountdown endAt={config.end_at} compact />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Contenido del concurso</p>
          <p className="font-medium text-gray-900">{config.theme_name}</p>
          <p className="text-sm text-gray-600 mt-1">{config.practical_set_titles.join(', ')}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-900">
          Clasificación
        </div>
        {ranking.length === 0 ? (
          <p className="p-6 text-center text-gray-500">Todavía no hay inscritos.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Puesto</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ranking.map((entry) => (
                <tr key={entry.email}>
                  <td className="px-4 py-2 font-semibold text-gray-700">{medal(entry.rank) || entry.rank}</td>
                  <td className="px-4 py-2 text-gray-900">{entry.display_name}</td>
                  <td className="px-4 py-2 text-gray-500">{entry.email}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">
                    {entry.best_score !== null ? `${entry.best_score.toFixed(2)} / ${entry.scale}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ContestAdminPanel;
