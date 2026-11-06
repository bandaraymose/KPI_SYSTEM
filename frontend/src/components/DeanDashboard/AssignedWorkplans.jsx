import React, { useEffect, useState } from 'react';
import http from '../../api/httpClient';
import { Link } from 'react-router-dom';
import './WorkplanReview.css'; // Reuse existing styles

const DeanAssignedWorkplans = ({ user }) => {
  const [workplans, setWorkplans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    academicYear: '',
    semester: '',
    search: ''
  });

  useEffect(() => {
    const fetchAssignedWorkplans = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch workplans assigned TO this Dean with filters
        const queryParams = new URLSearchParams({
          assigneeId: user.id, // Get workplans assigned to this Dean
          ...filters
        }).toString();
        
        const res = await http.get(`/WorkplanAssignments/my?${queryParams}`);
        setWorkplans(Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : []);
      } catch (err) {
        console.error('Error fetching assigned workplans:', err);
        setError('Failed to load assigned workplans. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'dean' && user?.id) {
      fetchAssignedWorkplans();
    }
  }, [user, filters]);

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return 'Invalid date';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'submitted':
        return 'approved';
      case 'in-progress':
        return 'pending';
      case 'overdue':
        return 'rejected';
      default:
        return 'pending';
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const filteredWorkplans = workplans.filter(wp => {
    const searchTerm = filters.search.toLowerCase();
    return (
      (!filters.status || wp.status?.toLowerCase() === filters.status.toLowerCase()) &&
      (!filters.academicYear || wp.academicYear === filters.academicYear) &&
      (!filters.semester || wp.semester === filters.semester) &&
      (!searchTerm || 
        wp.workplan?.title?.toLowerCase().includes(searchTerm) ||
        wp.assignedBy?.fullName?.toLowerCase().includes(searchTerm))
    );
  });


  return (
    <div className="workplan-review-container">
      <div className="page-header">
        <div className="header-content">
          <h1>My Assigned Workplans</h1>
          <p>View workplans assigned to you by the system</p>
        </div>
      </div>

      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <h3>{workplans.length}</h3>
            <p>Total Assigned</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <h3>{workplans.filter(wp => wp.status === 'in-progress').length}</h3>
            <p>In Progress</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{workplans.filter(wp => wp.status === 'completed').length}</h3>
            <p>Completed</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>{workplans.filter(wp => wp.status === 'assigned' || wp.status === 'pending').length}</h3>
            <p>Pending</p>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by workplan title or assigned by..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="filter-controls">
          <div className="filter-group">
            <label htmlFor="status-filter">Status:</label>
            <select
              id="status-filter"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="filter-select"
            >
              <option value="">All Status</option>
              <option value="assigned">Assigned</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="academic-year-filter">Academic Year:</label>
            <select
              id="academic-year-filter"
              value={filters.academicYear}
              onChange={(e) => handleFilterChange('academicYear', e.target.value)}
              className="filter-select"
            >
              <option value="">All Years</option>
              {[...new Set(workplans.map(wp => wp.academicYear))].filter(Boolean).sort().reverse().map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <button onClick={() => setFilters(prev => ({...prev}))} className="btn btn-outline btn-sm">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Workplans List */}
      {loading ? (
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading assigned workplans...</p>
        </div>
      ) : error ? (
        <div className="error">
          <p>{error}</p>
          <button 
            className="btn btn-outline btn-sm"
            onClick={() => setFilters(prev => ({...prev}))} // Trigger re-fetch
          >
            Retry
          </button>
        </div>
      ) : filteredWorkplans.length === 0 ? (
        <div className="no-results">
          <div className="no-results-icon">📋</div>
          <h3>No assigned workplans found</h3>
          <p>No workplans have been assigned to you yet, or none match your current filters.</p>
          {Object.values(filters).some(Boolean) && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setFilters({
                status: '',
                academicYear: '',
                semester: '',
                search: ''
              })}
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="workplans-list">
          {filteredWorkplans.map(workplan => (
            <div key={workplan.id} className="workplan-card">
              <div className="workplan-header">
                <div className="workplan-info">
                  <h3 className="workplan-title">{workplan.workplan?.title || workplan.title || 'Standard Workplan'}</h3>
                  <div className="workplan-meta">
                    <span className="assigned-by">👤 Assigned by: {workplan.assignedBy?.fullName || 'System'}</span>
                    <span className="date">📅 {formatDate(workplan.assignedAt || workplan.createdAt)}</span>
                  </div>
                </div>
                <div className="workplan-status">
                  <span className={`badge ${getStatusBadgeClass(workplan.status)}`}>
                    {workplan.status || 'Assigned'}
                  </span>
                </div>
              </div>

              <div className="workplan-content">
                {workplan.assignmentNotes && (
                  <p className="workplan-description">
                    <strong>Assignment Notes:</strong> {workplan.assignmentNotes}
                  </p>
                )}
                
                <div className="workplan-details">
                  <div className="detail-item">
                    <span className="label">Academic Year:</span>
                    <span className="value">{workplan.academicYear || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Semester:</span>
                    <span className="value">Semester {workplan.semester || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Assigned By:</span>
                    <span className="value">{workplan.assignedBy?.fullName || 'System'}</span>
                  </div>
                </div>
              </div>

              <div className="workplan-actions">
                <Link 
                  to={`/workplans/${workplan.id}`} 
                  className="btn btn-outline btn-sm"
                >
                  📄 View Details
                </Link>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => {/* Handle workplan progress update */}}
                >
                  ✏️ Update Progress
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeanAssignedWorkplans;