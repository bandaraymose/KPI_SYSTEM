import React from 'react';
import './HODDashboard.css';
import '../Dashboard/Dashboard.css';
import { useUserContext } from '../../utils/api';
import Dashboard from '../Dashboard/Dashboard';
import HODWorkplans from './HODWorkplans';

const HODDashboard = () => {
  const user = useUserContext();

  if (!user || !user.departmentId) {
    return (
      <div className="error-container">
        <h2>Access Error</h2>
        <p>Department access required. Please contact the administrator.</p>
      </div>
    );
  }

  return (
    <div className="hod-dashboard-container">
      {/* Main Dashboard with stats, charts, and quick actions */}
      <Dashboard user={user} />
      
      {/* Department-specific workplan management */}
      {user.role === 'hod' && <HODWorkplans user={user} />}
      
      {/* Additional HOD-specific components can be added here */}
    </div>
  );
};

export default HODDashboard;