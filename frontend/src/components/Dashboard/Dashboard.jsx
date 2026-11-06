import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import dashboardApi from '../../api/dashboard';
import './Dashboard.css';

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [departmentData, setDepartmentData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const COLORS = ['#11486B', '#1a5a7a', '#4a90a4', '#7bb3c7', '#a8d0e6'];

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch all dashboard data in parallel
        const [statsRes, activityRes, perfRes, deptRes] = await Promise.all([
          dashboardApi.getDashboardStats(),
          dashboardApi.getRecentActivity(),
          dashboardApi.getPerformanceData(),
          dashboardApi.getDepartmentData(),
        ]);

        setStats(statsRes || {});
        setRecentActivity(activityRes || []);
        setPerformanceData(perfRes || []);
        setDepartmentData(deptRes || []);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
        setStats({});
        setPerformanceData([]);
        setRecentActivity([]);
        setDepartmentData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [user]);


  const getActivityIcon = (type) => {
    const icons = {
      create: '➕',
      complete: '✅',
      submit: '📤',
      report: '📊',
      assign: '📋',
      achievement: '🏆',
      update: '🔄'
    };
    return icons[type] || '📄';
  };

  // Render functions for each role (keep the same as before)
  const renderAdminDashboard = () => (
    <>
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>Welcome back, {user.name}!</h1>
          <p>System Administrator Dashboard</p>
        </div>
        <div className="current-date">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{stats.totalUsers || 0}</h3>
            <p>Total Users</p>
          </div>
          <Link to="/users" className="stat-link">Manage →</Link>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>{stats.totalLecturers || 0}</h3>
            <p>Lecturers</p>
          </div>
          <Link to="/lecturers" className="stat-link">View →</Link>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🏢</div>
          <div className="stat-content">
            <h3>{stats.totalDepartments || 0}</h3>
            <p>Departments</p>
          </div>
          <Link to="/departments" className="stat-link">Manage →</Link>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{stats.completedEvaluations || 0}</h3>
            <p>Completed Evals</p>
          </div>
          <Link to="/evaluations" className="stat-link">Review →</Link>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="content-column">
          <div className="card">
            <h3>Performance by Category</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#11486B" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="content-column">
          <div className="card">
            <h3>Department Overview</h3>
            <div className="department-stats">
              {departmentData.map((dept, index) => (
                <div key={index} className="department-item">
                  <h4>{dept.name}</h4>
                  <div className="dept-metrics">
                    <span>{dept.lecturers} Lecturers</span>
                    <span className="score">{dept.avgScore}% Avg</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderDeanDashboard = () => (
    <>
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>Welcome, Dean {user.name}!</h1>
          <p>Faculty Overview Dashboard</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.totalDepartments || 0}</h3>
            <p>Departments</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.totalLecturers || 0}</h3>
            <p>Faculty Members</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.completedEvaluations || 0}</h3>
            <p>Completed Evaluations</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.pendingApprovals || 0}</h3>
            <p>Pending Reviews</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Department Performance</h3>
        <div className="performance-list">
          {departmentData.map((dept, index) => (
            <div key={index} className="performance-item">
              <span className="dept-name">{dept.name}</span>
              <span className="dept-score">{dept.avgScore}%</span>
              <span className="dept-count">{dept.lecturers} staff</span>
            </div>
          ))}
        </div>
      </div>
      {/* Dean cannot manage users, departments, or KPIs. No management links here. */}
    </>
  );

  const renderHODDashboard = () => (
    <>
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>Welcome, HOD {user.name}!</h1>
          <p>Department Management Dashboard</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.assignedLecturers || 0}</h3>
            <p>Team Members</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.totalKPIs || 0}</h3>
            <p>Active KPIs</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.completedEvaluations || 0}</h3>
            <p>Completed Evals</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.pendingReview || 0}</h3>
            <p>Pending Review</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Team Performance</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="score" fill="#11486B" name="Score" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );

  const renderLecturerDashboard = () => (
    <>
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>Welcome, {user.name}!</h1>
          <p>My Performance Dashboard</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.assignedKPIs || 0}</h3>
            <p>Assigned KPIs</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.completedTasks || 0}</h3>
            <p>Completed Tasks</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.currentScore || 0}</h3>
            <p>Current Score</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <h3>{stats.submissionRate || '0%'}</h3>
            <p>Submission Rate</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>My Performance Breakdown</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={performanceData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {performanceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );

  const renderQuickActions = () => (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Quick Actions</h2>
      </div>
      <div className="quick-actions-grid">
        {user.role === 'admin' && (
          <>
            <Link to="/users/create" className="action-btn">
              <span className="action-icon">➕</span>
              <span>Add User</span>
            </Link>
            <Link to="/kpi-management" className="action-btn">
              <span className="action-icon">📊</span>
              <span>Manage KPIs</span>
            </Link>
            <Link to="/departments" className="action-btn">
              <span className="action-icon">🏢</span>
              <span>Departments</span>
            </Link>
          </>
        )}
        {/* Dean cannot manage users, departments, or KPIs. Only see reports/policies. */}
        {user.role === 'dean' && (
          <>
            <Link to="/faculty-reports" className="action-btn">
              <span className="action-icon">📄</span>
              <span>Reports</span>
            </Link>
            <Link to="/policy-review" className="action-btn">
              <span className="action-icon">📋</span>
              <span>Policies</span>
            </Link>
          </>
        )}
        {user.role === 'hod' && (
          <>
            <Link to="/team-management" className="action-btn">
              <span className="action-icon">👥</span>
              <span>My Team</span>
            </Link>
            <Link to="/kpi-assignment" className="action-btn">
              <span className="action-icon">📋</span>
              <span>Assign KPIs</span>
            </Link>
            <Link to="/evaluation-review" className="action-btn">
              <span className="action-icon">✅</span>
              <span>Review Evals</span>
            </Link>
          </>
        )}
        {user.role === 'lecturer' && (
          <>
            <Link to="/workplan?tab=create" className="action-btn">
              <span className="action-icon">📝</span>
              <span>Workplan</span>
            </Link>
            <Link to="/workplan?tab=kpis" className="action-btn">
              <span className="action-icon">📊</span>
              <span>My KPIs</span>
            </Link>
            <Link to="/workplan?tab=history" className="action-btn">
              <span className="action-icon">📤</span>
              <span>Submissions</span>
            </Link>
          </>
        )}
      </div>
    </div>
  );

  const renderRecentActivity = () => (
    <div className="card activity-card">
      <div className="card-header">
        <h2 className="card-title">Recent Activity</h2>
      </div>
      <div className="activity-list">
        {recentActivity.length > 0 ? (
          recentActivity.map(activity => (
            <div key={activity.id} className="activity-item">
              <div className="activity-icon">{getActivityIcon(activity.type)}</div>
              <div className="activity-content">
                <p className="activity-action">{activity.action}</p>
                <span className="activity-time">{activity.time}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="no-data">
            <p>No recent activity</p>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          Loading dashboard data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error-message">
          <h3>⚠️ Dashboard Error</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {user.role === 'admin' && renderAdminDashboard()}
      {user.role === 'dean' && renderDeanDashboard()}
      {user.role === 'hod' && renderHODDashboard()}
      {user.role === 'lecturer' && renderLecturerDashboard()}
      
      <div className="dashboard-content">
        <div className="content-column">
          {renderQuickActions()}
        </div>
        <div className="content-column">
          {renderRecentActivity()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;