import React, { useState, useEffect } from 'react';
import apiService from '../../utils/api';
import './WorkplanReview.css';

const WorkplanReview = ({ user }) => {
  const [workplans, setWorkplans] = useState([]);
  const [filteredWorkplans, setFilteredWorkplans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedWorkplan, setSelectedWorkplan] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showSubmitToVCModal, setShowSubmitToVCModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    status: '',
    comments: ''
  });
  const [vcSubmissionForm, setVcSubmissionForm] = useState({
    title: '',
    description: '',
    academicYear: new Date().getFullYear().toString(),
    semester: '1'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchWorkplans();
  }, []);

  useEffect(() => {
    // Filter workplans based on search and status
    let filtered = workplans.filter(workplan => {
      const matchesSearch = workplan.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           workplan.submittedBy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           workplan.department?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || workplan.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    setFilteredWorkplans(filtered);
  }, [workplans, searchTerm, statusFilter]);

  const fetchWorkplans = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Fetch all workplans submitted to Dean
      const response = await apiService.getWorkplansForReview();
      const transformedWorkplans = (response || []).map(workplan => ({
        id: workplan.id,
        title: workplan.title || 'Untitled Workplan',
        description: workplan.description || '',
        submittedBy: workplan.lecturer?.fullName || workplan.submittedBy || 'Unknown',
        department: workplan.lecturer?.department || workplan.department || 'Unknown Department',
        status: workplan.status || 'Pending',
        submittedDate: workplan.createdAt || workplan.submittedDate,
        objectives: workplan.objectives || [],
        kpis: workplan.kpis || [],
        academicYear: workplan.academicYear || new Date().getFullYear().toString(),
        semester: workplan.semester || '1',
        comments: workplan.comments || ''
      }));
      
      setWorkplans(transformedWorkplans);
    } catch (error) {
      console.error('Error fetching workplans:', error);
      setError('Failed to load workplans. Please try again.');
      setWorkplans([]);
    }
    
    setLoading(false);
  };

  const handleReviewWorkplan = (workplan) => {
    setSelectedWorkplan(workplan);
    setReviewForm({
      status: workplan.status === 'Pending' ? 'Approved' : workplan.status,
      comments: ''
    });
    setShowReviewModal(true);
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.status) {
      alert('Please select a review status');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.reviewWorkplan(selectedWorkplan.id, {
        status: reviewForm.status,
        comments: reviewForm.comments,
        reviewedBy: user.id
      });
      
      setShowReviewModal(false);
      alert('Workplan review submitted successfully!');
      setSelectedWorkplan(null);
      await fetchWorkplans(); // Refresh data
    } catch (error) {
      alert('Failed to submit review: ' + (error.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitToVC = () => {
    setVcSubmissionForm({
      title: 'Faculty Consolidated Workplan',
      description: 'Consolidated workplan from all departments for VC review',
      academicYear: new Date().getFullYear().toString(),
      semester: '1'
    });
    setShowSubmitToVCModal(true);
  };

  const submitToVC = async (e) => {
    e.preventDefault();
    if (!vcSubmissionForm.title || !vcSubmissionForm.description) {
      alert('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      // Simulate submission to VC
      await apiService.submitWorkplanToVC({
        title: vcSubmissionForm.title,
        description: vcSubmissionForm.description,
        academicYear: vcSubmissionForm.academicYear,
        semester: vcSubmissionForm.semester,
        submittedBy: user.id,
        workplanIds: workplans.filter(wp => wp.status === 'Approved').map(wp => wp.id)
      });
      
      setShowSubmitToVCModal(false);
      alert('Consolidated workplan submitted to VC successfully!');
    } catch (error) {
      alert('Failed to submit to VC: ' + (error.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'Pending': { label: 'Pending Review', class: 'badge-warning' },
      'Approved': { label: 'Approved', class: 'badge-success' },
      'Rejected': { label: 'Rejected', class: 'badge-danger' },
      'Under Review': { label: 'Under Review', class: 'badge-info' }
    };
    
    const statusInfo = statusMap[status] || statusMap['Pending'];
    return (
      <span className={`badge ${statusInfo.class}`}>
        {statusInfo.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="workplan-review-container">
        <div className="loading">Loading workplans...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="workplan-review-container">
        <div className="error-message">
          <h3>❌ Error Loading Data</h3>
          <p>{error}</p>
          <button onClick={fetchWorkplans} className="btn btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="workplan-review-container">
      <div className="page-header">
        <div className="header-content">
          <h1>Workplan Review</h1>
          <p>Review and approve workplans submitted by HODs</p>
        </div>
        <div className="header-actions">
          <button 
            onClick={handleSubmitToVC}
            className="btn btn-primary"
            disabled={workplans.filter(wp => wp.status === 'Approved').length === 0}
          >
            📤 Submit to VC
          </button>
        </div>
      </div>

      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <h3>{workplans.length}</h3>
            <p>Total Workplans</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <h3>{workplans.filter(wp => wp.status === 'Pending').length}</h3>
            <p>Pending Review</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{workplans.filter(wp => wp.status === 'Approved').length}</h3>
            <p>Approved</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">❌</div>
          <div className="stat-content">
            <h3>{workplans.filter(wp => wp.status === 'Rejected').length}</h3>
            <p>Rejected</p>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search workplans by title, submitter, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="filter-controls">
          <div className="filter-group">
            <label htmlFor="status-filter">Status:</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="Pending">Pending Review</option>
              <option value="Under Review">Under Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <button onClick={fetchWorkplans} className="btn btn-outline btn-sm">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Workplans List */}
      <div className="workplans-list">
        {filteredWorkplans.map(workplan => (
          <div key={workplan.id} className="workplan-card">
            <div className="workplan-header">
              <div className="workplan-info">
                <h3 className="workplan-title">{workplan.title}</h3>
                <div className="workplan-meta">
                  <span className="submitter">👤 {workplan.submittedBy}</span>
                  <span className="department">🏢 {workplan.department}</span>
                  <span className="date">📅 {formatDate(workplan.submittedDate)}</span>
                </div>
              </div>
              <div className="workplan-status">
                {getStatusBadge(workplan.status)}
              </div>
            </div>

            <div className="workplan-content">
              <p className="workplan-description">
                {workplan.description || 'No description provided'}
              </p>
              
              {workplan.objectives && workplan.objectives.length > 0 && (
                <div className="workplan-objectives">
                  <h4>Key Objectives:</h4>
                  <ul>
                    {workplan.objectives.slice(0, 3).map((objective, index) => (
                      <li key={index}>{objective}</li>
                    ))}
                    {workplan.objectives.length > 3 && (
                      <li>... and {workplan.objectives.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="workplan-details">
                <div className="detail-item">
                  <span className="label">Academic Year:</span>
                  <span className="value">{workplan.academicYear}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Semester:</span>
                  <span className="value">Semester {workplan.semester}</span>
                </div>
                <div className="detail-item">
                  <span className="label">KPIs:</span>
                  <span className="value">{workplan.kpis.length} assigned</span>
                </div>
              </div>
            </div>

            <div className="workplan-actions">
              <button 
                className="btn btn-outline btn-sm"
                onClick={() => {/* View full details */}}
              >
                📄 View Details
              </button>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => handleReviewWorkplan(workplan)}
              >
                ✅ Review
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredWorkplans.length === 0 && workplans.length > 0 && (
        <div className="no-results">
          <div className="no-results-icon">🔍</div>
          <h3>No workplans found</h3>
          <p>Try adjusting your search criteria or filters.</p>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && selectedWorkplan && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Review Workplan: {selectedWorkplan.title}</h3>
              <button 
                className="modal-close"
                onClick={() => setShowReviewModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={submitReview} className="modal-form">
              <div className="form-group">
                <label htmlFor="review-status" className="form-label">Review Decision *</label>
                <select
                  id="review-status"
                  value={reviewForm.status}
                  onChange={(e) => setReviewForm({...reviewForm, status: e.target.value})}
                  className="form-select"
                  required
                >
                  <option value="">-- Select Decision --</option>
                  <option value="Approved">Approve</option>
                  <option value="Rejected">Reject</option>
                  <option value="Under Review">Request Changes</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="review-comments" className="form-label">Comments</label>
                <textarea
                  id="review-comments"
                  value={reviewForm.comments}
                  onChange={(e) => setReviewForm({...reviewForm, comments: e.target.value})}
                  className="form-textarea"
                  rows="4"
                  placeholder="Enter review comments and feedback..."
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => setShowReviewModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit to VC Modal */}
      {showSubmitToVCModal && (
        <div className="modal-overlay" onClick={() => setShowSubmitToVCModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Submit Consolidated Workplan to VC</h3>
              <button 
                className="modal-close"
                onClick={() => setShowSubmitToVCModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={submitToVC} className="modal-form">
              <div className="form-group">
                <label htmlFor="vc-title" className="form-label">Workplan Title *</label>
                <input
                  type="text"
                  id="vc-title"
                  value={vcSubmissionForm.title}
                  onChange={(e) => setVcSubmissionForm({...vcSubmissionForm, title: e.target.value})}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="vc-academic-year" className="form-label">Academic Year *</label>
                  <input
                    type="text"
                    id="vc-academic-year"
                    value={vcSubmissionForm.academicYear}
                    onChange={(e) => setVcSubmissionForm({...vcSubmissionForm, academicYear: e.target.value})}
                    className="form-input"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="vc-semester" className="form-label">Semester *</label>
                  <select
                    id="vc-semester"
                    value={vcSubmissionForm.semester}
                    onChange={(e) => setVcSubmissionForm({...vcSubmissionForm, semester: e.target.value})}
                    className="form-select"
                    required
                  >
                    <option value="1">Semester 1</option>
                    <option value="2">Semester 2</option>
                    <option value="Annual">Annual</option>
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="vc-description" className="form-label">Description *</label>
                <textarea
                  id="vc-description"
                  value={vcSubmissionForm.description}
                  onChange={(e) => setVcSubmissionForm({...vcSubmissionForm, description: e.target.value})}
                  className="form-textarea"
                  rows="4"
                  placeholder="Enter a description for the consolidated workplan..."
                  required
                />
              </div>

              <div className="info-box">
                <p><strong>Approved Workplans to Include:</strong> {workplans.filter(wp => wp.status === 'Approved').length}</p>
                <p>This will consolidate all approved departmental workplans for VC review.</p>
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => setShowSubmitToVCModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit to VC'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkplanReview;