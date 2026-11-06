import React, { useState, useEffect } from 'react';
import apiService from '../../utils/api';
import './DeanEvaluations.css';

const DeanEvaluations = ({ user }) => {
  const [hods, setHods] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEvaluateModal, setShowEvaluateModal] = useState(false);
  const [selectedHod, setSelectedHod] = useState(null);
  const [evaluationForm, setEvaluationForm] = useState({
    kpiId: '',
    score: '',
    comments: '',
    evaluationPeriod: '',
    academicYear: new Date().getFullYear().toString()
  });
  const [availableKpis, setAvailableKpis] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [filteredHods, setFilteredHods] = useState([]);

  useEffect(() => {
    fetchHodsAndEvaluations();
  }, []);

  useEffect(() => {
    // Filter HODs based on search and department
    let filtered = hods.filter(hod => {
      const matchesSearch = hod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           hod.department.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDepartment = selectedDepartment === 'all' || hod.department === selectedDepartment;
      return matchesSearch && matchesDepartment;
    });
    setFilteredHods(filtered);
  }, [hods, searchTerm, selectedDepartment]);

  const fetchHodsAndEvaluations = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Fetch HODs (users with HOD role)
      const hodsResponse = await apiService.getHODs();
      const evaluationsResponse = await apiService.getAllEvaluations();
      
      // Transform HODs data
      const transformedHods = (hodsResponse || []).map(hod => ({
        id: hod.id,
        name: hod.fullName || hod.name,
        email: hod.email,
        department: hod.department || 'Unassigned',
        departmentId: hod.departmentId,
        position: 'HOD',
        lastEvaluated: null,
        averageScore: 0,
        totalEvaluations: 0
      }));

      // Calculate evaluation stats for each HOD
      transformedHods.forEach(hod => {
        const hodEvaluations = (evaluationsResponse || []).filter(evaluation => evaluation.lecturerId === hod.id);
        hod.totalEvaluations = hodEvaluations.length;
        hod.averageScore = hodEvaluations.length > 0 
          ? Math.round(hodEvaluations.reduce((sum, evaluation) => sum + evaluation.score, 0) / hodEvaluations.length)
          : 0;
        hod.lastEvaluated = hodEvaluations.length > 0 
          ? new Date(Math.max(...hodEvaluations.map(evaluation => new Date(evaluation.createdAt || evaluation.dateCreated)))).toLocaleDateString()
          : null;
      });

      setHods(transformedHods);
      setEvaluations(evaluationsResponse || []);
    } catch (error) {
      console.error('Error fetching HODs and evaluations:', error);
      setError('Failed to load HOD data. Please try again.');
      setHods([]);
      setEvaluations([]);
    }
    
    setLoading(false);
  };

  const handleOpenEvaluateModal = async (hod) => {
    try {
      setSelectedHod(hod);
      const kpis = await apiService.getMyKpis();
      setAvailableKpis(kpis || []);
      setShowEvaluateModal(true);
      setEvaluationForm({
        kpiId: '',
        score: '',
        comments: '',
        evaluationPeriod: 'Semester 1',
        academicYear: new Date().getFullYear().toString()
      });
    } catch (error) {
      setError('Failed to load available KPIs');
    }
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
        lecturerId: selectedHod.id,
        kpiId: parseInt(evaluationForm.kpiId),
        score: parseFloat(evaluationForm.score),
        comments: evaluationForm.comments,
        evaluationPeriod: evaluationForm.evaluationPeriod,
        academicYear: evaluationForm.academicYear
      });
      
      setShowEvaluateModal(false);
      alert('HOD evaluation submitted successfully!');
      setSelectedHod(null);
      // Refresh data
      await fetchHodsAndEvaluations();
    } catch (error) {
      alert('Failed to submit evaluation: ' + (error.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const getPerformanceColor = (score) => {
    if (score >= 85) return '#27ae60';
    if (score >= 70) return '#f39c12';
    return '#e74c3c';
  };

  const getDepartments = () => {
    const departments = [...new Set(hods.map(h => h.department))].filter(dept => dept !== 'Unassigned');
    return departments.sort();
  };

  if (loading) {
    return (
      <div className="dean-evaluations-container">
        <div className="loading">Loading HOD data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dean-evaluations-container">
        <div className="error-message">
          <h3>❌ Error Loading Data</h3>
          <p>{error}</p>
          <button onClick={fetchHodsAndEvaluations} className="btn btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dean-evaluations-container">
      <div className="page-header">
        <div className="header-content">
          <h1>HOD Evaluations</h1>
          <p>Evaluate the performance of Heads of Departments</p>
        </div>
        <div className="header-stats">
          <div className="stat-item">
            <span className="stat-number">{hods.length}</span>
            <span className="stat-label">Total HODs</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{hods.filter(h => h.totalEvaluations > 0).length}</span>
            <span className="stat-label">Evaluated</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{getDepartments().length}</span>
            <span className="stat-label">Departments</span>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search HODs by name or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="filter-controls">
          <div className="filter-group">
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
          </div>
          <button onClick={fetchHodsAndEvaluations} className="btn btn-outline btn-sm">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* HODs Grid */}
      <div className="hods-grid">
        {filteredHods.map(hod => (
          <div key={hod.id} className="hod-card">
            <div className="hod-header">
              <div className="hod-avatar">
                {hod.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
              <div className="hod-basic-info">
                <h3 className="hod-name">{hod.name}</h3>
                <p className="hod-position">{hod.position}</p>
                <p className="hod-department">{hod.department}</p>
              </div>
            </div>

            <div className="hod-details">
              <div className="detail-row">
                <span className="detail-label">📧 Email:</span>
                <span className="detail-value">{hod.email}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">📊 Evaluations:</span>
                <span className="detail-value">{hod.totalEvaluations}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">⭐ Avg Score:</span>
                <span 
                  className="detail-value score"
                  style={{ color: getPerformanceColor(hod.averageScore) }}
                >
                  {hod.averageScore || 'N/A'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">📅 Last Evaluated:</span>
                <span className="detail-value">{hod.lastEvaluated || 'Never'}</span>
              </div>
            </div>

            <div className="hod-actions">
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => handleOpenEvaluateModal(hod)}
              >
                ✅ Evaluate HOD
              </button>
              <button className="btn btn-outline btn-sm">
                📄 View History
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredHods.length === 0 && hods.length > 0 && (
        <div className="no-results">
          <div className="no-results-icon">🔍</div>
          <h3>No HODs found</h3>
          <p>Try adjusting your search criteria or filters.</p>
        </div>
      )}

      {/* Evaluate HOD Modal */}
      {showEvaluateModal && selectedHod && (
        <div className="modal-overlay" onClick={() => setShowEvaluateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Evaluate HOD: {selectedHod.name}</h3>
              <button 
                className="modal-close"
                onClick={() => setShowEvaluateModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleEvaluate} className="modal-form">
              <div className="form-group">
                <label htmlFor="kpi-select" className="form-label">Select KPI *</label>
                <select
                  id="kpi-select"
                  value={evaluationForm.kpiId}
                  onChange={(e) => setEvaluationForm({...evaluationForm, kpiId: e.target.value})}
                  className="form-select"
                  required
                >
                  <option value="">-- Select a KPI --</option>
                  {availableKpis.map(kpi => (
                    <option key={kpi.id} value={kpi.id}>
                      {kpi.title} (Weight: {kpi.weight})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="academic-year" className="form-label">Academic Year *</label>
                  <input
                    type="text"
                    id="academic-year"
                    value={evaluationForm.academicYear}
                    onChange={(e) => setEvaluationForm({...evaluationForm, academicYear: e.target.value})}
                    className="form-input"
                    placeholder="2024"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="evaluation-period" className="form-label">Period *</label>
                  <select
                    id="evaluation-period"
                    value={evaluationForm.evaluationPeriod}
                    onChange={(e) => setEvaluationForm({...evaluationForm, evaluationPeriod: e.target.value})}
                    className="form-select"
                    required
                  >
                    <option value="Semester 1">Semester 1</option>
                    <option value="Semester 2">Semester 2</option>
                    <option value="Annual">Annual</option>
                  </select>
                </div>
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
                  placeholder="Enter evaluation comments and feedback..."
                />
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

export default DeanEvaluations;