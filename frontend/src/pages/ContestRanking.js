import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { contestService } from '../services/contestService';

const medal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null);

const ContestRanking = () => {
  const [ranking, setRanking] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    contestService.getRanking()
      .then(setRanking)
      .catch((err) => setError(err.response?.data?.detail || 'No se pudo cargar el ranking'));
  }, []);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Ranking del Concurso</h1>
        <p className="text-gray-600 mb-6">Clasificación por la mejor nota obtenida en el contenido del concurso.</p>

        {error && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">{error}</div>}

        {ranking && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
            {ranking.length === 0 ? (
              <p className="p-6 text-center text-gray-500">Todavía no hay participantes.</p>
            ) : (
              ranking.map((entry) => (
                <div
                  key={`${entry.rank}-${entry.display_name}`}
                  className={`flex items-center justify-between px-4 py-3 ${entry.is_me ? 'bg-primary-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-center font-bold text-gray-500">
                      {medal(entry.rank) || entry.rank}
                    </span>
                    <span className={`font-medium ${entry.is_me ? 'text-primary-700' : 'text-gray-900'}`}>
                      {entry.display_name}{entry.is_me ? ' (tú)' : ''}
                      {entry.email && <span className="text-gray-400 font-normal ml-2 text-sm">{entry.email}</span>}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">
                    {entry.best_score !== null ? `${entry.best_score.toFixed(2)} / ${entry.scale}` : 'Sin nota todavía'}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ContestRanking;
