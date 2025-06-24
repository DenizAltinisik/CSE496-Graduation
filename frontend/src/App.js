import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import ProfileCompletion from './components/ProfileCompletion';
import PersonaSelection from './components/PersonaSelection';
import MainPage from './components/MainPage';
import LoadingSpinner from './components/LoadingSpinner';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  // If user is authenticated but hasn't completed profile, redirect to profile completion
  if (user && !user.profileComplete) {
    return <Navigate to="/complete-profile" />;
  }
  
  // If user has completed profile but hasn't selected persona, redirect to persona selection
  if (user && user.profileComplete && !user.personaSelected) {
    return <Navigate to="/select-persona" />;
  }
  
  return children;
};

const ProfileRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  // If user has already completed profile, redirect to persona selection or main page
  if (user && user.profileComplete) {
    return <Navigate to="/select-persona" />;
  }
  
  return children;
};

const PersonaRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  // If user hasn't completed profile, redirect to profile completion
  if (user && !user.profileComplete) {
    return <Navigate to="/complete-profile" />;
  }
  
  // If user has already selected persona, redirect to main page
  if (user && user.personaSelected) {
    return <Navigate to="/" />;
  }
  
  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  return !isAuthenticated ? children : <Navigate to="/" />;
};

function AppRoutes() {
  return (
    <Router>
      <Routes>
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
        <Route 
          path="/complete-profile" 
          element={
            <ProfileRoute>
              <ProfileCompletion />
            </ProfileRoute>
          } 
        />
        <Route 
          path="/select-persona" 
          element={
            <PersonaRoute>
              <PersonaSelection />
            </PersonaRoute>
          } 
        />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <MainPage />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
