import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import practicalSetService from '../services/practicalSetService';
import { examService } from '../services/examService';

const Practice = () => {
  const [practicalSets, setPracticalSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const data = await practicalSetService.getAll(0, 100);
      setPracticalSets(data);
    } catch (error) {
      console.error('Error loading practical sets:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleStart = async (practicalSetId) => {
    setStartingId(practicalSetId);
    try {
      const attempt = await examService.startPractice(practicalSetId);
      navigate(`/exams/take/${attempt.id}`);
    } catch (error) {
      alert('Error al iniciar la práctica: ' + (error.response?.data?.detail || error.message));
    } finally {
      setStartingId(null);
    }
  };

  // Supuestos Prácticos (title "Supuesto N") vs Cuadernillos (title "Cuadernillo — ...")
  const supuestos = practicalSets.filter((ps) => ps.title.startsWith('Supuesto '));
  const cuadernillos = practicalSets.filter((ps) => ps.title.startsWith('Cuadernillo'));

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Cargando...</div>
      </Layout>
    );
  }

  const renderGroup = (title, items) => (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((ps) => (
          <div key={ps.id} className="bg-white rounded-lg shadow-md p-5 flex flex-col justify-between">
            <div>
              <h3 className="font-medium text-gray-900">{ps.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{ps.question_count} preguntas</p>
            </div>
            <button
              onClick={() => handleStart(ps.id)}
              disabled={startingId === ps.id}
              className="mt-4 w-full py-2 px-4 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {startingId === ps.id ? 'Iniciando...' : 'Practicar'}
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-gray-500 text-sm">Todavía no hay contenido en esta área.</p>
        )}
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Práctica por Supuestos y Cuadernillos</h1>
        {renderGroup('📋 Supuestos Prácticos', supuestos)}
        {renderGroup('📗 Cuadernillos de Ejercicios', cuadernillos)}
      </div>
    </Layout>
  );
};

export default Practice;
