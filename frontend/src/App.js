import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Components
import Login from './components/Login/Login.jsx';
import AdminDashboard from './components/AdminDashboard/Dashboard';
import HODDashboard from './components/HODDashboard/Dashboard';
import DeanDashboard from './components/DeanDashboard/Dashboard';
import LecturerDashboard from './components/LecturerDashboard/Dashboard';
import KPIManagement from './components/AdminDashboard/KPIManagement';
import UserList from './components/AdminDashboard/UserList';
import DepartmentList from './components/AdminDashboard/DepartmentList';

import Navbar from './components/Layout/Navbar';
import Profile from './components/Profile/Profile';

import LecturerList from './components/HODDashboard/LecturerList';
import LecturerProfile from './components/HODDashboard/LecturerProfile';
import WorkplanAssignment from './components/WorkplanAssignment/WorkplanAssignment';
import DeanEvaluations from './components/DeanDashboard/DeanEvaluations';
import DeanAssignedWorkplans from './components/DeanDashboard/AssignedWorkplans';
import DeanWorkplan from './components/DeanDashboard/DeanWorkplan';
import DeanAssignedWorkplansView from './components/DeanDashboard/DeanAssignedWorkplansView';
import DeanWorkplans from './components/DeanDashboard/DeanWorkplans';
import HODWorkplans from './components/HODDashboard/HODWorkplans';
import Reports from './components/Reports/Reports';

function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Function to clear all authentication data
  const clearAuthData = () => {
    console.log('Clearing authentication data');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    setUser(null);
    setIsAuthenticated(false);
  };

  // Debug helper - expose to window for debugging
  useEffect(() => {
    window.clearAuth = clearAuthData;
    window.getAuthState = () => ({
      isAuthenticated,
      user,
      localStorage: {
        currentUser: localStorage.getItem('currentUser'),
        authToken: localStorage.getItem('authToken')
      }
    });
  }, [isAuthenticated, user]);

  useEffect(() => {
    // ALWAYS start at login page - clear any existing auth data on startup
    const initializeApp = () => {
      console.log('App startup - clearing all authentication data');
      // Always clear auth data on startup to force login
      clearAuthData();
      
      // Short delay to ensure clean startup
      setTimeout(() => {
        console.log('App initialization complete, going to login');
        setIsLoading(false);
      }, 500);
    };
    
    initializeApp();
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('currentUser', JSON.stringify(userData));
  };

  const handleLogout = () => {
    clearAuthData();
  };

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="App">
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          backgroundColor: '#f8f9fa'
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '3px solid #11486B',
            borderTop: '3px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ marginTop: '20px', color: '#11486B', fontSize: '16px' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        {isAuthenticated && <Navbar user={user} onLogout={handleLogout} />}
        <Routes>
          <Route 
            path="/login" 
            element={
              !isAuthenticated ? 
              <Login onLogin={handleLogin} /> : 
              <Navigate to="/dashboard" />
            } 
          />
          
          <Route 
            path="/dashboard" 
            element={
              isAuthenticated ? (
                user.role === 'admin' ? <AdminDashboard user={user} /> :
                user.role === 'hod' ? <HODDashboard user={user} /> :
                user.role === 'dean' ? <DeanDashboard user={user} /> :
                <LecturerDashboard user={user} />
              ) : (
                <Navigate to="/login" />
              )
            } 
          />
          
          <Route 
            path="/lecturers" 
            element={
              isAuthenticated && (user.role === 'admin' || user.role === 'hod' || user.role === 'dean') ? 
              <LecturerList user={user} /> : 
              <Navigate to="/dashboard" />
            } 
          />
          
          <Route 
            path="/lecturer/:id" 
            element={
              isAuthenticated ? 
              <LecturerProfile user={user} /> : 
              <Navigate to="/login" />
            } 
          />
          
          <Route 
            path="/kpi-management" 
            element={
              isAuthenticated && (user.role === 'admin' || user.role === 'hod' || user.role === 'dean') ? 
              <KPIManagement user={user} /> : 
              <Navigate to="/dashboard" />
            } 
          />
          
          <Route 
            path="/workplan" 
            element={
              isAuthenticated ? 
              <WorkplanAssignment user={user} /> : 
              <Navigate to="/login" />
            } 
          />
          
          
          <Route path="/users" element={isAuthenticated && (user.role === 'admin' || user.role === 'hod') ? <UserList user={user} /> : <Navigate to="/dashboard" />} />
          <Route path="/departments" element={isAuthenticated && (user.role === 'admin' || user.role === 'dean') ? <DepartmentList /> : <Navigate to="/dashboard" />} />
          <Route path="/evaluations" element={isAuthenticated && (user.role === 'admin' || user.role === 'hod' || user.role === 'dean') ? <DeanEvaluations user={user} /> : <Navigate to="/dashboard" />} />
          <Route path="/workplans" element={
            isAuthenticated ? 
            (user.role === 'hod' ? <HODWorkplans user={user} /> : 
             user.role === 'dean' ? <DeanWorkplans user={user} /> :
             user.role === 'lecturer' ? <WorkplanAssignment user={user} /> :
             <DeanAssignedWorkplans user={user} />) : 
            <Navigate to="/login" />
          } />
          <Route path="/reports" element={isAuthenticated ? <Reports user={user} /> : <Navigate to="/login" />} />
          <Route path="/profile" element={isAuthenticated ? <Profile user={user} /> : <Navigate to="/login" />} />
          <Route path="/assigned-workplans" element={
            isAuthenticated && user.role === 'dean' ? 
            <DeanAssignedWorkplans user={user} /> : 
            <Navigate to="/dashboard" />
          } />
          <Route path="/dean-workplan" element={
            isAuthenticated && user.role === 'dean' ? 
            <DeanWorkplan user={user} /> : 
            <Navigate to="/dashboard" />
          } />

          {/* Default route - always redirect to login if not authenticated */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Catch-all route - redirect unknown paths to login or dashboard */}
          <Route path="*" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;