import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import dashboardApi from '../../api/dashboard';
import apiService from '../../utils/api';
import './Dashboard.css';

const HODDashboard = ({ user }) => {
  const [stats, setStats] = useState({
    teamMembers: 0,
    activeKPIs: 0,
    completedEvaluations: 0,
    pendingReviews: 0
  });
  const [teamPerformance, setTeamPerformance] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [kpiAssignments, setKpiAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const data = await dashboardApi.getDepartmentData();
        // Filter data for HOD's department only
        const departmentData = data.find(dept => dept.id === user.departmentId);
        if (departmentData) {
          // Compute completed evaluations from Area Evaluations for lecturers in this department
          let completedAreaEvaluations = 0;
          try {
            const lecturers = await apiService.getDepartmentLecturers(user.departmentId);
            if (Array.isArray(lecturers) && lecturers.length > 0) {
              const areaPromises = lecturers.map(l => (
                l?.id ? apiService.getAreaEvaluationsByLecturer(l.id).catch(() => []) : Promise.resolve([])
              ));
              const results = await Promise.all(areaPromises);
              completedAreaEvaluations = results.reduce((sum, evs) => sum + (Array.isArray(evs) ? evs.length : 0), 0);
            }
          } catch (e) {
            // Fallback to existing value if aggregation fails
            completedAreaEvaluations = departmentData.completedEvaluations || 0;
          }

          setStats({
            teamMembers: departmentData.lecturers,
            activeKPIs: departmentData.activeKPIs || 0,
            completedEvaluations: completedAreaEvaluations,
            pendingReviews: departmentData.pendingReviews || 0
          });
          setTeamPerformance(departmentData.performance || []);
        }
        
        // Build Team Performance and Recent Activity from department lecturers' Area Evaluations
        try {
          const lecturers = await apiService.getDepartmentLecturers(user.departmentId);
          if (Array.isArray(lecturers) && lecturers.length > 0) {
            const areaPromises = lecturers.map(l => (
              l?.id ? apiService.getAreaEvaluationsByLecturer(l.id).catch(() => []) : Promise.resolve([])
            ));
            const results = await Promise.all(areaPromises); // array of arrays aligned with lecturers

            // Team Performance: average percentage per lecturer across latest area evaluations
            const perf = lecturers.map((l, idx) => {
              const evs = Array.isArray(results[idx]) ? results[idx] : [];
              // Group by area -> latest per area
              const byArea = evs.reduce((acc, ev) => {
                const key = ev.areaId || ev.area?.id || 'unknown';
                if (!acc[key]) acc[key] = [];
                acc[key].push(ev);
                return acc;
              }, {});
              const latestAreaEvals = Object.values(byArea).map(list => list.slice().sort((a,b)=>new Date(b.evaluatedAt||b.date||0)-new Date(a.evaluatedAt||a.date||0))[0]);
              let sumPct = 0; let count = 0;
              latestAreaEvals.forEach(ev => {
                const items = Array.isArray(ev.items) ? ev.items : [];
                const s = items.reduce((ss,it)=> ss + (Number(it.score)||0), 0);
                const c = items.length || 1;
                sumPct += Math.round((s/(c*5))*100);
                count += 1;
              });
              const avg = count>0 ? Math.round(sumPct/count) : 0;
              return { name: l.fullName || l.name || l.email || 'Lecturer', score: avg };
            });
            setTeamPerformance(perf);

            // Recent Activity: combine latest area evaluations for the department
            const activity = [];
            lecturers.forEach((l, idx) => {
              const evs = Array.isArray(results[idx]) ? results[idx] : [];
              evs.forEach(ev => {
                activity.push({
                  id: `area-${l.id}-${ev.id || (ev.evaluatedAt || ev.date || Math.random())}`,
                  type: 'evaluation',
                  description: `Area evaluation for ${l.fullName || l.name || l.email}: ${ev.area?.name || 'Area'}`,
                  date: ev.evaluatedAt || ev.date || new Date().toISOString(),
                  departmentId: user.departmentId,
                  status: 'completed',
                  lecturerName: l.fullName || l.name || l.email || 'Lecturer',
                  areaName: ev.area?.name || 'Area'
                });
              });
            });
            activity.sort((a,b)=> new Date(b.date) - new Date(a.date));
            setRecentActivity(activity.slice(0, 10));
          } else {
            setTeamPerformance([]);
            setRecentActivity([]);
          }
        } catch (e) {
          // Keep existing if aggregation fails
          setTeamPerformance(prev => prev || []);
          setRecentActivity(prev => prev || []);
        }
      } catch (err) {
        console.error('Error fetching HOD dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (user?.departmentId) {
      fetchDashboardData();
    }
  }, [user]);

  const renderQuickActions = () => (
    <div className="quick-actions-grid">
      <Link to="/lecturers" className="action-btn">
        <span className="action-icon">Lecturers</span>
      </Link>
      {/*<Link to="/lecturers" className="action-btn">
        <span className="action-icon">assignment</span>
      </Link>*/}
      <Link to="/workplan" className="action-btn">
        <span className="action-icon">My Workplan</span>
      </Link>
      {/*<Link to="/evaluations" className="action-btn">
        <span className="action-icon">fact_check</span>
      </Link>*/}
    </div>
  );

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p>Loading dashboard data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error-container">
          <div className="error-content">
            <h3>Dashboard Error</h3>
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className="btn btn-primary">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>Welcome, {user.name}!</h1>
          <p>Department Management Dashboard</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.teamMembers}</h3>
            <p>Lecturers</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.activeKPIs}</h3>
            <p>Active KPIs</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.completedEvaluations}</h3>
            <p>Completed Evaluations</p>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="content-column">
          <div className="card">
            <h3>Team Performance</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={teamPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="score" fill="#11486B" name="Score" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3>Quick Actions</h3>
            {renderQuickActions()}
          </div>
        </div>

        <div className="content-column">
          <div className="card activity-card">
            <h3>Recent Activity</h3>
            <div className="activity-list">
              {recentActivity.length > 0 ? (
                recentActivity.map((a) => (
                  <div key={a.id} className="activity-desc-item">
                    <div className="activity-desc-text">{a.description}</div>
                    <div className="activity-desc-meta">
                      <span className="meta-item">{a.lecturerName || '-'}</span>
                      <span className="meta-sep">•</span>
                      <span className="meta-item">{a.areaName || '-'}</span>
                      <span className="meta-sep">•</span>
                      <span className="meta-item">{new Date(a.date).toLocaleDateString()}</span>
                      <span className="meta-spacer" />
                      <span className={`status-badge ${a.status === 'completed' ? 'ok' : 'warn'}`}>{a.status}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-data">No recent activity</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HODDashboard;