import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Header, Footer } from './components';
import RewardsCenter from './components/RewardsCenter';
import useAuthStore from './store/authStore';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AddMedication from './pages/AddMedication';
import DoseLogging from './pages/DoseLogging';
import AdherenceReports from './pages/AdherenceReports';
import Settings from './pages/Settings';
import CalendarCallback from './pages/CalendarCallback';
import { ThemeProvider } from './context/ThemeContext';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  console.log('ProtectedRoute check:', { isAuthenticated });
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Public Route Component (redirect to dashboard if already authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  console.log('PublicRoute check:', { isAuthenticated });
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="App min-h-screen flex flex-col dark:bg-gray-900 dark:text-white">
          <Header />
          <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route 
                path="/login" 
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                } 
              />
              <Route 
                path="/register" 
                element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                } 
              />
              
              {/* Protected Routes */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/add-medication" 
                element={
                  <ProtectedRoute>
                    <AddMedication />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/dose-logging" 
                element={
                  <ProtectedRoute>
                    <DoseLogging />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/rewards" 
                element={
                  <ProtectedRoute>
                    <RewardsCenter />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/adherence-reports" 
                element={
                  <ProtectedRoute>
                    <AdherenceReports />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } 
              />
              
              {/* Calendar OAuth Callback Route */}
              <Route 
                path="/calendar/callback" 
                element={
                  <ProtectedRoute>
                    <CalendarCallback />
                  </ProtectedRoute>
                } 
              />
              
              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              {/* Catch all - redirect to login */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;

