import React, { useState, useEffect } from 'react';
import http from '../../api/httpClient';
import './WorkplanReview.css'; // Reuse existing styles

const DeanWorkplan = ({ user }) => {
  const [workplanData, setWorkplanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState({
    academicYear: '',
    semester: ''
  });
  const [updating, setUpdating] = useState(false);

  // Generate academic year options
  const generateAcademicYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 2; i <= currentYear + 2; i++) {
      years.push(`${i}/${i + 1}`);
    }
    return years;
  };

  useEffect(() => {
    if (user?.role === 'dean' && user?.id) {
      fetchDeanWorkplan();
    }
  }, [user, selectedPeriod]); // fetchDeanWorkplan is called inside useEffect so it's safe

  const fetchDeanWorkplan = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedPeriod.academicYear) {
        params.append('academicYear', selectedPeriod.academicYear);
      }
      if (selectedPeriod.semester) {
        params.append('semester', selectedPeriod.semester);
      }

      const response = await http.get(`/StandardWorkplans/dean-workplan?${params.toString()}`);
      setWorkplanData(response.data || response);
    } catch (err) {
      console.error('Error fetching dean workplan:', err);
      setError('Failed to load dean workplan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = async (status, progress, notes = '') => {
    if (!workplanData?.Assignment?.Id) return;

    setUpdating(true);
    try {
      const updateData = {
        status: status,
        progress: progress,
        notes: notes
      };

      await http.put(`/WorkplanAssignments/${workplanData.Assignment.Id}/status`, updateData);
      
      // Refresh workplan data
      await fetchDeanWorkplan();
      
      alert(`Workplan status updated to: ${status}`);
    } catch (err) {
      console.error('Error updating progress:', err);
      alert('Failed to update progress. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusUpdate = (newStatus) => {
    const progressMap = {
      'InProgress': 25,
      'Completed': 100,
      'Reviewed': 100
    };

    const progress = progressMap[newStatus] || workplanData?.Assignment?.Progress || 0;
    const notes = prompt(`Please add notes for status change to ${newStatus}:`) || '';
    
    if (notes || newStatus === 'InProgress') {
      updateProgress(newStatus, progress, notes);
    }
  };

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
      case 'reviewed':
        return 'approved';
      case 'inprogress':
        return 'pending';
      default:
        return 'pending';
    }
  };

  if (loading) {
    return (
      <div className="workplan-review-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading dean workplan...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="workplan-review-container">
        <div className="error">
          <p>{error}</p>
          <button 
            className="btn btn-outline btn-sm"
            onClick={fetchDeanWorkplan}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { Workplan: workplan, Assignment: assignment, IsNewlyCreated } = workplanData || {};

  return (
    <div className="workplan-review-container">
      <div className="page-header">
        <div className="header-content">
          <h1>Dean Strategic Workplan</h1>
          <p>Your comprehensive academic leadership and administrative workplan</p>
          {IsNewlyCreated && (
            <div className="alert alert-info">
              <p>🎉 New workplan automatically created for the current academic period!</p>
            </div>
          )}
        </div>
        
        {/* Period Selection */}
        <div className="period-selection">
          <div className="filter-group">
            <label htmlFor="academic-year">Academic Year:</label>
            <select
              id="academic-year"
              value={selectedPeriod.academicYear}
              onChange={(e) => setSelectedPeriod(prev => ({...prev, academicYear: e.target.value}))}
              className="filter-select"
            >
              <option value="">Current Year</option>
              {generateAcademicYears().map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label htmlFor="semester">Semester:</label>
            <select
              id="semester"
              value={selectedPeriod.semester}
              onChange={(e) => setSelectedPeriod(prev => ({...prev, semester: e.target.value}))}
              className="filter-select"
            >
              <option value="">Current Semester</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
              <option value="3">Semester 3</option>
            </select>
          </div>
        </div>
      </div>

      {/* Status Overview */}
      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>{workplan?.AcademicYear || 'Current'}</h3>
            <p>Academic Year</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📚</div>
          <div className="stat-content">
            <h3>Semester {workplan?.Semester || 'Current'}</h3>
            <p>Term</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h3>{assignment?.Progress || 0}%</h3>
            <p>Progress</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <div className={`badge ${getStatusBadgeClass(assignment?.Status)}`}>
              {assignment?.Status || 'Assigned'}
            </div>
            <p>Status</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button 
          className="btn btn-primary"
          onClick={() => handleStatusUpdate('InProgress')}
          disabled={updating || assignment?.Status === 'InProgress'}
        >
          {updating ? 'Updating...' : 'Start Working'}
        </button>
        
        <button 
          className="btn btn-success"
          onClick={() => handleStatusUpdate('Completed')}
          disabled={updating || assignment?.Status === 'Completed' || assignment?.Status === 'Reviewed'}
        >
          {updating ? 'Updating...' : 'Mark Complete'}
        </button>
        
        <button 
          className="btn btn-outline"
          onClick={fetchDeanWorkplan}
          disabled={updating}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Workplan Details */}
      {workplan && (
        <div className="workplan-details-container">
          <div className="workplan-card">
            <div className="workplan-header">
              <h2>{workplan.Title}</h2>
              <p className="workplan-description">{workplan.Description}</p>
            </div>

            <div className="workplan-sections">
              <div className="workplan-section">
                <h3>🎓 Teaching Activities</h3>
                <div className="activity-content">
                  {workplan.TeachingActivities.split('\n').map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              </div>

              <div className="workplan-section">
                <h3>🔬 Research Activities</h3>
                <div className="activity-content">
                  {workplan.ResearchActivities.split('\n').map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              </div>

              <div className="workplan-section">
                <h3>🤝 Service Activities</h3>
                <div className="activity-content">
                  {workplan.ServiceActivities.split('\n').map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              </div>

              <div className="workplan-section">
                <h3>⚙️ Administrative Activities</h3>
                <div className="activity-content">
                  {workplan.AdministrativeActivities.split('\n').map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              </div>

              <div className="workplan-section">
                <h3>📈 Professional Development</h3>
                <div className="activity-content">
                  {workplan.ProfessionalDevelopment.split('\n').map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              </div>

              <div className="workplan-section">
                <h3>🎯 Objectives</h3>
                <div className="activity-content">
                  {workplan.Objectives.split('\n').map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              </div>

              <div className="workplan-section">
                <h3>✅ Expected Outcomes</h3>
                <div className="activity-content">
                  {workplan.ExpectedOutcomes.split('\n').map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Assignment Information */}
          {assignment && (
            <div className="assignment-info">
              <h3>Assignment Information</h3>
              <div className="assignment-details">
                <div className="detail-row">
                  <span className="label">Assigned:</span>
                  <span className="value">{formatDate(assignment.AssignedAt)}</span>
                </div>
                {assignment.StartedAt && (
                  <div className="detail-row">
                    <span className="label">Started:</span>
                    <span className="value">{formatDate(assignment.StartedAt)}</span>
                  </div>
                )}
                {assignment.CompletedAt && (
                  <div className="detail-row">
                    <span className="label">Completed:</span>
                    <span className="value">{formatDate(assignment.CompletedAt)}</span>
                  </div>
                )}
                {assignment.AssignmentNotes && (
                  <div className="detail-row">
                    <span className="label">Notes:</span>
                    <span className="value">{assignment.AssignmentNotes}</span>
                  </div>
                )}
                {assignment.CompletionNotes && (
                  <div className="detail-row">
                    <span className="label">Completion Notes:</span>
                    <span className="value">{assignment.CompletionNotes}</span>
                  </div>
                )}
                {assignment.ReviewFeedback && (
                  <div className="detail-row">
                    <span className="label">Review Feedback:</span>
                    <span className="value">{assignment.ReviewFeedback}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DeanWorkplan;