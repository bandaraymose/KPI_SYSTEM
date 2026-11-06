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
  // Removed legacy single-KPI evaluate modal
  const [showAreaEvaluateModal, setShowAreaEvaluateModal] = useState(false);
  const [showAssignWorkplanModal, setShowAssignWorkplanModal] = useState(false);
  const [availableKpis, setAvailableKpis] = useState([]);
  const [availableAreas, setAvailableAreas] = useState([]);
  const [areaKpis, setAreaKpis] = useState([]);
  const [availableWorkplans, setAvailableWorkplans] = useState([]);
  const [assignmentForm, setAssignmentForm] = useState({
    areaId: '',
    academicYear: '',
    semester: ''
  });
  const [workplanAssignmentForm, setWorkplanAssignmentForm] = useState({
    standardWorkplanId: '',
    assignmentNotes: ''
  });
  // Removed legacy evaluation form state
  const [areaEvaluationForm, setAreaEvaluationForm] = useState({
    areaId: '',
    comments: '',
    scores: {} // { [kpiId]: score0..5 }
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

        // Fetch AREA evaluations for this lecturer (authoritative)
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
    // Match Reports Top Performers: average of latest per-area percentages (items 0-5 normalized to 0-100)
    if (Array.isArray(areaEvaluations) && areaEvaluations.length > 0) {
      // Exclude self-evaluations if supervisor evaluations exist
      const supOnly = areaEvaluations.filter(ev => !ev.isSelfEvaluation);
      const src = supOnly.length > 0 ? supOnly : areaEvaluations;
      const byArea = src.reduce((acc, ev) => {
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
      return areaPcts.length > 0 ? Math.round(areaPcts.reduce((s, v) => s + v, 0) / areaPcts.length) : 0;
    }
    // Fallback: legacy evaluations assumed 0-100
    if (Array.isArray(evaluations) && evaluations.length > 0) {
      const totalScore = evaluations.reduce((sum, evaluation) => sum + (Number(evaluation.score) || 0), 0);
      return Math.round(totalScore / evaluations.length);
    }
    return 0;
  };

  // Lightweight refresh when area evaluations may be updated elsewhere
  useEffect(() => {
    const refetch = async () => {
      try {
        const [legacy, area] = await Promise.all([
          apiService.getEvaluationsByLecturer(id).catch(() => []),
          apiService.getAreaEvaluationsByLecturer(id).catch(() => [])
        ]);
        setEvaluations(Array.isArray(legacy) ? legacy : []);
        setAreaEvaluations(Array.isArray(area) ? area : []);
      } catch (_) {}
    };
    const onStorage = (e) => {
      if (e.key === 'evaluationUpdated' || e.key === 'reportRefreshNeeded') {
        refetch();
        try {
          localStorage.removeItem('evaluationUpdated');
          localStorage.removeItem('reportRefreshNeeded');
        } catch (_) {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [id]);

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
      // Load areas for Lecturer target role; KPIs will be loaded after area selection
      const areas = await apiService.getAreas('Lecturer');
      setAvailableAreas(Array.isArray(areas) ? areas : []);
      setAreaKpis([]);
      setAvailableKpis([]);
      setShowAssignModal(true);
      setError('');
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

  // Remove KPI assignment
  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('Remove this KPI assignment?')) return;
    try {
      await apiService.deleteKpiAssignment(assignmentId);
      const assignments = await apiService.getKpiAssignmentsByLecturer(id);
      setKpiAssignments(Array.isArray(assignments) ? assignments : []);
      alert('KPI assignment removed');
    } catch (err) {
      alert('Failed to remove assignment: ' + (err.message || 'Unknown error'));
    }
  };

  const handleAssignKPI = async (e) => {
    e.preventDefault();
    if (!assignmentForm.areaId) { alert('Please select an Area'); return; }

    setSubmitting(true);
    try {
      // Load KPIs in selected area if not loaded
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

  // Handle Assign Workplan Modal
  const handleOpenAssignWorkplanModal = async () => {
    try {
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
        assigneeId: lecturer.id,
        assignmentNotes: workplanAssignmentForm.assignmentNotes
      });
      
      setShowAssignWorkplanModal(false);
      alert('Workplan assigned successfully!');
    } catch (error) {
      alert('Failed to assign workplan: ' + (error.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Evaluate Modal
  // Removed legacy evaluate modal opener

  // Area-based evaluation modal
  const handleOpenAreaEvaluateModal = async () => {
    try {
      // Ensure the lecturer has KPI assignments before evaluating
      const assignments = await apiService.getKpiAssignmentsByLecturer(id);
      if (!assignments || assignments.length === 0) {
        alert('No KPIs assigned to this lecturer');
        return;
      }
      // Evaluating a lecturer/HOD: load areas for the proper target role
      const targetRole = (user?.role === 'dean') ? 'HOD' : 'Lecturer';
      const areas = await apiService.getAreas(targetRole);
      const allAreas = Array.isArray(areas) ? areas : [];
      // Only allow evaluating areas that are actually assigned via KPI assignments
      const assignedAreaIds = new Set(
        (assignments || [])
          .map(a => (a.kpi?.areaId ?? a.kpi?.area?.id))
          .filter(id => id !== undefined && id !== null)
      );
      const filteredAreas = allAreas.filter(ar => assignedAreaIds.has(ar.id));
      setAvailableAreas(filteredAreas);
      setAreaKpis([]);
      setAreaEvaluationForm({ areaId: '', comments: '', scores: {} });
      setShowAreaEvaluateModal(true);
    } catch (err) {
      alert('Failed to load areas');
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
        lecturerId: lecturer.id,
        areaId: Number(areaEvaluationForm.areaId),
        comments: areaEvaluationForm.comments,
        items
      });
      setShowAreaEvaluateModal(false);
      alert('Area evaluation submitted successfully!');
    } catch (err) {
      alert('Failed to submit area evaluation: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  // Removed legacy evaluation submit handler

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
            <span className="contact-item material-icons" title="Email">Email : </span> <strong>{lecturer.email}</strong>
            {/*<span className="contact-item material-icons" title="Phone">call</span> {lecturer.phone}*/}
            {/*<span className="contact-item material-icons" title="Office">location_on</span> */}
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
                      <button className="btn btn-outline btn-sm" onClick={() => handleDeleteAssignment(assignment.id)}>Remove</button>
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
                      <span className="action-icon material-icons">edit_note</span>
                      Update Progress
                    </button>
                    <button className="action-btn">
                      <span className="action-icon material-icons">description</span>
                      Submit Workplan
                    </button>
                  </>
                )}
                {(user?.role === 'admin' || user?.role === 'hod' || user?.role === 'dean') && (
                  <>
                    <button className="action-btn" onClick={handleOpenAssignModal}>
                      <span className="action-icon material-icons">Assign KPI</span>
                    </button>
                    <button className="action-btn" onClick={handleOpenAssignWorkplanModal}>
                      <span className="action-icon material-icons">Assign Workplan</span>
                    </button>
                    {/* Legacy Evaluate removed; use Evaluate by Area only */}
                    <button className="action-btn" onClick={handleOpenAreaEvaluateModal}>
                      <span className="action-icon material-icons">Evaluate by Area</span>
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
                      
                    </div>
                    
                    <div className="kpi-metrics">
                      <div className="metric">
                        <span className="metric-label">Weight</span>
                        <span className="metric-value">{assignment.kpi?.weight || 0}</span>
                      </div>
                    </div>

                    <div className="kpi-progress-bar">
                      <div 
                        className="kpi-progress-fill"
                        style={{ 
                          width: '', // Default progress
                          backgroundColor: getCategoryColor(assignment.kpi?.category)
                        }}
                      />
                    </div>

                    <div className="kpi-actions-row">
                      <button className="btn btn-outline btn-sm" onClick={() => handleDeleteAssignment(assignment.id)}>Remove Assignment</button>
                    </div>

                    {assignment.kpi?.description && (
                      <div className="kpi-description">
                        <p><strong>{assignment.kpi.description}</strong></p>
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
                    {/* <div className="activity-date">
                      {formatDate(activity.date)}
                    </div> */}
                    <div className="activity-content">
                      {/* <div className="activity-icon material-icons">
                        {activity.type === 'submission' || 'Submission'}
                        {activity.type === 'Evaluation'}
                        {activity.type === 'assignment'}
                      </div> */}
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
      {/* Workplans Section for HODs */}
      {user?.role === 'hod' && workplans.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Workplans Submitted to You</h3>
          </div>
          <div className="workplans-list">
            {workplans.map(wp => (
              <div key={wp.id} className="workplan-item">
                <div><strong>Academic Year:</strong> {wp.academicYear}</div>
                <div><strong>Term:</strong> {wp.semester}</div>
                <div><strong>Status:</strong> {wp.status}</div>
                <div><strong>Submitted At:</strong> {formatDate(wp.submittedAt || wp.submissionDate)}</div>
                <div><strong>Actions:</strong> <button className="btn btn-outline btn-sm">View</button></div>
              </div>
            ))}
          </div>
        </div>
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
                  {/*<div className="detail-row">
                    <span className="detail-label">User ID:</span>
                    <span className="detail-value">{lecturer.id}</span>
                  </div>*/}
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
                    placeholder="2024"
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

      {/* Legacy Evaluate Modal removed */}

      {/* Evaluate by Area Modal */}
      {showAreaEvaluateModal && (
        <div className="modal-overlay" onClick={() => setShowAreaEvaluateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Evaluate by Area: {lecturer.fullName || lecturer.name}</h3>
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
      {showAssignWorkplanModal && (
        <div className="modal-overlay" onClick={() => setShowAssignWorkplanModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Assign Workplan to {lecturer.fullName || lecturer.name}</h3>
              <button 
                className="modal-close"
                onClick={() => setShowAssignWorkplanModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAssignWorkplan} className="modal-form">
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

export default LecturerProfile;
