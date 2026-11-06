
import React, { useState, useEffect } from 'react';
import apiService from '../../utils/api';
import './WorkplanSubmission.css';

const WorkplanSubmission = ({ user }) => {
  const [workplan, setWorkplan] = useState({
    academicYear: '2024/2025',
    semester: 'first',
    teachingActivities: '',
    researchActivities: '',
    serviceActivities: '',
    administrativeActivities: '',
    professionalDevelopment: '',
    objectives: '',
    expectedOutcomes: ''
  });
  const [assignedKPIs, setAssignedKPIs] = useState([]);
  const [submittedWorkplans, setSubmittedWorkplans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('create');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setError('');
      try {
        // Fetch assigned KPIs
        const kpis = await apiService.getMyKpis();
        setAssignedKPIs(Array.isArray(kpis) ? kpis : []);
        // Fetch submitted workplans
        const workplans = await apiService.getMyWorkplans();
        setSubmittedWorkplans(Array.isArray(workplans) ? workplans : []);
      } catch (err) {
        setError('Failed to load KPIs or workplans.');
      }
    };
    fetchData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setWorkplan(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let submitEndpoint;
      let successMessage;
      
      if (user.role === 'hod') {
        // HOD submits to Dean
        await apiService.submitWorkplanToDean({
          ...workplan,
          submitterId: user.id,
          submitterRole: user.role,
          departmentId: user.departmentId,
          recipientType: 'dean'
        });
        successMessage = 'Workplan submitted to Dean successfully!';
      } else if (user.role === 'lecturer') {
        // Lecturer submits to HOD
        await apiService.submitWorkplanToHOD({
          ...workplan,
          submitterId: user.id,
          submitterRole: user.role,
          departmentId: user.departmentId,
          recipientType: 'hod'
        });
        successMessage = 'Workplan submitted to HOD successfully!';
      } else {
        // Default submission
        await apiService.createWorkplan({
          ...workplan,
          submitterId: user.id,
          submitterRole: user.role
        });
        successMessage = 'Workplan submitted successfully!';
      }
      
      // Refresh submitted workplans
      const workplans = await apiService.getMyWorkplans();
      setSubmittedWorkplans(Array.isArray(workplans) ? workplans : []);
      
      // Reset form
      setWorkplan({
        academicYear: '2024/2025',
        semester: 'first',
        teachingActivities: '',
        researchActivities: '',
        serviceActivities: '',
        administrativeActivities: '',
        professionalDevelopment: '',
        objectives: '',
        expectedOutcomes: ''
      });
      
      alert(successMessage);
    } catch (err) {
      console.error('Error submitting workplan:', err);
      setError('Failed to submit workplan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      approved: { label: 'Approved', class: 'badge-success' },
      pending: { label: 'Pending Review', class: 'badge-warning' },
      rejected: { label: 'Needs Revision', class: 'badge-danger' }
    };
    
    const statusInfo = statusMap[status] || statusMap.pending;
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
      administration: '#f39c12'
    };
    return colors[category] || '#11486B';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="workplan-container">
      <div className="page-header">
        <h1>{user.role === 'hod' ? 'Department Workplan' : 'My Workplan'}</h1>
        <p>
          {user.role === 'hod' 
            ? 'Plan your department activities and submit to Dean for review'
            : 'Plan and track your academic activities and KPIs'
          }
        </p>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create Workplan
        </button>
        <button 
          className={`tab-btn ${activeTab === 'kpis' ? 'active' : ''}`}
          onClick={() => setActiveTab('kpis')}
        >
          My KPIs
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Submission History
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'create' && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Create New Workplan</h2>
              <p>Plan your activities for the academic period</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-grid basic-info">
                <div className="form-group">
                  <label className="form-label">Academic Year</label>
                  <select
                    name="academicYear"
                    value={workplan.academicYear}
                    onChange={handleInputChange}
                    className="form-select"
                    required
                  >
                    <option value="2024/2025">2024/2025</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Period</label>
                  <select
                    name="semester"
                    value={workplan.semester}
                    onChange={handleInputChange}
                    className="form-select"
                    required
                  >
                    <option value="first">First Term</option>
                    <option value="second">Second Term</option>
                    <option value="third">Third Term</option>
                    <option value="academic">Academic Year</option>
                  </select>
                </div>
              </div>

              <div className="activities-section">
                <div className="form-group">
                  <label className="form-label">Teaching Activities</label>
                  <textarea
                    name="teachingActivities"
                    value={workplan.teachingActivities}
                    onChange={handleInputChange}
                    className="form-textarea"
                    rows="4"
                    placeholder="Describe your planned teaching activities, courses to be delivered, and teaching methods..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Research Activities</label>
                  <textarea
                    name="researchActivities"
                    value={workplan.researchActivities}
                    onChange={handleInputChange}
                    className="form-textarea"
                    rows="4"
                    placeholder="Outline your research projects, publications planned, conferences to attend..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Service Activities</label>
                  <textarea
                    name="serviceActivities"
                    value={workplan.serviceActivities}
                    onChange={handleInputChange}
                    className="form-textarea"
                    rows="4"
                    placeholder="Detail your service contributions, committee memberships, student supervision..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Administrative Activities</label>
                  <textarea
                    name="administrativeActivities"
                    value={workplan.administrativeActivities}
                    onChange={handleInputChange}
                    className="form-textarea"
                    rows="3"
                    placeholder="List any administrative roles or responsibilities..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Professional Development</label>
                  <textarea
                    name="professionalDevelopment"
                    value={workplan.professionalDevelopment}
                    onChange={handleInputChange}
                    className="form-textarea"
                    rows="3"
                    placeholder="Describe planned professional development activities, training, certifications..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Key Objectives</label>
                  <textarea
                    name="objectives"
                    value={workplan.objectives}
                    onChange={handleInputChange}
                    className="form-textarea"
                    rows="4"
                    placeholder="State your main objectives for this academic period..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Expected Outcomes</label>
                  <textarea
                    name="expectedOutcomes"
                    value={workplan.expectedOutcomes}
                    onChange={handleInputChange}
                    className="form-textarea"
                    rows="4"
                    placeholder="Describe the expected outcomes and deliverables..."
                    required
                  />
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : 'Submit Workplan'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear all fields?')) {
                      setWorkplan({
                        academicYear: '2024/2025',
                        semester: 'first',
                        teachingActivities: '',
                        researchActivities: '',
                        serviceActivities: '',
                        administrativeActivities: '',
                        professionalDevelopment: '',
                        objectives: '',
                        expectedOutcomes: ''
                      });
                    }
                  }}
                >
                  Clear Form
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'kpis' && (
          <div className="kpis-section">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">My Assigned KPIs</h2>
                <p>Key Performance Indicators assigned to you</p>
              </div>

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
                        <span className="metric-value">{kpi.weight}%</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Target</span>
                        <span className="metric-value">{kpi.targetValue} {kpi.unit}</span>
                      </div>
                    </div>

                    <div className="kpi-actions">
                      <button className="btn btn-sm btn-outline">
                        Update Progress
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">KPI Performance Summary</h3>
              </div>
              
              <div className="performance-summary">
                <div className="summary-grid">
                  <div className="summary-card">
                    <span className="summary-number">{assignedKPIs.length}</span>
                    <span className="summary-label">Total KPIs</span>
                  </div>
                  <div className="summary-card">
                    <span className="summary-number">{assignedKPIs.filter(k => k.category === 'teaching').length}</span>
                    <span className="summary-label">Lecturing</span>
                  </div>
                  <div className="summary-card">
                    <span className="summary-number">{assignedKPIs.filter(k => k.category === 'research').length}</span>
                    <span className="summary-label">Research</span>
                  </div>
                  <div className="summary-card">
                    <span className="summary-number">{assignedKPIs.filter(k => k.category === 'service').length}</span>
                    <span className="summary-label">Service</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-section">
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Workplan Submission History</h2>
                <p>View your previously submitted workplans</p>
                {submittedWorkplans.length > 0 && (
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={exporting}
                    onClick={async () => {
                      setExporting(true);
                      setError('');
                      try {
                        await apiService.exportMyDepartmentReport(
                          workplan.academicYear,
                          workplan.semester,
                          'pdf'
                        );
                        alert('Report export started. Check your downloads.');
                      } catch (err) {
                        setError('Failed to export report.');
                      } finally {
                        setExporting(false);
                      }
                    }}
                  >
                    <span className="material-icons" style={{verticalAlign:'middle'}}>download</span> Export PDF
                  </button>
                )}
              </div>

              {submittedWorkplans.length > 0 ? (
                <div className="history-list">
                  {submittedWorkplans.map(submission => (
                    <div key={submission.id} className="history-item">
                      <div className="history-header">
                        <div className="history-info">
                          <h3 className="history-title">
                            {submission.academicYear} - {submission.semester} Semester
                          </h3>
                          <p className="history-date">
                            Submitted: {formatDate(submission.submissionDate)}
                          </p>
                        </div>
                        <div className="history-status">
                          {getStatusBadge(submission.status)}
                        </div>
                      </div>

                      {submission.feedback && (
                        <div className="history-feedback">
                          <h4>Supervisor Feedback:</h4>
                          <p>{submission.feedback}</p>
                        </div>
                      )}

                      <div className="history-actions">
                        <button className="btn btn-sm btn-outline">
                          View Details
                        </button>
                        <button className="btn btn-sm btn-secondary">
                          <span className="material-icons" style={{verticalAlign:'middle'}}>download</span> Download PDF
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-history">
                  <div className="no-history-icon material-icons">description</div>
                  <h3>No Submissions Yet</h3>
                  <p>Your workplan submissions will appear here once you submit them.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkplanSubmission;