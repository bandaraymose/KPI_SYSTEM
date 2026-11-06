import React, { useEffect, useState } from 'react';
import http from '../../api/httpClient';
import { Link } from 'react-router-dom';
import './HODWorkplans.css';

const HODWorkplans = ({ user }) => {
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
    const fetchWorkplans = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch workplans assigned TO this HOD with filters
        const queryParams = new URLSearchParams({
          assigneeId: user.id, // Get workplans assigned to this HOD
          ...filters
        }).toString();
        
        const res = await http.get(`/WorkplanAssignments/my?${queryParams}`);
        setWorkplans(Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : []);
      } catch (err) {
        console.error('Error fetching workplans:', err);
        setError('Failed to load workplans. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'hod' && user?.departmentId) {
      fetchWorkplans();
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
      case 'approved':
        return 'approved';
      case 'rejected':
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
        wp.lecturer?.fullName?.toLowerCase().includes(searchTerm) ||
        wp.academicYear?.toString().includes(searchTerm))
    );
  });

  return (
    <div className="hod-workplans-container">
      <h2>
        My Assigned Workplans
        <div className="header-actions">
          <span className="info-text">Workplans assigned to you by your Dean</span>
        </div>
      </h2>

      <div className="filters-row">
        <input
          type="text"
          placeholder="Search by lecturer name..."
          className="filter-input"
          value={filters.search}
          onChange={(e) => handleFilterChange('search', e.target.value)}
        />
        
       

        <select
          className="filter-select"
          value={filters.academicYear}
          onChange={(e) => handleFilterChange('academicYear', e.target.value)}
        >
          <option value="">All Years</option>
          {[...new Set(workplans.map(wp => wp.academicYear))]
            .filter(Boolean)
            .sort()
            .reverse()
            .map(year => (
              <option key={year} value={year}>{year}</option>
            ))
          }
        </select>

        <select
          className="filter-select"
          value={filters.semester}
          onChange={(e) => handleFilterChange('semester', e.target.value)}
        >
          <option value="">All Terms</option>
          <option value="1">Term 1</option>
          <option value="2">Term 2</option>
          <option value="3">Term 3</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading workplans...</p>
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
        <div className="empty-state">
          <p>No workplans have been assigned to you yet.</p>
          <p>Your Dean will assign workplans to you, and they will appear here.</p>
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
        <table className="workplans-table">
          <thead>
            <tr>
              <th>Assigned To</th>
              <th>Workplan Title</th>
              <th>Academic Year</th>
              <th>Term</th>
              <th>Assigned At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredWorkplans.map(wp => (
            <tr key={wp.id}>
                <td>You ({user.fullName || user.name})</td>
                <td>{wp.workplan?.title || wp.title || 'Standard Workplan'}</td>
                <td>{wp.academicYear || '-'}</td>
                <td>{wp.semester || '-'}</td>
                <td>{formatDate(wp.assignedAt || wp.createdAt)}</td>
                <td>
                  <span className={`status-badge ${getStatusBadgeClass(wp.status)}`}>
                    {wp.status || 'Assigned'}
                  </span>
                </td>
                <td className="btn-group">
                  <Link 
                    to={`/workplans/${wp.id}`} 
                    className="btn btn-sm btn-outline"
                  >
                    View Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default HODWorkplans;
