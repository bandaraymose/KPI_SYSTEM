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
        if (err.response?.status === 401) {
          setError('Your session has expired. Please log in again to continue.');
          // Redirect to login after a short delay
          setTimeout(() => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }, 3000);
        } else {
          setError('Failed to load dashboard data. Please try again.');
        }
        setStats({});
        setPerformanceData([]);
        setRecentActivity([]);
        setDepartmentData([]);
      } finally {
        setLoading(false);
      }
    };
    // Only fetch if we have a user
    if (user) {
      fetchDashboardData();
    } else {
      setError('No user found. Please log in.');
      setLoading(false);
    }
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
          <div className="stat-icon">🏢</div>
          <div className="stat-content">
            <h3>{stats.TotalDepartments || 0}</h3>
            <p>Departments</p>
          </div>
          <Link to="/departments" className="stat-link">View →</Link>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{stats.TotalUsers || 0}</h3>
            <p>Faculty Members</p>
          </div>
          <Link to="/lecturers" className="stat-link">View →</Link>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{stats.TotalEvaluations || 0}</h3>
            <p>Total Evaluations</p>
          </div>
          <Link to="/evaluations" className="stat-link">Review →</Link>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <h3>{stats.TotalWorkplans || 0}</h3>
            <p>Workplans</p>
          </div>
          <Link to="/workplans" className="stat-link">Review →</Link>
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
            <Link to="/users" className="action-btn">
              <span className="action-icon">➕</span>
              <span>Manage Users</span>
            </Link>
            <Link to="/kpi-management" className="action-btn">
              <span className="action-icon">📊</span>
              <span>Manage KPIs</span>
            </Link>
            <Link to="/departments" className="action-btn">
              <span className="action-icon">🏢</span>
              <span>Departments</span>
            </Link>
            <Link to="/reports" className="action-btn">
              <span className="action-icon">📈</span>
              <span>System Reports</span>
            </Link>
          </>
        )}
        
        {user.role === 'dean' && (
          <>
            <Link to="/departments" className="action-btn">
              <span className="action-icon">🏢</span>
              <span>Departments</span>
            </Link>
            <Link to="/lecturers" className="action-btn">
              <span className="action-icon">👥</span>
              <span>Manage HODs</span>
            </Link>
            <Link to="/workplans" className="action-btn">
              <span className="action-icon">📋</span>
              <span>Review Workplans</span>
            </Link>
            <Link to="/reports" className="action-btn">
              <span className="action-icon">📄</span>
              <span>View Reports</span>
            </Link>
          </>
        )}
        
        {user.role === 'hod' && (
          <>
            <Link to="/users" className="action-btn">
              <span className="action-icon">➕</span>
              <span>Manage Users</span>
            </Link>
            <Link to="/lecturers" className="action-btn">
              <span className="action-icon">👥</span>
              <span>My Team</span>
            </Link>
            <Link to="/workplan" className="action-btn">
              <span className="action-icon">📋</span>
              <span>My Workplan</span>
            </Link>
            <Link to="/reports" className="action-btn">
              <span className="action-icon">✅</span>
              <span>Reports & Evaluations</span>
            </Link>
          </>
        )}
        
        {user.role === 'lecturer' && (
          <>
            <Link to="/workplan" className="action-btn">
              <span className="action-icon">📝</span>
              <span>My Workplan</span>
            </Link>
            <Link to="/reports" className="action-btn">
              <span className="action-icon">📊</span>
              <span>My Performance</span>
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
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p>Loading dashboard data...</p>
            <p className="loading-subtext">Please wait while we fetch your information</p>
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
            <h3>⚠️ Dashboard Error</h3>
            <p>{error}</p>
            {error.includes('session has expired') || error.includes('Please log in') ? (
              <button 
                onClick={() => window.location.href = '/login'} 
                className="btn btn-primary"
              >
                Go to Login
              </button>
            ) : (
              <button 
                onClick={() => window.location.reload()} 
                className="btn btn-primary"
              >
                Retry Loading
              </button>
            )}
          </div>
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