import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cuadernos from './pages/Cuadernos';
import Progress from './pages/Progress';
import Admin from './pages/Admin';
import TakeExam from './pages/TakeExam';
import ExamResults from './pages/ExamResults';
import Analytics from './pages/Analytics';
import ProfesorDashboard from './pages/ProfesorDashboard';
import Chat from './pages/Chat';
import AccessRequest from './pages/AccessRequest';
import TeacherApplication from './pages/TeacherApplication';
import ResetPassword from './pages/ResetPassword';
import StudyCalendar from './pages/StudyCalendar';

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/solicitar-acceso" element={<AccessRequest />} />
      <Route path="/trabaja-con-nosotros" element={<TeacherApplication />} />
      <Route path="/reset-password" element={<ResetPassword />} />

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
        path="/cuadernos"
        element={
          <PrivateRoute>
            <Cuadernos />
          </PrivateRoute>
        }
      />

      <Route
        path="/progreso"
        element={
          <PrivateRoute>
            <Progress />
          </PrivateRoute>
        }
      />

      <Route
        path="/progreso/:userId"
        element={
          <PrivateRoute allowedRoles={['admin', 'profesor']}>
            <Progress />
          </PrivateRoute>
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

      <Route
        path="/calendario/:userId"
        element={
          <PrivateRoute allowedRoles={['admin', 'profesor']}>
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
