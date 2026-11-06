import React, { useState, useEffect } from 'react';
import './KPIManagement.css';
import apiService from '../../utils/api';

const defaultForm = {
  id: '',
  title: '',
  description: '',
  weight: '',
  targetRole: 'Lecturer',
  areaId: '',
};

const KPIManagement = () => {
  const [tab, setTab] = useState('list');
  const [kpis, setKpis] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(defaultForm);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [kpiRes, areaRes] = await Promise.all([
        apiService.getKpis(),
        // Load areas for the current target role to make choices relevant
        apiService.getAreas(form.targetRole)
      ]);
      setKpis(Array.isArray(kpiRes) ? kpiRes : []);
      setAreas(Array.isArray(areaRes) ? areaRes : []);
      setError('');
    } catch (err) {
      setError('Failed to load KPIs or areas.');
    } finally {
      setLoading(false);
    }
  };

  // When targetRole changes, refresh areas relevant for that role and reset selected area
  useEffect(() => {
    const loadAreas = async () => {
      try {
        const areaRes = await apiService.getAreas(form.targetRole);
        setAreas(Array.isArray(areaRes) ? areaRes : []);
      } catch {}
    };
    loadAreas();
  }, [form.targetRole]);

  const handleInput = (field, value) => {
    // If Area is changed, auto-apply its weight and lock the weight field
    if (field === 'areaId') {
      const selected = areas.find(a => String(a.id) === String(value));
      if (selected) {
        setForm(f => ({ ...f, areaId: value, weight: selected.weight }));
      } else {
        setForm(f => ({ ...f, areaId: '', weight: f.weight }));
      }
      return;
    }
    setForm(f => ({ ...f, [field]: value }));
  };

  const openCreate = () => {
    setForm(defaultForm);
    setEditing(false);
    setTab('create');
  };

  const openEdit = (kpi) => {
    setForm({
      id: kpi.id,
      title: kpi.title || '',
      description: kpi.description || '',
      weight: kpi.weight || '',
      targetRole: kpi.targetRole || 'Lecturer',
      areaId: kpi.area?.id || kpi.areaId || ''
    });
    setEditing(true);
    setTab('edit');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Validate required fields
      if (!form.title || !form.weight || !form.targetRole) {
        setError('Title, weight, and target role are required.');
        setSubmitting(false);
        return;
      }
      // Ensure weight is a number between 0.01 and 1.0
      const payload = {
        ...form,
        weight: Number(form.weight),
        targetRole: form.targetRole,
        areaId: form.areaId ? Number(form.areaId) : null,
        // Backend still expects numeric Target; set to 0 by default since we now use description text only
        target: 0
      };

      if (isNaN(payload.weight) || payload.weight < 0.01 || payload.weight > 1.0) {
        setError('Weight must be a decimal between 0.01 and 1.0.');
        setSubmitting(false);
        return;
      }
      if (editing) {
        await apiService.updateKpi(form.id, payload);
      } else {
        await apiService.createKpi(payload);
      }
      await fetchData();
      setTab('list');
    } catch (err) {
      setError(err?.message || 'Failed to save KPI.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this KPI?')) return;
    try {
      await apiService.deleteKpi(id);
      await fetchData();
    } catch (err) {
      setError('Failed to delete KPI.');
    }
  };

  // Tab content
  let content;
  if (tab === 'list') {
    content = (
      <div className="tab-content">
        <div className="kpi-list-header">
          <button className="btn btn-primary" onClick={openCreate}>Create KPI</button>
        </div>
        {kpis.length === 0 ? (
          <div className="empty-message">No KPIs found. Create a new KPI to get started.</div>
        ) : (
          <table className="kpi-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Description</th>
                <th>Weight</th>
                <th>Area</th>
                <th>Target Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map(kpi => (
                <tr key={kpi.id}>
                  <td>{kpi.title}</td>
                  <td>{kpi.description}</td>
                  <td>{kpi.weight}</td>
                  <td>{kpi.area?.name || '-'}</td>
                  <td>{kpi.targetRole || 'Lecturer'}</td>
                  <td>
                    <button className="btn btn-outline" onClick={() => openEdit(kpi)}>Edit</button>
                    <button className="btn btn-danger" onClick={() => handleDelete(kpi.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  } else if (tab === 'create' || tab === 'edit') {
    content = (
      <div className="tab-content">
        <form className="kpi-form" onSubmit={handleSubmit}>
          {/* Target Role first */}
          <div className="form-group">
            <label>Target Role</label>
            <select value={form.targetRole} onChange={e => handleInput('targetRole', e.target.value)} required>
              <option value="Dean">Dean</option>
              <option value="HOD">HOD</option>
              <option value="Lecturer">Lecturer</option>
            </select>
            <small className="form-hint">Select which role this KPI is intended for to filter Areas</small>
          </div>

          <div className="form-group">
            <label>Title</label>
            <input value={form.title} onChange={e => handleInput('title', e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Target / Description</label>
            <textarea value={form.description} onChange={e => handleInput('description', e.target.value)} placeholder="Describe the outcome or target for this KPI" />
            <small className="form-hint">Provide the description of what should be achieved (used as the KPI target/description)</small>
          </div>
          <div className="form-group">
            <label>Area</label>
            <select value={form.areaId} onChange={e => handleInput('areaId', e.target.value)}>
              <option value="">-- None --</option>
              {areas.map(a => (
                <option key={a.id} value={a.id}>{a.name} (Weight: {a.weight})</option>
              ))}
            </select>
            <small className="form-hint">Select the Area this KPI belongs to (Areas carry the weight)</small>
          </div>
          {/* Hide weight when area is selected; otherwise allow manual entry for legacy KPIs */}
          {!form.areaId && (
            <div className="form-group">
              <label>Weight (0.01 - 1.0)</label>
              <input
                type="number"
                value={form.weight}
                onChange={e => handleInput('weight', e.target.value)}
                required
                min="0.01"
                max="1.0"
                step="0.01"
                placeholder="e.g. 0.5 for 50%"
              />
              <small className="form-hint">If no Area is selected, specify the KPI weight directly.</small>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setTab('list')}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : (editing ? 'Save Changes' : 'Create KPI')}</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="kpi-management-container">
      <div className="page-header">
        <h1>KPI Management</h1>
        <p>Manage Key Performance Indicators for departments</p>
      </div>
      <div className="tab-navigation">
        <button className={`tab-btn${tab === 'list' ? ' active' : ''}`} onClick={() => setTab('list')}>All KPIs</button>
        <button className={`tab-btn${tab === 'create' ? ' active' : ''}`} onClick={openCreate}>Create KPI</button>
      </div>
      {loading ? <div className="loading">Loading...</div> : content}
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default KPIManagement;