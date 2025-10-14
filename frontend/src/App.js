import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import ExamGenerator from './pages/ExamGenerator';
import TakeExam from './pages/TakeExam';
import ExamResults from './pages/ExamResults';
import ExamHistory from './pages/ExamHistory';
import Analytics from './pages/Analytics';

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />

      {/* Private routes */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Dashboard />
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
        path="/exams/new"
        element={
          <PrivateRoute>
            <ExamGenerator />
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
