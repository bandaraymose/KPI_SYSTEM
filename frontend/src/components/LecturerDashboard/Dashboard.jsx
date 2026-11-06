import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiService from '../../utils/api';
import '../Dashboard/Dashboard.css';
import './Dashboard.css';

const LecturerDashboard = ({ user }) => {
  const [stats, setStats] = useState({
    assignedKPIs: 0,
    completedTasks: 0,
    currentScore: 0,
    submissionRate: '0%'
  });
  const [kpis, setKpis] = useState([]);
  const [workplans, setWorkplans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all lecturer data in parallel
        const [myKpis, myWorkplans, myEvaluations] = await Promise.all([
          apiService.getMyKpis(),
          apiService.getMyWorkplans(),
          apiService.getMyEvaluations()
        ]);

        setKpis(myKpis);
        setWorkplans(myWorkplans);

        const completedEvals = myEvaluations.filter(e => e.status === 'completed');
        const totalScore = completedEvals.reduce((sum, evaluation) => sum + evaluation.score, 0);
        const averageScore = completedEvals.length > 0 ? totalScore / completedEvals.length : 0;

        setStats({
          assignedKPIs: myKpis.length,
          completedTasks: completedEvals.length,
          currentScore: Math.round(averageScore),
          submissionRate: `${Math.round((completedEvals.length / myKpis.length) * 100)}%`
        });
      } catch (err) {
        console.error('Error fetching lecturer data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    if (user && user.role === 'lecturer') {
      fetchDashboardData();
    }
  }, [user]);

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
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.assignedKPIs}</h3>
            <p>Assigned KPIs</p>
          </div>
        </div>
        {/* <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.completedTasks}</h3>
            <p>Completed Tasks</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.currentScore}</h3>
            <p>Current Score</p>
          </div>
        </div> */}
      </div>

      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="action-grid">
          <Link to="/workplan?tab=create" className="action-card">
            Workplan
          </Link>
          <Link to="/workplan?tab=kpis" className="action-card">
            View KPIs
          </Link>
          <Link to="/reports" className="action-card">
            My Reports
          </Link>
        </div>
      </div>

      <div className="kpi-overview">
        <h2>Current KPIs</h2>
        <div className="kpi-list">
          {kpis.map(kpi => (
            <div key={kpi.id} className="kpi-card">
              <h3>{kpi.name}</h3>
              <p>{kpi.description}</p>
              <div className="kpi-meta">
                <span>Weight: {kpi.weight}%</span>
                <span>Target: {kpi.target}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LecturerDashboard;