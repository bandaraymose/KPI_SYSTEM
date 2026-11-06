import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiService from '../../utils/api';
import './LecturerList.css';

const LecturerList = ({ user }) => {
  const [lecturers, setLecturers] = useState([]);
  const [filteredLecturers, setFilteredLecturers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAreaEvaluateModal, setShowAreaEvaluateModal] = useState(false);
  const [showAssignWorkplanModal, setShowAssignWorkplanModal] = useState(false);
  const [selectedLecturer, setSelectedLecturer] = useState(null);
  const [availableKpis, setAvailableKpis] = useState([]);
  const [availableAreas, setAvailableAreas] = useState([]);
  const [areaKpis, setAreaKpis] = useState([]);
  const [availableWorkplans, setAvailableWorkplans] = useState([]);
  const [kpiAssignments, setKpiAssignments] = useState([]);
  const [assignmentForm, setAssignmentForm] = useState({
    areaId: '',
    academicYear: '',
    semester: ''
  });
  const [workplanAssignmentForm, setWorkplanAssignmentForm] = useState({
    standardWorkplanId: '',
    assignmentNotes: ''
  });
  const [areaEvaluationForm, setAreaEvaluationForm] = useState({
    areaId: '',
    comments: '',
    scores: {}
  });
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('lecturers');
  const [workplans, setWorkplans] = useState([]);
  const [filteredWorkplans, setFilteredWorkplans] = useState([]);
  const [workplanFilter, setWorkplanFilter] = useState('all');
  
  useEffect(() => {
    
    const fetchLecturers = async () => {
      setLoading(true);
      setError('');
      
      try {
        // Check if user is authenticated
        const token = apiService.getAuthToken();
        if (!token) {
          throw new Error('Not authenticated. Please log in again.');
        }

        console.log('Fetching lecturers with token:', token ? 'Token exists' : 'No token');
        
        // Call appropriate API endpoint based on user role
        let response;
        if (user.role === 'dean') {
          // Dean should see HODs, not lecturers
          response = await apiService.getHODs();
        } else if (user.role === 'hod') {
          // HODs see only their department's lecturers
          response = await apiService.getMyDepartmentLecturers();
        } else {
          // Admins see all lecturers
          response = await apiService.getLecturers();
        }
        console.log('API Response:', response);
        
        // Handle empty response
        if (!response || !Array.isArray(response)) {
          console.log('Invalid response format:', response);
          setLecturers([]);
          setFilteredLecturers([]);
          return;
        }
        
        // Transform API data to match component expectations
        const transformedLecturers = response.map(lecturer => ({
          id: lecturer.id,
          name: lecturer.fullName,
          email: lecturer.email,
          department: lecturer.department || 'Unassigned',
          position: user.role === 'dean' ? 'HOD' : 'Lecturer',
          joinDate: '2020-01-01', // Default date - you can get this from user creation date
          assignedKPIs: 0, // Will be populated by KPI assignments API later
          completedKPIs: 0, // Will be populated by evaluations API later
          averageScore: 0, // Will be calculated from evaluations
          status: 'active', // Default status
          lastEvaluation: null,
          phone: 'N/A',
          officeLocation: 'N/A', // Not available in current API
          departmentId: lecturer.departmentId
        }));
        
        setLecturers(transformedLecturers);
        setFilteredLecturers(transformedLecturers);
      } catch (error) {
        console.error('Error fetching lecturers:', error);
        setError('Failed to load lecturers. Please try again.');
        
        // Fallback to empty array on error
        setLecturers([]);
        setFilteredLecturers([]);
      }
      
      setLoading(false);
    };

    fetchLecturers();
  }, []);


  useEffect(() => {
    // Filter and sort lecturers based on search, department, and sort criteria
    let filtered = lecturers.filter(lecturer => {
      const matchesSearch = lecturer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           lecturer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           lecturer.department.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDepartment = selectedDepartment === 'all' || lecturer.department === selectedDepartment;
      return matchesSearch && matchesDepartment;
    });

    // Sort lecturers
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'department':
          return a.department.localeCompare(b.department);
        case 'score':
          return b.averageScore - a.averageScore;
        case 'joinDate':
          return new Date(b.joinDate) - new Date(a.joinDate);
        default:
          return 0;
      }
    });

    setFilteredLecturers(filtered);
  }, [lecturers, searchTerm, selectedDepartment, sortBy]);

  // Filter workplans based on status
  useEffect(() => {
    let filtered = workplans;
    if (workplanFilter !== 'all') {
      filtered = workplans.filter(workplan => workplan.status === workplanFilter);
    }
    setFilteredWorkplans(filtered);
  }, [workplans, workplanFilter]);

  const getStatusBadge = (status) => {
    const statusMap = {
      active: { label: 'Active', class: 'badge-success' },
      on_leave: { label: 'On Leave', class: 'badge-warning' },
      inactive: { label: 'Inactive', class: 'badge-danger' }
    };
    
    const statusInfo = statusMap[status] || statusMap.active;
    return (
      <span className={`badge ${statusInfo.class}`}>
        {statusInfo.label}
      </span>
    );
  };

  const getPerformanceColor = (score) => {
    if (score >= 85) return '#27ae60';
    if (score >= 70) return '#f39c12';
    return '#e74c3c';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDepartments = () => {
    const departments = [...new Set(lecturers.map(l => l.department))].filter(dept => dept);
    return departments.sort();
  };

  const handleRefresh = () => {
    window.location.reload(); // Simple refresh - you can make this more elegant
  };

  const handleWorkplanAction = async (workplanId, action, feedback = '') => {
    setSubmitting(true);
    try {
      await apiService.put(`/workplans/${workplanId}/review`, {
        status: action,
        feedback: feedback
      });
      
      // Update local state
      setWorkplans(prev => prev.map(wp => 
        wp.id === workplanId 
          ? { ...wp, status: action, feedback: feedback }
          : wp
      ));
      
      alert(`Workplan ${action} successfully!`);
    } catch (error) {
      console.error('Error updating workplan:', error);
      alert('Failed to update workplan status.');
    } finally {
      setSubmitting(false);
    }
  };

  const getWorkplanStatusBadge = (status) => {
    const statusMap = {
      pending: { label: 'Pending Review', class: 'badge-warning' },
      approved: { label: 'Approved', class: 'badge-success' },
      'needs-revision': { label: 'Needs Revision', class: 'badge-danger' }
    };
    
    const statusInfo = statusMap[status] || statusMap.pending;
    return (
      <span className={`badge ${statusInfo.class}`}>
        {statusInfo.label}
      </span>
    );
  };

  // Handle Assign KPI Modal
  const handleOpenAssignModal = async (lecturer) => {
    try {
      setSelectedLecturer(lecturer);
      const targetRole = (user?.role === 'dean') ? 'HOD' : 'Lecturer';
      const areas = await apiService.getAreas(targetRole);
      setAvailableAreas(Array.isArray(areas) ? areas : []);
      setAreaKpis([]);
      setAvailableKpis([]);
      setShowAssignModal(true);
      setAssignmentForm({
        areaId: '',
        academicYear: new Date().getFullYear().toString(),
        semester: '1'
      });
    } catch (error) {
      setError('Failed to load areas');
    }
  };

  const handleAssignAreaChange = async (areaId) => {
    setAssignmentForm(prev => ({ ...prev, areaId }));
    if (!areaId) { setAreaKpis([]); setAvailableKpis([]); return; }
    try {
      const kpis = await apiService.getAreaKpis(areaId);
      setAreaKpis(Array.isArray(kpis) ? kpis : []);
      setAvailableKpis(Array.isArray(kpis) ? kpis : []);
    } catch (err) {
      setAreaKpis([]);
      setAvailableKpis([]);
    }
  };

  const handleAssignKPI = async (e) => {
    e.preventDefault();
    if (!assignmentForm.areaId) { alert('Please select an Area'); return; }

    setSubmitting(true);
    try {
      // Ensure we have KPIs for the selected area
      let kpis = areaKpis;
      if (!kpis || kpis.length === 0) {
        const fetched = await apiService.getAreaKpis(assignmentForm.areaId);
        kpis = Array.isArray(fetched) ? fetched : [];
      }

      if (!kpis || kpis.length === 0) {
        alert('No KPIs found under the selected Area.');
        setSubmitting(false);
        return;
      }

      let assigned = 0, skipped = 0, failed = 0;
      for (const k of kpis) {
        try {
          await apiService.createKpiAssignment({
            kpiId: Number(k.id),
            userId: selectedLecturer.id,
            academicYear: assignmentForm.academicYear,
            semester: assignmentForm.semester
          });
          assigned++;
        } catch (err) {
          const msg = (err && err.message) ? err.message.toLowerCase() : '';
          if (msg.includes('already') || msg.includes('exists') || msg.includes('duplicate')) skipped++; else failed++;
        }
      }

      setShowAssignModal(false);
      alert(`Area assignment complete. Created: ${assigned}, Skipped: ${skipped}${failed ? `, Failed: ${failed}` : ''}.`);
      setSelectedLecturer(null);
    } catch (error) {
      alert('Failed to assign KPI: ' + (error.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  // Evaluate by Area Modal
  const handleOpenAreaEvaluateModal = async (lecturer) => {
    try {
      setSelectedLecturer(lecturer);
      // Ensure the lecturer has KPI assignments before evaluating
      const assignments = await apiService.getKpiAssignmentsByLecturer(lecturer.id);
      if (!assignments || assignments.length === 0) {
        alert('No KPIs assigned to this lecturer');
        setSelectedLecturer(null);
        return;
      }
      const targetRole = (user?.role === 'dean') ? 'HOD' : 'Lecturer';
      const areas = await apiService.getAreas(targetRole);
      const allAreas = Array.isArray(areas) ? areas : [];
      // Only allow evaluating areas that are actually assigned to this user via KPI assignments
      const assignedAreaIds = new Set(
        (assignments || [])
          .map(a => (a.kpi?.areaId ?? a.kpi?.area?.id))
          .filter(id => id !== undefined && id !== null)
      );
      const filteredAreas = allAreas.filter(ar => assignedAreaIds.has(ar.id));
      if (filteredAreas.length === 0) {
        alert('No assigned areas available to evaluate for this user.');
        setSelectedLecturer(null);
        return;
      }
      setAvailableAreas(filteredAreas);
      setAreaKpis([]);
      setAreaEvaluationForm({ areaId: '', comments: '', scores: {} });
      setShowAreaEvaluateModal(true);
    } catch (error) {
      alert('Failed to load areas: ' + (error.message || 'Unknown error'));
    }
  };

  const handleAreaChange = async (areaId) => {
    setAreaEvaluationForm(prev => ({ ...prev, areaId, scores: {} }));
    if (!areaId) { setAreaKpis([]); return; }
    try {
      const kpis = await apiService.getAreaKpis(areaId);
      setAreaKpis(Array.isArray(kpis) ? kpis : []);
    } catch (err) {
      setAreaKpis([]);
    }
  };

  const handleAreaScoreChange = (kpiId, score) => {
    setAreaEvaluationForm(prev => ({ ...prev, scores: { ...prev.scores, [kpiId]: score } }));
  };

  const handleSubmitAreaEvaluation = async (e) => {
    e.preventDefault();
    if (!areaEvaluationForm.areaId) { alert('Please select an Area'); return; }
    const items = areaKpis.map(k => ({ kpiId: k.id, score: Number(areaEvaluationForm.scores[k.id] ?? 0) }));
    setSubmitting(true);
    try {
      await apiService.createAreaEvaluation({
        lecturerId: selectedLecturer.id,
        areaId: Number(areaEvaluationForm.areaId),
        comments: areaEvaluationForm.comments,
        items
      });
      setShowAreaEvaluateModal(false);
      alert('Area evaluation submitted successfully!');
      setSelectedLecturer(null);
    } catch (err) {
      alert('Failed to submit area evaluation: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Assign Workplan Modal
  const handleOpenAssignWorkplanModal = async (lecturer) => {
    try {
      setSelectedLecturer(lecturer);
      const workplans = await apiService.getStandardWorkplansForAssignment();
      setAvailableWorkplans(workplans);
      setShowAssignWorkplanModal(true);
      setWorkplanAssignmentForm({
        standardWorkplanId: '',
        assignmentNotes: ''
      });
    } catch (error) {
      setError('Failed to load available workplans');
    }
  };

  const handleAssignWorkplan = async (e) => {
    e.preventDefault();
    if (!workplanAssignmentForm.standardWorkplanId) {
      alert('Please select a workplan');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.assignWorkplan({
        standardWorkplanId: parseInt(workplanAssignmentForm.standardWorkplanId),
        assigneeId: selectedLecturer.id,
        assignmentNotes: workplanAssignmentForm.assignmentNotes
      });
      
      setShowAssignWorkplanModal(false);
      alert('Workplan assigned successfully!');
      setSelectedLecturer(null);
    } catch (error) {
      alert('Failed to assign workplan: ' + (error.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="lecturer-list-container">
        <div className="loading">Loading lecturers...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lecturer-list-container">
        <div className="error-message">
          <h3>❌ Error Loading Lecturers</h3>
          <p>{error}</p>
          <button onClick={handleRefresh} className="btn btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lecturer-list-container">
      <div className="page-header">
        <div className="header-content">
          <h1>{user.role === 'dean' ? 'HOD Management' : 'Lecturer Management'}</h1>
          <p>{user.role === 'dean' ? 'View and manage all HODs in the Faculty' : 'Assign Workplans and KPIs to Lecturers in your department'}</p>
        </div>
        <div className="header-stats">
          <div className="stat-item">
            <span className="stat-number">{lecturers.filter(l => l.status === 'active').length}</span>
            <span className="stat-label">{user.role === 'dean' ? 'Active HODs' : 'Lecturers'}</span>
          </div>
        </div>
      </div>

      {/* Lecturers Tab - Always show for HODs and Deans */}
      {(
        <>
          {/* Filters and Search */}
          <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search lecturers by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-controls">
          {/*<div className="filter-group">
            <label htmlFor="department-filter">Department:</label>
            <select
              id="department-filter"
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Departments</option>
              {getDepartments().map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>*/}

          {/*<div className="filter-group">
            <label htmlFor="sort-filter">Sort by:</label>
            <select
              id="sort-filter"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select"
            >
              <option value="name">Name</option>
              <option value="department">Department</option>
              <option value="score">Performance Score</option>
              <option value="joinDate">Join Date</option>
            </select>
          </div> */}
        </div>
      </div>

      {/* Results Summary */}
      <div className="results-summary">
        <p>Showing {filteredLecturers.length} of {lecturers.length} {user.role === 'dean' ? 'HODs' : 'lecturers'}</p>
        {lecturers.length === 0 && !loading && (
          <p className="note">
            <span className="material-icons" style={{verticalAlign:'middle'}}>info</span> No {user.role === 'dean' ? 'HODs' : 'lecturers'} found. {user.role === 'dean' ? 'Add HODs to view them here' : 'Add Lecturers to view them here'} using the Manage Users tab.
          </p>
        )}
      </div>

      {/* Lecturers Grid/List */}
      <div className="lecturers-grid">
        {filteredLecturers.map(lecturer => (
          <div key={lecturer.id} className="lecturer-card">
            <div className="lecturer-header">
              <div className="lecturer-avatar">
                {lecturer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
              <div className="lecturer-basic-info">
                <h3 className="lecturer-name">{lecturer.name}</h3>
                <p className="lecturer-position">{lecturer.position}</p>
                {/* <p className="lecturer-department">{lecturer.department}</p> */}
              </div>
              <div className="lecturer-status">
                {getStatusBadge(lecturer.status)}
              </div>
            </div>

            <div className="lecturer-details">
              <div className="detail-row">
                <span className="detail-label material-icons" title="Email">Email :</span>
                <span className="detail-value"><strong>{lecturer.email}</strong></span>
              </div>
              {/* OTHER LECTURER DETAILS WE MAY DISPLAY HERE */}
              {/*<div className="detail-row">
                <span className="detail-label material-icons" title="Phone">Phone NUmber</span>
                <span className="detail-value">{lecturer.phone}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label material-icons" title="Office">Office #</span>
                <span className="detail-value">{lecturer.officeLocation}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label material-icons" title="Joined">event</span>
                <span className="detail-value">{formatDate(lecturer.joinDate)}</span>
              </div>*/}
            </div>

            <div className="lecturer-actions">
              <Link 
                to={`/lecturer/${lecturer.id}`}
                className="btn btn-primary btn-sm"
              >
                View Profile
              </Link>
              {(user.role === 'admin' || user.role === 'hod' || user.role === 'dean') && (
                <>
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => handleOpenAssignModal(lecturer)}
                  >
                    Assign
                  </button>
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => handleOpenAssignWorkplanModal(lecturer)}
                  >
                    Workplan
                  </button>
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => handleOpenAreaEvaluateModal(lecturer)}
                  >
                    Evaluate by Area
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredLecturers.length === 0 && lecturers.length > 0 && (
        <div className="no-results">
          <div className="no-results-icon material-icons">search_off</div>
          <h3>No {user.role === 'dean' ? 'HODs' : 'lecturers'} found</h3>
          <p>Try adjusting your search criteria or filters.</p>
        </div>
      )}
        </>
      )}

      {/* Assign KPI Modal (Area-first) */}
      {showAssignModal && selectedLecturer && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Assign KPIs by Area to {selectedLecturer.name}</h3>
              <button 
                className="modal-close"
                onClick={() => setShowAssignModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAssignKPI} className="modal-form">
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="assign-area-select" className="form-label">Select Area *</label>
                  <select
                    id="assign-area-select"
                    value={assignmentForm.areaId}
                    onChange={(e) => handleAssignAreaChange(e.target.value)}
                    className="form-select"
                    required
                  >
                    <option value="">-- Select an Area --</option>
                    {availableAreas.map(area => (
                      <option key={area.id} value={area.id}>
                        {area.name} (Weight: {area.weight})
                      </option>
                    ))}
                  </select>
                </div>

                {assignmentForm.areaId && (
                  <div className="form-group">
                    <label className="form-label">KPIs in Selected Area</label>
                    <div className="area-kpi-list">
                      {areaKpis.length === 0 ? (
                        <div className="empty">No KPIs in this area.</div>
                      ) : (
                        areaKpis.map(kpi => (
                          <div key={kpi.id} className="area-kpi-item">
                            <div className="area-kpi-title">{kpi.title}</div>
                          </div>
                        ))
                      )}
                    </div>
                    <p className="card-subtitle">All KPIs listed above will be assigned automatically.</p>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="academic-year" className="form-label">Academic Year *</label>
                    <input
                      type="text"
                      id="academic-year"
                      value={assignmentForm.academicYear}
                      onChange={(e) => setAssignmentForm({...assignmentForm, academicYear: e.target.value})}
                      className="form-input"
                      placeholder="2025"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="semester" className="form-label">Period *</label>
                    <select
                      id="semester"
                      value={assignmentForm.semester}
                      onChange={(e) => setAssignmentForm({...assignmentForm, semester: e.target.value})}
                      className="form-select"
                      required
                    >
                      <option value="1">Entire Academic Year</option>
                      {/* <option value="2">Term 1</option>
                      <option value="3">Term 2</option>
                      <option value="4">Term 3</option> */}
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => setShowAssignModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Assigning...' : 'Assign KPIs'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evaluate by Area Modal */}
      {showAreaEvaluateModal && selectedLecturer && (
        <div className="modal-overlay" onClick={() => setShowAreaEvaluateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Evaluate by Area: {selectedLecturer.name}</h3>
              <button 
                className="modal-close"
                onClick={() => setShowAreaEvaluateModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmitAreaEvaluation} className="modal-form">
              <div className="modal-body">
              <div className="form-group">
                <label htmlFor="area-select" className="form-label">Select Area *</label>
                <select
                  id="area-select"
                  value={areaEvaluationForm.areaId}
                  onChange={(e) => handleAreaChange(e.target.value)}
                  className="form-select"
                  required
                >
                  <option value="">-- Select an Area --</option>
                  {availableAreas.map(area => (
                    <option key={area.id} value={area.id}>
                      {area.name} (Weight: {area.weight})
                    </option>
                  ))}
                </select>
              </div>

              {areaKpis.length > 0 && (
                <div className="form-group">
                  <label className="form-label">KPIs in this Area</label>
                  <div className="area-kpi-list">
                    {areaKpis.map(kpi => (
                      <div key={kpi.id} className="area-kpi-item">
                        <div className="area-kpi-title">{kpi.title}</div>
                        <div className="area-kpi-radios">
                          {[0,1,2,3,4,5].map(val => (
                            <label key={val} className="radio-label">
                              <input
                                type="radio"
                                name={`kpi-${kpi.id}`}
                                value={val}
                                checked={(areaEvaluationForm.scores[kpi.id] ?? 0) === val}
                                onChange={() => handleAreaScoreChange(kpi.id, val)}
                              />
                              {val}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="area-comments" className="form-label">Comments</label>
                <textarea
                  id="area-comments"
                  value={areaEvaluationForm.comments}
                  onChange={(e) => setAreaEvaluationForm({...areaEvaluationForm, comments: e.target.value})}
                  className="form-textarea"
                  rows="3"
                  placeholder="Enter comments for this area evaluation..."
                />
              </div>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => setShowAreaEvaluateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Area Evaluation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Workplan Modal */}
      {showAssignWorkplanModal && selectedLecturer && (
        <div className="modal-overlay" onClick={() => setShowAssignWorkplanModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Assign Workplan to {selectedLecturer.name}</h3>
              <button 
                className="modal-close"
                onClick={() => setShowAssignWorkplanModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAssignWorkplan} className="modal-form">
              <div className="modal-body">
              <div className="form-group">
                <label htmlFor="workplan-select" className="form-label">Select Workplan *</label>
                <select
                  id="workplan-select"
                  value={workplanAssignmentForm.standardWorkplanId}
                  onChange={(e) => setWorkplanAssignmentForm({...workplanAssignmentForm, standardWorkplanId: e.target.value})}
                  className="form-select"
                  required
                >
                  <option value="">-- Select a Workplan --</option>
                  {availableWorkplans.map(workplan => (
                    <option key={workplan.id} value={workplan.id}>
                      {workplan.title || workplan.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="assignment-notes" className="form-label">Assignment Notes</label>
                <textarea
                  id="assignment-notes"
                  value={workplanAssignmentForm.assignmentNotes}
                  onChange={(e) => setWorkplanAssignmentForm({...workplanAssignmentForm, assignmentNotes: e.target.value})}
                  className="form-textarea"
                  rows="4"
                  placeholder="Enter any additional notes or instructions for this workplan assignment (optional)"
                />
              </div>
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => setShowAssignWorkplanModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Assigning...' : 'Assign Workplan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerList;
