import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiService from '../../utils/api';
import '../Dashboard/Dashboard.css';
import './Dashboard.css';

const DeanDashboard = ({ user }) => {
  const [stats, setStats] = useState({
    totalHODs: 0,
    totalDepartments: 0,
    pendingWorkplans: 0,
    completedEvaluations: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch departments, workplans, and HODs in parallel (users kept for compatibility if needed)
        const [users, departments, workplans, hodsList] = await Promise.all([
          apiService.getAllUsers(),
          apiService.getDepartments(),
          apiService.getWorkplans(),
          apiService.getHODs()
        ]);

        // Aggregate area evaluations across all HODs
        const hodsUnique = Array.isArray(hodsList) ? hodsList.filter(h => !!h?.id) : [];
        let completedAreaEvaluations = 0;
        if (hodsUnique.length > 0) {
          const areaPromises = hodsUnique.map(h => (
            h?.id ? apiService.getAreaEvaluationsByLecturer(h.id).catch(() => []) : Promise.resolve([])
          ));
          const results = await Promise.all(areaPromises);
          // Count each area evaluation record as completed
          completedAreaEvaluations = results.reduce((sum, evs) => sum + (Array.isArray(evs) ? evs.length : 0), 0);
        }

        setStats({
          totalHODs: (Array.isArray(hodsList) ? hodsList.length : 0),
          totalDepartments: departments.length,
          pendingWorkplans: workplans.filter(w => w.status === 'pending' || w.status === 'Pending').length,
          completedEvaluations: completedAreaEvaluations
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
  }, [user]);

  useEffect(() => {
    if (user && user.role === 'dean') {
      fetchDashboardData();

      // Set up listeners for real-time updates
      const onEvalCreated = () => fetchDashboardData();
      const onEvalUpdated = () => fetchDashboardData();
      const onReportRefresh = () => fetchDashboardData();
      const onStorage = (e) => {
        if (e.key === 'evaluationUpdated' || e.key === 'reportRefreshNeeded') {
          fetchDashboardData();
        }
      };

      window.addEventListener('evaluationCreated', onEvalCreated);
      window.addEventListener('evaluationUpdated', onEvalUpdated);
      window.addEventListener('reportRefreshRequested', onReportRefresh);
      window.addEventListener('storage', onStorage);

      // Also refresh when tab becomes visible again
      const onVisibility = () => {
        if (document.visibilityState === 'visible') {
          fetchDashboardData();
        }
      };
      document.addEventListener('visibilitychange', onVisibility);

      return () => {
        window.removeEventListener('evaluationCreated', onEvalCreated);
        window.removeEventListener('evaluationUpdated', onEvalUpdated);
        window.removeEventListener('reportRefreshRequested', onReportRefresh);
        window.removeEventListener('storage', onStorage);
        document.removeEventListener('visibilitychange', onVisibility);
      };
    }
  }, [user, fetchDashboardData]);

  if (loading) {
    return <div className="loading">Loading dashboard data...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Welcome, {user.name}</h1>
        <p>Faculty Overview Dashboard</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.totalDepartments}</h3>
            <p>Departments</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.totalHODs}</h3>
            <p>Department Heads</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.completedEvaluations}</h3>
            <p>Completed Evaluations</p>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="action-grid">
          <Link to="/departments" className="action-card">
            View Departments
          </Link>
          <Link to="/lecturers" className="action-card">
            Assign to HODs
          </Link>
          <Link to="/workplan" className="action-card">
            My Workplan
          </Link>
          <Link to="/reports" className="action-card">
            Generate Reports
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DeanDashboard;