import React, { useState, useEffect } from 'react';
import apiService from '../../utils/api';
import './WorkplanAssignment.css';

const WorkplanAssignment = ({ user }) => {
  const [assignedWorkplans, setAssignedWorkplans] = useState([]);
  const [standardWorkplans, setStandardWorkplans] = useState([]);
  const [assignedByMe, setAssignedByMe] = useState([]);
  const [subordinates, setSubordinates] = useState([]);
  const [assignedKPIs, setAssignedKPIs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(getDefaultTab(user?.role));
  const [selectedWorkplan, setSelectedWorkplan] = useState(null);
  const [selectedSubordinates, setSelectedSubordinates] = useState([]);
  const [assignmentNotes, setAssignmentNotes] = useState('');
  // Area-based KPI assignment
  const [areasForAssign, setAreasForAssign] = useState([]);
  const [selectedAreaIds, setSelectedAreaIds] = useState([]);

  // Self-evaluation modal state
  const [selfEvalOpen, setSelfEvalOpen] = useState(false);
  const [areasForRole, setAreasForRole] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [scores, setScores] = useState({});
  const [selfEvalSubmitting, setSelfEvalSubmitting] = useState(false);
  const [selfEvalMsg, setSelfEvalMsg] = useState('');
  const [selfEvalErr, setSelfEvalErr] = useState('');

  function getDefaultTab(role) {
    switch (role) {
      case 'HOD':
        return 'assign'; // Supervisors see assignment tab first
      case 'Dean':
      case 'Lecturer':
      default:
        return 'assigned'; // Subordinates see their assignments first
    }
  }

  // --- Self-evaluation helpers ---
  const openSelfEvaluationModal = async () => {
    setSelfEvalErr('');
    setSelfEvalMsg('');
    setScores({});
    try {
      // Map role to target role expected by Areas endpoint
      const role = user?.role || 'Lecturer';
      const areas = await apiService.getAreas(role);
      const arr = Array.isArray(areas) ? areas : [];
      const areaIdsInKpis = new Set((assignedKPIs || []).map(k => k.areaId ?? k.AreaId).filter(Boolean));
      const filtered = arr.filter(a => areaIdsInKpis.has(a.id ?? a.Id));
      setAreasForRole(filtered);
      const firstValid = filtered[0];
      setSelectedAreaId(firstValid ? String(firstValid.id ?? firstValid.Id) : '');
      setSelfEvalOpen(true);
    } catch (e) {
      console.error('Failed to load areas for self-eval', e);
      setAreasForRole([]);
      setSelectedAreaId('');
      setSelfEvalErr(e?.message || 'Failed to load areas');
      setSelfEvalOpen(true);
    }
  };

  const closeSelfEvaluationModal = () => {
    setSelfEvalOpen(false);
    setScores({});
    setSelectedAreaId('');
    setSelfEvalErr('');
    setSelfEvalMsg('');
  };

  const kpisInSelectedArea = (assignedKPIs || []).filter(k => {
    const aid = k.areaId ?? k.AreaId;
    return selectedAreaId ? String(aid) === String(selectedAreaId) : true;
  });

  const handleScoreRadio = (kpiId, val) => {
    setScores(prev => ({ ...prev, [kpiId]: val }));
  };

  const submitSelfEvaluation = async (e) => {
    e?.preventDefault?.();
    setSelfEvalSubmitting(true);
    setSelfEvalErr('');
    setSelfEvalMsg('');
    try {
      const areaIdNum = Number(selectedAreaId);
      const items = kpisInSelectedArea.map(k => ({
        kpiId: k.id ?? k.Id,
        score: Number(scores[k.id ?? k.Id] ?? 0)
      }));
      if (!areaIdNum || items.length === 0) {
        setSelfEvalErr('No assigned KPIs found for the selected area.');
        setSelfEvalSubmitting(false);
        return;
      }
      await apiService.createSelfAreaEvaluation({ areaId: areaIdNum, items, comments: undefined });
      setSelfEvalMsg('Self-evaluation submitted successfully.');
      setScores({});
    } catch (e) {
      console.error('Self-eval submit failed', e);
      setSelfEvalErr(e?.message || 'Failed to submit self-evaluation');
    } finally {
      setSelfEvalSubmitting(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      // Fetch only KPIs assigned to the current user
      try {
        const myKpis = await apiService.getMyAssign();
        setAssignedKPIs(Array.isArray(myKpis) ? myKpis : []);
      } catch (err) {
        console.error('Failed to fetch my KPIs:', err);
        setAssignedKPIs([]);
      }

      // Fetch workplans assigned to the current user
      try {
        const myAssignments = await apiService.getMyWorkplanAssignments();
        setAssignedWorkplans(Array.isArray(myAssignments) ? myAssignments : []);
      } catch (err) {
        console.error('Failed to fetch my workplan assignments:', err);
        setAssignedWorkplans([]);
      }

      // If user is HOD or Dean, fetch data needed for assignment/monitoring tabs
      if (user.role === 'HOD' || user.role === 'Dean') {
        try {
          // Standard workplans for assigning
          const standardWorkplansList = await apiService.getStandardWorkplansForAssignment();
          setStandardWorkplans(Array.isArray(standardWorkplansList) ? standardWorkplansList : []);

          // Assignments created by the current supervisor
          const assignmentsByMe = await apiService.getWorkplanAssignmentsByMe();
          setAssignedByMe(Array.isArray(assignmentsByMe) ? assignmentsByMe : []);

          // Subordinates
          if (user.role === 'Dean') {
            const hods = await apiService.getHODs();
            setSubordinates(Array.isArray(hods) ? hods : []);
          } else if (user.role === 'HOD' && user.departmentId) {
            const lecturers = await apiService.getDepartmentLecturers(user.departmentId);
            setSubordinates(Array.isArray(lecturers) ? lecturers : []);
          }
        } catch (err) {
          console.error('Failed to fetch supervisor data:', err);
        }
      }

    } catch (err) {
      console.error('Error fetching workplan data:', err);
      setError('Failed to load workplan data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignWorkplan = async (e) => {
    e.preventDefault();
    if (!selectedWorkplan || selectedSubordinates.length === 0) {
      alert('Please select a workplan and at least one person to assign it to.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      if (selectedSubordinates.length === 1) {
        // Single assignment
        await apiService.assignWorkplan({
          standardWorkplanId: selectedWorkplan,
          assigneeId: selectedSubordinates[0],
          assignmentNotes: assignmentNotes
        });
        // If areas selected, assign KPIs by areas
        if (selectedAreaIds.length > 0) {
          try {
            const res = await apiService.assignKpisByAreas({
              standardWorkplanId: selectedWorkplan,
              assigneeIds: [selectedSubordinates[0]],
              areaIds: selectedAreaIds,
              assignmentNotes
            });
            alert(`Workplan assigned. Areas mapping: ${res.Assigned ?? res.assigned ?? 0} created, ${res.Skipped ?? res.skipped ?? 0} skipped.`);
          } catch (e2) {
            console.error('Area KPI assignment failed', e2);
            alert('Workplan assigned. Failed to assign KPIs by areas.');
          }
        } else {
          alert('Workplan assigned successfully!');
        }
      } else {
        // Bulk assignment
        const result = await apiService.bulkAssignWorkplan({
          standardWorkplanId: selectedWorkplan,
          assigneeIds: selectedSubordinates,
          assignmentNotes: assignmentNotes
        });
        // Additionally map areas to KPI assignments for all selected users
        if (selectedAreaIds.length > 0) {
          try {
            const res = await apiService.assignKpisByAreas({
              standardWorkplanId: selectedWorkplan,
              assigneeIds: selectedSubordinates,
              areaIds: selectedAreaIds,
              assignmentNotes
            });
            alert(`Workplan assigned to ${result.assignedCount}. Areas mapping: ${res.Assigned ?? res.assigned ?? 0} created, ${res.Skipped ?? res.skipped ?? 0} skipped.${result.errors?.length ? ' ' + result.errors.length + ' errors occurred.' : ''}`);
          } catch (e2) {
            console.error('Area KPI assignment failed', e2);
            alert(`Workplan assigned to ${result.assignedCount}. Failed to assign KPIs by areas.${result.errors?.length ? ' ' + result.errors.length + ' errors occurred.' : ''}`);
          }
        } else {
          alert(`Workplan assigned to ${result.assignedCount} users. ${result.errors?.length ? result.errors.length + ' errors occurred.' : ''}`);
        }
      }
      
      // Reset form
      setSelectedWorkplan(null);
      setSelectedSubordinates([]);
      setAssignmentNotes('');
      setAreasForAssign([]);
      setSelectedAreaIds([]);
      
      // Refresh data
      await fetchData();
    } catch (err) {
      console.error('Error assigning workplan:', err);
      setError('Failed to assign workplan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (assignmentId, status, progress, notes = '') => {
    setLoading(true);
    setError('');
    
    try {
      await apiService.updateWorkplanAssignmentStatus(assignmentId, {
        status,
        progress,
        notes
      });
      
      alert('Status updated successfully!');
      await fetchData();
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Failed to update status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId) => {
    if (!window.confirm('Are you sure you want to remove this assignment?')) return;
    
    setLoading(true);
    setError('');
    
    try {
      await apiService.removeWorkplanAssignment(assignmentId);
      alert('Assignment removed successfully!');
      await fetchData();
    } catch (err) {
      console.error('Error removing assignment:', err);
      setError('Failed to remove assignment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'Assigned': { label: 'Assigned', class: 'badge-info' },
      'InProgress': { label: 'In Progress', class: 'badge-warning' },
      'Completed': { label: 'Completed', class: 'badge-success' },
      'Reviewed': { label: 'Reviewed', class: 'badge-success' }
    };
    
    const statusInfo = statusMap[status] || statusMap['Assigned'];
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

  const getCategoryColor = (category) => {
    const colors = {
      teaching: '#11486B',
      research: '#e74c3c',
      service: '#27ae60',
      administration: '#f39c12'
    };
    return colors[category] || '#11486B';
  };

  const handleSubordinateSelection = (subordinateId) => {
    setSelectedSubordinates(prev => 
      prev.includes(subordinateId) 
        ? prev.filter(id => id !== subordinateId)
        : [...prev, subordinateId]
    );
  };

  if (loading && !assignedWorkplans.length && !standardWorkplans.length) {
    return (
      <div className="workplan-container">
        <div className="loading">Loading workplan data...</div>
      </div>
    );
  }

  return (
    <div className="workplan-container">
      <div className="page-header">
        <h1>
          {user?.role === 'Dean' ? 'University Workplan Management' :
           user?.role === 'HOD' ? 'Department Workplan Management' : 
           'My Assigned Workplans'}
        </h1>
        <p>
          {user?.role === 'Dean' ? 'Assign and monitor workplans across all departments' :
           user?.role === 'HOD' ? 'Assign workplans to lecturers and manage departmental objectives' :
           'View your assigned workplans'}
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="tab-navigation">
        {/* Supervisors (Dean/HOD) can assign workplans */}
        {(user?.role === 'Dean' || user?.role === 'HOD') && (
          <>
            <button 
              className={`tab-btn ${activeTab === 'assign' ? 'active' : ''}`}
              onClick={() => setActiveTab('assign')}
            >
              Assign Workplans
            </button>
            <button 
              className={`tab-btn ${activeTab === 'monitoring' ? 'active' : ''}`}
              onClick={() => setActiveTab('monitoring')}
            >
              Monitor Assignments
            </button>
          </>
        )}
        
        {/* All users can view their assigned workplans */}
        <button 
          className={`tab-btn ${activeTab === 'assigned' ? 'active' : ''}`}
          onClick={() => setActiveTab('assigned')}
        >
          My Assignments
        </button>
        
        <button 
          className={`tab-btn ${activeTab === 'kpis' ? 'active' : ''}`}
          onClick={() => setActiveTab('kpis')}
        >
          My KPIs
        </button>
      </div>

      <div className="tab-content">
        {/* Assignment Tab - Only for Supervisors */}
        {activeTab === 'assign' && (user?.role === 'Dean' || user?.role === 'HOD') && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Assign Workplan to {user?.role === 'Dean' ? 'HODs' : 'Lecturers'}</h2>
              <p>Select a standard workplan and assign it to your subordinates</p>
            </div>

            {standardWorkplans.length === 0 ? (
              <div className="no-data">
                <p>No standard workplans available for assignment.</p>
                {user?.role === 'Dean' && <p>Create standard workplans first.</p>}
              </div>
            ) : (
              <form onSubmit={handleAssignWorkplan}>
                <div className="form-group">
                  <label className="form-label">Select Standard Workplan</label>
                  <select
                    value={selectedWorkplan || ''}
                    onChange={async (e) => {
                      const val = e.target.value ? parseInt(e.target.value) : null;
                      setSelectedWorkplan(val);
                      setAreasForAssign([]);
                      setSelectedAreaIds([]);
                      if (val) {
                        try {
                          const sp = (standardWorkplans || []).find(w => w.id === val);
                          const targetRole = sp?.targetRole || sp?.TargetRole || (user?.role === 'Dean' ? 'HOD' : 'Lecturer');
                          const fetchedAreas = await apiService.getAreas(targetRole);
                          setAreasForAssign(Array.isArray(fetchedAreas) ? fetchedAreas : []);
                        } catch (err) {
                          console.error('Failed to load areas for selected workplan role', err);
                          setAreasForAssign([]);
                        }
                      }
                    }}
                    className="form-select"
                    required
                  >
                    <option value="">Choose a workplan...</option>
                    {standardWorkplans.map(workplan => (
                      <option key={workplan.id} value={workplan.id}>
                        {workplan.title} - {workplan.academicYear} ({workplan.semester})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Multi-area KPI assignment (optional) */}
                <div className="form-group">
                  <label className="form-label">Assign Areas (all KPIs under selected areas will be assigned)</label>
                  {areasForAssign.length === 0 ? (
                    <p style={{ padding: '0 25px', color: '#6c757d' }}>No areas available for the selected workplan role.</p>
                  ) : (
                    <div style={{ padding: '0 25px' }}>
                      <select multiple className="form-select" value={selectedAreaIds.map(String)} onChange={(e) => {
                        const options = Array.from(e.target.selectedOptions).map(opt => parseInt(opt.value));
                        setSelectedAreaIds(options);
                      }} style={{ minHeight: '140px' }}>
                        {areasForAssign.map(a => (
                          <option key={a.id ?? a.Id} value={a.id ?? a.Id}>{a.name ?? a.Name}</option>
                        ))}
                      </select>
                      <p className="card-subtitle">Hold Ctrl/Cmd to select multiple areas.</p>
                    </div>
                  )}
                </div>

                {selectedWorkplan && (
                  <div className="workplan-preview">
                    {standardWorkplans.find(w => w.id === selectedWorkplan) && (
                      <div className="preview-content">
                        <h4>{standardWorkplans.find(w => w.id === selectedWorkplan).title}</h4>
                        <p>{standardWorkplans.find(w => w.id === selectedWorkplan).description}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">
                    Select {user?.role === 'Dean' ? 'HODs' : 'Lecturers'} to Assign
                  </label>
                  {subordinates.length === 0 ? (
                    <p>No {user?.role === 'Dean' ? 'HODs' : 'lecturers'} available.</p>
                  ) : (
                    <div className="subordinates-list">
                      {subordinates.map(subordinate => (
                        <label key={subordinate.id} className="subordinate-item">
                          <input
                            type="checkbox"
                            checked={selectedSubordinates.includes(subordinate.id)}
                            onChange={() => handleSubordinateSelection(subordinate.id)}
                          />
                          <span>{subordinate.fullName}</span>
                          {subordinate.department && <span className="department">({subordinate.department.name})</span>}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Assignment Notes (Optional)</label>
                  <textarea
                    value={assignmentNotes}
                    onChange={(e) => setAssignmentNotes(e.target.value)}
                    className="form-textarea"
                    rows="3"
                    placeholder="Add any specific instructions or notes for this assignment..."
                  />
                </div>

                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={loading || !selectedWorkplan || selectedSubordinates.length === 0}
                  >
                    {loading ? 'Assigning...' : `Assign to ${selectedSubordinates.length} ${selectedSubordinates.length === 1 ? 'person' : 'people'}`}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Monitoring Tab - Only for Supervisors */}
        {activeTab === 'monitoring' && (user?.role === 'Dean' || user?.role === 'HOD') && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Monitor Assignments</h2>
              <p>Track progress of workplans you have assigned</p>
            </div>

            {assignedByMe.length === 0 ? (
              <div className="no-data">
                <p>You haven't assigned any workplans yet.</p>
              </div>
            ) : (
              <div className="assignments-list">
                {assignedByMe.map(assignment => (
                  <div key={assignment.id} className="assignment-item">
                    <div className="assignment-header">
                      <div className="assignment-info">
                        <h3>{assignment.standardWorkplan.title}</h3>
                        <p>Assigned to: <strong>{assignment.assignee.fullName}</strong></p>
                        <p>Academic Year: {assignment.standardWorkplan.academicYear}</p>
                        <small>Assigned: {formatDate(assignment.assignedAt)}</small>
                      </div>
                      <div className="assignment-status">
                        {getStatusBadge(assignment.status)}
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${assignment.progress}%` }}
                          ></div>
                        </div>
                        <small>{assignment.progress}% Complete</small>
                      </div>
                    </div>

                    {assignment.assignmentNotes && (
                      <div className="assignment-notes">
                        <strong>Assignment Notes:</strong>
                        <p>{assignment.assignmentNotes}</p>
                      </div>
                    )}

                    {assignment.completionNotes && (
                      <div className="completion-notes">
                        <strong>Completion Notes:</strong>
                        <p>{assignment.completionNotes}</p>
                      </div>
                    )}

                    <div className="assignment-actions">
                      <button 
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          const feedback = prompt('Enter your review feedback:');
                          if (feedback) {
                            handleUpdateStatus(assignment.id, 'Reviewed', assignment.progress, feedback);
                          }
                        }}
                        disabled={assignment.status !== 'Completed'}
                      >
                        Review
                      </button>
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemoveAssignment(assignment.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Assignments Tab - For all users */}
        {activeTab === 'assigned' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">My Assigned Workplans</h2>
              <p>Workplans that have been assigned to you by your supervisor</p>
            </div>

            {assignedWorkplans.length === 0 ? (
              <div className="no-data">
                <div className="no-data-icon">📋</div>
                <h3>No Workplans Assigned</h3>
                <p>You don't have any workplans assigned to you yet. Check back later or contact your supervisor.</p>
              </div>
            ) : (
              <div className="assigned-workplans-list">
                {assignedWorkplans.map(assignment => (
                  <div key={assignment.id} className="workplan-card">
                    <div className="workplan-header">
                      <div className="workplan-info">
                        <h3>{assignment.standardWorkplan.title}</h3>
                        <p className="workplan-period">
                          {assignment.standardWorkplan.academicYear} - {assignment.standardWorkplan.semester}
                        </p>
                        <p>Assigned by: <strong>{assignment.assignedBy}</strong></p>
                        <small>Assigned: {formatDate(assignment.assignedAt)}</small>
                      </div>
                      
                    </div>

                    <div className="workplan-details">
                      <p className="workplan-description">{assignment.standardWorkplan.description}</p>
                      
                      <div className="workplan-activities">
                        <div className="activity-section">
                          <h4>Teaching Activities</h4>
                          <p>{assignment.standardWorkplan.teachingActivities}</p>
                        </div>
                        
                        <div className="activity-section">
                          <h4>Research Activities</h4>
                          <p>{assignment.standardWorkplan.researchActivities}</p>
                        </div>
                        
                        <div className="activity-section">
                          <h4>Service Activities</h4>
                          <p>{assignment.standardWorkplan.serviceActivities}</p>
                        </div>

                        {assignment.standardWorkplan.administrativeActivities && (
                          <div className="activity-section">
                            <h4>Administrative Activities</h4>
                            <p>{assignment.standardWorkplan.administrativeActivities}</p>
                          </div>
                        )}
                        
                        <div className="activity-section">
                          <h4>Professional Development</h4>
                          <p>{assignment.standardWorkplan.professionalDevelopment}</p>
                        </div>
                        
                        <div className="activity-section">
                          <h4>Key Objectives</h4>
                          <p>{assignment.standardWorkplan.objectives}</p>
                        </div>
                        
                        <div className="activity-section">
                          <h4>Expected Outcomes</h4>
                          <p>{assignment.standardWorkplan.expectedOutcomes}</p>
                        </div>
                      </div>
                    </div>

                    {assignment.assignmentNotes && (
                      <div className="assignment-notes">
                        <h4>Assignment Notes from Supervisor:</h4>
                        <p>{assignment.assignmentNotes}</p>
                      </div>
                    )}

                    {assignment.reviewFeedback && (
                      <div className="review-feedback">
                        <h4>Supervisor Feedback:</h4>
                        <p>{assignment.reviewFeedback}</p>
                      </div>
                    )}

                    <div className="workplan-actions">
                      
                      {assignment.status === 'InProgress' && (
                        <>
                          <button 
                            className="btn btn-secondary"
                            onClick={() => {
                              const progress = prompt('Enter your progress percentage (0-100):', assignment.progress);
                              if (progress && !isNaN(progress)) {
                                const progressNum = Math.max(0, Math.min(100, parseInt(progress)));
                                handleUpdateStatus(assignment.id, 'InProgress', progressNum);
                              }
                            }}
                          >
                            Update Progress ({assignment.progress}%)
                          </button>
                          <button 
                            className="btn btn-success"
                            onClick={() => {
                              const notes = prompt('Enter completion notes:');
                              if (notes) {
                                handleUpdateStatus(assignment.id, 'Completed', 100, notes);
                              }
                            }}
                          >
                            Mark Complete
                          </button>
                        </>
                      )}
                      
                      {assignment.status === 'Completed' && (
                        <span className="status-text"></span>
                      )}
                      
                      {assignment.status === 'Reviewed' && (
                        <span className="status-text completed">✓ Completed and Reviewed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* KPIs Tab - For all users */}
        {activeTab === 'kpis' && (
          <div className="kpis-section">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">My Assigned KPIs</h2>
                <p>Key Performance Indicators assigned to you</p>
              </div>

              {assignedKPIs.length === 0 ? (
                <div className="no-data">
                  <p>No KPIs assigned to you yet.</p>
                </div>
              ) : (
                <div className="kpis-grid">
                  {assignedKPIs.map(kpi => (
                    <div key={kpi.id} className="kpi-card">
                      <div className="kpi-header">
                        <h3 className="kpi-title">{kpi.title}</h3>
                        <span 
                          className="category-badge"
                          style={{ backgroundColor: getCategoryColor(kpi.category) }}
                        >
                          {kpi.category}
                        </span>
                      </div>
                      
                      <p className="kpi-description">{kpi.description}</p>
                      
                      <div className="kpi-metrics">
                        <div className="metric">
                          <span className="metric-label">Weight</span>
                          <span className="metric-value">{kpi.weight}</span>
                        </div>
                        <div className="metric">
                          <span className="metric-label"></span>
                          <span className="metric-value">{kpi.targetValue} {kpi.unit}</span>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={openSelfEvaluationModal}>Self-evaluate</button>
            </div>

            {/* Self-Evaluation Modal */}
            {selfEvalOpen && (
              <div className="modal-overlay">
                <div className="modal">
                  <div className="modal-header">
                    <h3>Self Evaluation</h3>
                    <button className="close-btn" onClick={closeSelfEvaluationModal}>×</button>
                  </div>
                  <div className="modal-body">
                    {selfEvalMsg && <div className="alert success">{selfEvalMsg}</div>}
                    {selfEvalErr && <div className="alert error">{selfEvalErr}</div>}

                    <div className="form-group">
                      <label>Select Area</label>
                      <select className="form-select" value={selectedAreaId} onChange={e => setSelectedAreaId(e.target.value)}>
                        {(areasForRole || []).map(a => (
                          <option key={a.id ?? a.Id} value={a.id ?? a.Id}>{a.name ?? a.Name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="kpi-radio-list">
                      {kpisInSelectedArea.length === 0 ? (
                        <div className="empty">No assigned KPIs in the selected area.</div>
                      ) : (
                        kpisInSelectedArea.map(k => (
                          <div key={k.id ?? k.Id} className="kpi-radio-item">
                            <div className="kpi-title">{k.title ?? k.Title}</div>
                            <div className="radio-group">
                              {[0,1,2,3,4,5].map(v => (
                                <label key={v} className="radio-option">
                                  <input
                                    type="radio"
                                    name={`kpi-${k.id ?? k.Id}`}
                                    checked={(scores[k.id ?? k.Id] ?? null) === v}
                                    onChange={() => handleScoreRadio(k.id ?? k.Id, v)}
                                  />
                                  <span>{v}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn" onClick={closeSelfEvaluationModal}>Cancel</button>
                    <button className="btn btn-primary" disabled={selfEvalSubmitting || kpisInSelectedArea.length === 0} onClick={submitSelfEvaluation}>
                      {selfEvalSubmitting ? 'Submitting...' : 'Submit'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkplanAssignment;