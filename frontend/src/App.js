import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ExamGuardProvider } from './context/ExamGuardContext';
import PrivateRoute from './components/PrivateRoute';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cuadernos from './pages/Cuadernos';
import Progress from './pages/Progress';
import Admin from './pages/Admin';
import TakeExam from './pages/TakeExam';
import ExamResults from './pages/ExamResults';
import AttemptProgress from './pages/AttemptProgress';
import Analytics from './pages/Analytics';
import ProfesorDashboard from './pages/ProfesorDashboard';
import Chat from './pages/Chat';
import Comunicaciones from './pages/Comunicaciones';
import AccessRequest from './pages/AccessRequest';
import TeacherApplication from './pages/TeacherApplication';
import ResetPassword from './pages/ResetPassword';
import StudyCalendar from './pages/StudyCalendar';
import MiPerfil from './pages/MiPerfil';
import FocusMode from './pages/FocusMode';
import Concurso from './pages/Concurso';
import ContestRanking from './pages/ContestRanking';

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/solicitar-acceso" element={<AccessRequest />} />
      <Route path="/concurso" element={<Concurso />} />
      <Route path="/trabaja-con-nosotros" element={<TeacherApplication />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Home: pública (Landing) si no hay sesión, privada si la hay */}
      <Route
        path="/"
        element={
          !user ? (
            <Landing />
          ) : user.role === 'profesor' ? (
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
        path="/exams/progress/:attemptId"
        element={
          <PrivateRoute>
            <AttemptProgress />
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
          <PrivateRoute allowedRoles={['student', 'profesor', 'admin']}>
            <Chat />
          </PrivateRoute>
        }
      />

      <Route
        path="/chat"
        element={
          <PrivateRoute allowedRoles={['student', 'profesor', 'admin']}>
            <Chat />
          </PrivateRoute>
        }
      />

      <Route
        path="/comunicaciones"
        element={
          <PrivateRoute allowedRoles={['student', 'profesor', 'admin']}>
            <Comunicaciones />
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

      <Route
        path="/mi-perfil"
        element={
          <PrivateRoute>
            <MiPerfil />
          </PrivateRoute>
        }
      />

      <Route
        path="/concurso/ranking"
        element={
          <PrivateRoute>
            <ContestRanking />
          </PrivateRoute>
        }
      />

      <Route
        path="/modo-foco"
        element={
          <PrivateRoute allowedRoles={['student']}>
            <FocusMode />
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
        <ExamGuardProvider>
          <AppRoutes />
        </ExamGuardProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
