import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import ExamGenerator from './pages/ExamGenerator';
import Practice from './pages/Practice';
import TakeExam from './pages/TakeExam';
import ExamResults from './pages/ExamResults';
import ExamHistory from './pages/ExamHistory';
import Analytics from './pages/Analytics';
import ProfesorDashboard from './pages/ProfesorDashboard';
import Chat from './pages/Chat';
import AccessRequest from './pages/AccessRequest';
import StudyCalendar from './pages/StudyCalendar';

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/solicitar-acceso" element={<AccessRequest />} />

      {/* Private routes */}
      <Route
        path="/"
        element={
          user?.role === 'profesor' ? (
            <Navigate to="/profesor" />
          ) : (
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          )
        }
      />
      
      <Route
        path="/admin"
        element={
          <PrivateRoute allowedRoles={['admin', 'curator']}>
            <Admin />
          </PrivateRoute>
        }
      />

      <Route
        path="/exams/new"
        element={
          <PrivateRoute>
            <ExamGenerator />
          </PrivateRoute>
        }
      />

      <Route
        path="/practice"
        element={
          <PrivateRoute>
            <Practice />
          </PrivateRoute>
        }
      />

      <Route
        path="/exams/take/:attemptId"
        element={
          <PrivateRoute>
            <TakeExam />
          </PrivateRoute>
        }
      />

      <Route
        path="/exams/results/:attemptId"
        element={
          <PrivateRoute>
            <ExamResults />
          </PrivateRoute>
        }
      />

      <Route
        path="/exams/history"
        element={
          <PrivateRoute>
            <ExamHistory />
          </PrivateRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <PrivateRoute>
            <Analytics />
          </PrivateRoute>
        }
      />

      <Route
        path="/profesor"
        element={
          <PrivateRoute allowedRoles={['profesor']}>
            <ProfesorDashboard />
          </PrivateRoute>
        }
      />

      <Route
        path="/profesor/chat/:studentId"
        element={
          <PrivateRoute allowedRoles={['profesor', 'admin']}>
            <Chat />
          </PrivateRoute>
        }
      />

      <Route
        path="/chat"
        element={
          <PrivateRoute allowedRoles={['student']}>
            <Chat />
          </PrivateRoute>
        }
      />

      <Route
        path="/calendario"
        element={
          <PrivateRoute allowedRoles={['student']}>
            <StudyCalendar />
          </PrivateRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
