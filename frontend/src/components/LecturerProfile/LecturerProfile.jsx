import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import apiService from '../../utils/api';
import './LecturerProfile.css';

const LecturerProfile = ({ user }) => {
  const { id } = useParams();
  const [lecturer, setLecturer] = useState(null);
  const [kpiAssignments, setKpiAssignments] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [areaEvaluations, setAreaEvaluations] = useState([]);
  const [workplans, setWorkplans] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEvaluateModal, setShowEvaluateModal] = useState(false);
  const [availableKpis, setAvailableKpis] = useState([]);
  const [availableAreas, setAvailableAreas] = useState([]);
  const [areaKpis, setAreaKpis] = useState([]);
  const [assignmentForm, setAssignmentForm] = useState({
    areaId: '',
    academicYear: '',
    semester: ''
  });
  const [evaluationForm, setEvaluationForm] = useState({
    kpiId: '',
    score: '',
    comments: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchLecturerData = async () => {
      try {
        setLoading(true);
        setError('');

        console.log('Fetching lecturer data for ID:', id);

        // Fetch lecturer basic info
        const lecturerData = await apiService.getUser(id);
        console.log('Lecturer data received:', lecturerData);
        setLecturer(lecturerData);

        // Fetch KPI assignments for this lecturer
        try {
          const assignments = await apiService.getKpiAssignmentsByLecturer(id);
          console.log('KPI assignments:', assignments);
          setKpiAssignments(Array.isArray(assignments) ? assignments : []);
        } catch (err) {
          console.log('No KPI assignments found:', err.message);
          setKpiAssignments([]);
        }

        // Fetch evaluations for this lecturer (legacy)
        try {
          const lecturerEvaluations = await apiService.getEvaluationsByLecturer(id);
          console.log('Evaluations:', lecturerEvaluations);
          setEvaluations(Array.isArray(lecturerEvaluations) ? lecturerEvaluations : []);
        } catch (err) {
          console.log('No evaluations found:', err.message);
          setEvaluations([]);
        }

        // Fetch AREA evaluations for this lecturer (authoritative for reports/stats)
        try {
          const areaEvals = await apiService.getAreaEvaluationsByLecturer(id);
          console.log('Area Evaluations:', areaEvals);
          setAreaEvaluations(Array.isArray(areaEvals) ? areaEvals : []);
        } catch (err) {
          console.log('No area evaluations found:', err.message);
          setAreaEvaluations([]);
        }

        // Fetch workplans for this lecturer
        try {
          const lecturerWorkplans = await apiService.getWorkplansByLecturer(id);
          console.log('Workplans:', lecturerWorkplans);
          setWorkplans(Array.isArray(lecturerWorkplans) ? lecturerWorkplans : []);
        } catch (err) {
          console.log('No workplans found:', err.message);
          setWorkplans([]);
        }

      } catch (error) {
        console.error('Error fetching lecturer data:', error);
        setError('Failed to load lecturer data');
        setLecturer(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchLecturerData();
    }
  }, [id]);

  // Real-time refresh when evaluations are created/updated elsewhere
  useEffect(() => {
    if (!id) return;
    const refetch = async () => {
      try {
        const [lecturerEvaluations, areaEvals] = await Promise.all([
          apiService.getEvaluationsByLecturer(id).catch(() => []),
          apiService.getAreaEvaluationsByLecturer(id).catch(() => [])
        ]);
        setEvaluations(Array.isArray(lecturerEvaluations) ? lecturerEvaluations : []);
        setAreaEvaluations(Array.isArray(areaEvals) ? areaEvals : []);
      } catch (_) {}
    };
    const handleEvent = () => refetch();
    window.addEventListener('evaluationCreated', handleEvent);
    window.addEventListener('evaluationUpdated', handleEvent);
    const handleStorage = (event) => {
      if (event.key === 'evaluationUpdated' || event.key === 'reportRefreshNeeded') {
        refetch();
        localStorage.removeItem('evaluationUpdated');
        localStorage.removeItem('reportRefreshNeeded');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('evaluationCreated', handleEvent);
      window.removeEventListener('evaluationUpdated', handleEvent);
      window.removeEventListener('storage', handleStorage);
    };
  }, [id]);

  const getKPIStatusBadge = (status) => {
    const statusMap = {
      completed: { label: 'Completed', class: 'badge-success' },
      in_progress: { label: 'In Progress', class: 'badge-warning' },
      not_started: { label: 'Not Started', class: 'badge-danger' },
      pending: { label: 'Pending', class: 'badge-info' }
    };
    
    const statusInfo = statusMap[status] || statusMap.not_started;
    return (
      <span className={`badge ${statusInfo.class}`}>
        {statusInfo.label}
      </span>
    );
  };

  const getCategoryColor = (category) => {
    const colors = {
      teaching: '#11486B',
      research: '#e74c3c',
      service: '#27ae60',
      administration: '#f39c12',
      academic: '#9b59b6',
      professional: '#34495e'
    };
    return colors[category?.toLowerCase()] || '#11486B';
  };

  const calculateOverallScore = () => {
    // Align with Reports Top Performers: use LATEST evaluation per Area, compute per-area % then average across areas
    if (Array.isArray(areaEvaluations) && areaEvaluations.length > 0) {
      // Prefer supervisor evaluations (exclude self-evaluations)
      const supEvals = areaEvaluations.filter(ev => !ev.isSelfEvaluation);
      const source = supEvals.length > 0 ? supEvals : areaEvaluations;
      // Group by areaId and pick latest by evaluatedAt/date
      const byArea = source.reduce((acc, ev) => {
        const key = ev.areaId || ev.area?.id || 'unknown';
        if (!acc[key]) acc[key] = [];
        acc[key].push(ev);
        return acc;
      }, {});
      const areaPcts = Object.values(byArea).map(list => {
        const sorted = list.slice().sort((a, b) => new Date(b.evaluatedAt || b.date || 0) - new Date(a.evaluatedAt || a.date || 0));
        const ev = sorted[0];
        const items = Array.isArray(ev.items) ? ev.items : [];
        const sum = items.reduce((s, it) => s + (Number(it.score) || 0), 0);
        const count = items.length || 1;
        return Math.round((sum / (count * 5)) * 100);
      });
      const avg = areaPcts.length > 0 ? Math.round(areaPcts.reduce((s, v) => s + v, 0) / areaPcts.length) : 0;
      return avg;
    }
    // Fallback: legacy evaluations are assumed 0-100 already
    if (Array.isArray(evaluations) && evaluations.length > 0) {
      const total = evaluations.reduce((s, e) => s + (Number(e.score) || 0), 0);
      return Math.round(total / evaluations.length);
    }
    return 0;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const generatePerformanceHistory = () => {
    // Generate performance history from evaluations
    const history = evaluations
      .sort((a, b) => new Date(a.evaluationDate) - new Date(b.evaluationDate))
      .map((evaluation, index) => ({
        period: `Period ${index + 1}`,
        score: evaluation.score || 0,
        date: evaluation.evaluationDate
      }));

    // If no evaluations, return empty data
    if (history.length === 0) {
      return [
        { period: 'No Data', score: 0 }
      ];
    }

    return history;
  };

  const generateRecentActivities = () => {
    const activities = [];

    // Add evaluation activities
    evaluations.forEach(evaluation => {
      activities.push({
        id: `eval-${evaluation.id}`,
        type: 'evaluation',
        description: `Performance evaluation completed - Score: ${evaluation.score}`,
        date: evaluation.evaluationDate,
        status: 'completed'
      });
    });

    // Add workplan activities
    workplans.forEach(workplan => {
      activities.push({
        id: `workplan-${workplan.id}`,
        type: 'submission',
        description: `Workplan submitted for ${workplan.academicYear}`,
        date: workplan.submissionDate,
        status: workplan.status || 'submitted'
      });
    });

    // Add KPI assignment activities
    kpiAssignments.forEach(assignment => {
      activities.push({
        id: `kpi-${assignment.id}`,
        type: 'kpi_update',
        description: `KPI assigned: ${assignment.kpi?.title || 'KPI'}`,
        date: assignment.assignedDate,
        status: assignment.status || 'assigned'
      });
    });

    // Sort by date (most recent first) and return top 10
    return activities
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);
  };

  // Handle Assign KPI Modal
  const handleOpenAssignModal = async () => {
    try {
      // Load Areas based on role context: Dean assigns to HODs, HOD/Admin assigns to Lecturers
      const targetRole = (user?.role === 'dean') ? 'HOD' : 'Lecturer';
      const areas = await apiService.getAreas(targetRole);
      setAvailableAreas(Array.isArray(areas) ? areas : []);
      setAreaKpis([]);
      setShowAssignModal(true);
      setAssignmentForm({
        areaId: '',
        academicYear: new Date().getFullYear().toString(),
        semester: '1'
      });
    } catch (error) {
      setError('Failed to load available areas');
    }
  };

  const handleAssignAreaChange = async (areaId) => {
    setAssignmentForm(prev => ({ ...prev, areaId }));
    if (!areaId) { setAreaKpis([]); return; }
    try {
      const kpis = await apiService.getAreaKpis(areaId);
      setAreaKpis(Array.isArray(kpis) ? kpis : []);
    } catch (err) {
      setAreaKpis([]);
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
            userId: lecturer.id,
            academicYear: assignmentForm.academicYear,
            semester: assignmentForm.semester
          });
          assigned++;
        } catch (err) {
          const msg = (err && err.message) ? err.message.toLowerCase() : '';
          if (msg.includes('already') || msg.includes('exists') || msg.includes('duplicate')) skipped++; else failed++;
        }
      }

      // Refresh KPI assignments
      const assignments = await apiService.getKpiAssignmentsByLecturer(id);
      setKpiAssignments(Array.isArray(assignments) ? assignments : []);
      
      setShowAssignModal(false);
      alert(`Area assignment complete. Created: ${assigned}, Skipped: ${skipped}${failed ? `, Failed: ${failed}` : ''}.`);
    } catch (error) {
      alert('Failed to assign KPIs: ' + (error.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Evaluate Modal
  const handleOpenEvaluateModal = () => {
    if (kpiAssignments.length === 0) {
      alert('No KPI assignments found for this lecturer');
      return;
    }
    setShowEvaluateModal(true);
    setEvaluationForm({
      kpiId: kpiAssignments[0]?.kpi?.id || '',
      score: '',
      comments: ''
    });
  };

  const handleEvaluate = async (e) => {
    e.preventDefault();
    if (!evaluationForm.kpiId || !evaluationForm.score) {
      alert('Please fill in all required fields');
      return;
    }

    if (evaluationForm.score < 0 || evaluationForm.score > 100) {
      alert('Score must be between 0 and 100');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.createEvaluation({
        lecturerId: lecturer.id,
        kpiId: parseInt(evaluationForm.kpiId),
        score: parseFloat(evaluationForm.score),
        comments: evaluationForm.comments
      });

      // Refresh evaluations (both legacy and area)
      const [lecturerEvaluations, areaEvals] = await Promise.all([
        apiService.getEvaluationsByLecturer(id).catch(() => []),
        apiService.getAreaEvaluationsByLecturer(id).catch(() => [])
      ]);
      setEvaluations(Array.isArray(lecturerEvaluations) ? lecturerEvaluations : []);
      setAreaEvaluations(Array.isArray(areaEvals) ? areaEvals : []);
      
      setShowEvaluateModal(false);
      alert('Evaluation submitted successfully!');
    } catch (error) {
      alert('Failed to submit evaluation: ' + (error.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="lecturer-profile-container">
        <div className="loading">Loading lecturer profile...</div>
      </div>
    );
  }

  if (error || !lecturer) {
    return (
      <div className="lecturer-profile-container">
        <div className="error">
          {error || 'Lecturer not found'}
          <button onClick={() => window.history.back()} className="btn btn-primary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const performanceHistory = generatePerformanceHistory();
  const recentActivities = generateRecentActivities();
  const overallScore = calculateOverallScore();

  return (
    <div className="lecturer-profile-container">
      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-avatar">
          {(lecturer.fullName || lecturer.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase()}
        </div>
        <div className="profile-info">
          <h1 className="lecturer-name">{lecturer.fullName || lecturer.name}</h1>
          <p className="lecturer-position">Lecturer</p>
          <p className="lecturer-department">{lecturer.department || 'Department Not Assigned'}</p>
          <div className="contact-info">
            <span className="contact-item">📧 {lecturer.email}</span>
            <span className="contact-item">📞 N/A</span>
            <span className="contact-item">🏢 N/A</span>
          </div>
        </div>
        <div className="profile-stats">
          <div className="stat-card">
            <span className="stat-value">{overallScore}%</span>
            <span className="stat-label">Overall Score</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{kpiAssignments.length}</span>
            <span className="stat-label">Total KPIs</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{(areaEvaluations && areaEvaluations.length) || (evaluations && evaluations.length) || 0}</span>
            <span className="stat-label">Evaluations</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab-btn ${activeTab === 'kpis' ? 'active' : ''}`}
          onClick={() => setActiveTab('kpis')}
        >
          KPIs & Performance
        </button>
        <button 
          className={`tab-btn ${activeTab === 'activities' ? 'active' : ''}`}
          onClick={() => setActiveTab('activities')}
        >
          Recent Activities
        </button>
        <button 
          className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile Details
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-content">
            <div className="overview-grid">
              {/* Performance Chart */}
              <div className="card chart-card">
                <div className="card-header">
                  <h3 className="card-title">Performance Trend</h3>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={performanceHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="score" stroke="#11486B" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* KPI Progress */}
              <div className="card kpi-summary-card">
                <div className="card-header">
                  <h3 className="card-title">KPI Assignments</h3>
                </div>
                <div className="kpi-progress-list">
                  {kpiAssignments.length > 0 ? kpiAssignments.map(assignment => (
                    <div key={assignment.id} className="kpi-progress-item">
                      <div className="kpi-info">
                        <span className="kpi-title">{assignment.kpi?.title || 'KPI Title'}</span>
                        <span className="kpi-progress">
                          {assignment.kpi?.category || 'Category'}
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill"
                          style={{ 
                            width: '70%', // Default progress since we don't have actual progress data
                            backgroundColor: getCategoryColor(assignment.kpi?.category)
                          }}
                        />
                      </div>
                    </div>
                  )) : (
                    <div className="no-data">No KPI assignments found</div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Quick Actions</h3>
              </div>
              <div className="quick-actions">
                {user?.role === 'lecturer' && user.id === lecturer.id && (
                  <>
                    <button className="action-btn">
                      <span className="action-icon">📝</span>
                      Update Progress
                    </button>
                    <button className="action-btn">
                      <span className="action-icon">📄</span>
                      Submit Workplan
                    </button>
                  </>
                )}
                {(user?.role === 'admin' || user?.role === 'hod' || user?.role === 'dean') && (
                  <>
                    <button className="action-btn" onClick={handleOpenAssignModal}>
                      <span className="action-icon"></span>
                      Assign KPI
                    </button>
                    <button className="action-btn" onClick={handleOpenEvaluateModal}>
                      <span className="action-icon"></span>
                      Evaluate Performance
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'kpis' && (
          <div className="kpis-content">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">KPI Assignments</h3>
              </div>
              <div className="kpi-details-grid">
                {kpiAssignments.length > 0 ? kpiAssignments.map(assignment => (
                  <div key={assignment.id} className="kpi-detail-card">
                    <div className="kpi-card-header">
                      <h4 className="kpi-card-title">{assignment.kpi?.title || 'KPI Title'}</h4>
                      <span 
                        className="category-badge"
                        style={{ backgroundColor: getCategoryColor(assignment.kpi?.category) }}
                      >
                        {assignment.kpi?.category || 'General'}
                      </span>
                    </div>
                    
                    <div className="kpi-metrics">
                      <div className="metric">
                        <span className="metric-label">Weight</span>
                        <span className="metric-value">{assignment.kpi?.weight || 0}</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Target</span>
                        <span className="metric-value">{assignment.targetValue || 'N/A'}</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Assigned</span>
                        <span className="metric-value">{formatDate(assignment.assignedDate)}</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Due Date</span>
                        <span className="metric-value">{formatDate(assignment.dueDate)}</span>
                      </div>
                    </div>

                    <div className="kpi-progress-bar">
                      <div 
                        className="kpi-progress-fill"
                        style={{ 
                          width: '70%', // Default progress
                          backgroundColor: getCategoryColor(assignment.kpi?.category)
                        }}
                      />
                    </div>

                    <div className="kpi-status">
                    </div>

                    {assignment.kpi?.description && (
                      <div className="kpi-description">
                        <p>{assignment.kpi.description}</p>
                      </div>
                    )}
                  </div>
                )) : (
                  <div className="no-data">No KPI assignments found for this lecturer</div>
                )}
              </div>
            </div>

            {/* Evaluations Chart */}
            {evaluations.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Evaluation History</h3>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={evaluations.map((evaluation, index) => ({
                      name: `Eval ${index + 1}`,
                      score: evaluation.score || 0,
                      date: formatDate(evaluation.evaluationDate)
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="score" fill="#11486B" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="activities-content">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Recent Activities</h3>
              </div>
              <div className="activity-timeline">
                {recentActivities.length > 0 ? recentActivities.map(activity => (
                  <div key={activity.id} className="activity-item">
                    <div className="activity-date">
                      {formatDate(activity.date)}
                    </div>
                    <div className="activity-content">
                      <div className="activity-icon">
                        {activity.type === 'submission'}
                        {activity.type === 'evaluation'}
                        {activity.type === 'kpi_update'}
                      </div>
                      <div className="activity-description">
                        {activity.description}
                      </div>
                      <span className={`badge ${activity.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                        {activity.status}
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="no-data">No recent activities found</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="profile-content">
            <div className="profile-grid">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Personal Information</h3>
                </div>
                <div className="profile-details">
                  <div className="detail-row">
                    <span className="detail-label">Full Name:</span>
                    <span className="detail-value">{lecturer.fullName || lecturer.name}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Email:</span>
                    <span className="detail-value">{lecturer.email}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Department:</span>
                    <span className="detail-value">{lecturer.department || 'Not Assigned'}</span>
                  </div>
                  {/* <div className="detail-row">
                    <span className="detail-label">User ID:</span>
                    <span className="detail-value">{lecturer.id}</span>
                  </div> */}
                  <div className="detail-row">
                    <span className="detail-label">Roles:</span>
                    <span className="detail-value">
                      {lecturer.roles ? lecturer.roles.join(', ') : 'Lecturer'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Academic Summary</h3>
                </div>
                <div className="academic-summary">
                  <div className="summary-item">
                    <span className="summary-label">Total KPI Assignments : </span>
                    <span className="summary-value">{kpiAssignments.length}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Evaluations : </span>
                    <span className="summary-value">{(areaEvaluations && areaEvaluations.length) || (evaluations && evaluations.length) || 0}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Workplans : </span>
                    <span className="summary-value">{workplans.length}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Overall Performance : </span>
                    <span className="summary-value">{overallScore}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Assign KPIs by Area Modal */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Assign KPIs by Area to {lecturer.fullName || lecturer.name}</h3>
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
                  <label htmlFor="area-select" className="form-label">Select Area *</label>
                  <select
                    id="area-select"
                    value={assignmentForm.areaId}
                    onChange={(e) => handleAssignAreaChange(e.target.value)}
                    className="form-select"
                    required
                  >
                    <option value="">-- Select an Area --</option>
                    {availableAreas.map(area => (
                      <option key={area.id} value={area.id}>
                        {area.name} {typeof area.weight === 'number' ? `(Weight: ${area.weight})` : ''}
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
                      placeholder="2024"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="semester" className="form-label">Semester *</label>
                    <select
                      id="semester"
                      value={assignmentForm.semester}
                      onChange={(e) => setAssignmentForm({...assignmentForm, semester: e.target.value})}
                      className="form-select"
                      required
                    >
                      <option value="1">Semester 1</option>
                      <option value="2">Semester 2</option>
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

      {/* Evaluate Performance Modal */}
      {showEvaluateModal && (
        <div className="modal-overlay" onClick={() => setShowEvaluateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Evaluate {lecturer.fullName || lecturer.name}</h3>
              <button 
                className="modal-close"
                onClick={() => setShowEvaluateModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleEvaluate} className="modal-form">
              <div className="modal-body">
              <div className="form-group">
                <label htmlFor="eval-kpi-select" className="form-label">Select KPI to Evaluate *</label>
                <select
                  id="eval-kpi-select"
                  value={evaluationForm.kpiId}
                  onChange={(e) => setEvaluationForm({...evaluationForm, kpiId: e.target.value})}
                  className="form-select"
                  required
                >
                  <option value="">-- Select a KPI --</option>
                  {kpiAssignments.map(assignment => (
                    <option key={assignment.kpi?.id} value={assignment.kpi?.id}>
                      {assignment.kpi?.title}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="score" className="form-label">Score (0-100) *</label>
                <input
                  type="number"
                  id="score"
                  min="0"
                  max="100"
                  step="0.1"
                  value={evaluationForm.score}
                  onChange={(e) => setEvaluationForm({...evaluationForm, score: e.target.value})}
                  className="form-input"
                  placeholder="Enter score between 0-100"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="comments" className="form-label">Comments</label>
                <textarea
                  id="comments"
                  value={evaluationForm.comments}
                  onChange={(e) => setEvaluationForm({...evaluationForm, comments: e.target.value})}
                  className="form-textarea"
                  rows="4"
                  placeholder="Enter evaluation comments (optional)"
                />
              </div>
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => setShowEvaluateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Evaluation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerProfile;
