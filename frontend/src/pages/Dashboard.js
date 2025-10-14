import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

const Dashboard = () => {
  const { user } = useAuth();

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="welcome-heading">
            Bienvenido, {user?.display_name}
          </h1>
          <p className="mt-2 text-gray-600">
            Comienza a practicar con exámenes personalizados
          </p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            to="/exams/new"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200"
            data-testid="create-exam-card"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-12 w-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Generar Examen</h3>
                <p className="mt-1 text-sm text-gray-600">Crea un nuevo examen personalizado</p>
              </div>
            </div>
          </Link>

          <Link
            to="/exams/history"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200"
            data-testid="history-card"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-12 w-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Historial</h3>
                <p className="mt-1 text-sm text-gray-600">Ver exámenes realizados</p>
              </div>
            </div>
          </Link>

          {(user?.role === 'admin' || user?.role === 'curator') && (
            <Link
              to="/admin"
              className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200"
              data-testid="admin-card"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-12 w-12 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Administración</h3>
                  <p className="mt-1 text-sm text-gray-600">Gestionar preguntas y temas</p>
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* Stats section */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Estadísticas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600">0</div>
              <div className="text-sm text-gray-600 mt-1">Exámenes realizados</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">0%</div>
              <div className="text-sm text-gray-600 mt-1">Tasa de acierto</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">0</div>
              <div className="text-sm text-gray-600 mt-1">Preguntas respondidas</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;