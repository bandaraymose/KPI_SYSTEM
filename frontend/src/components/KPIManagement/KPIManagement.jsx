
import React, { useState, useEffect } from 'react';
import './KPIManagement.css';
import apiService from '../../utils/api';

const defaultForm = {
  id: '',
  name: '',
  description: '',
  weight: '',
  departmentId: ''
};

const KPIManagement = () => {
  const [tab, setTab] = useState('list');
  const [kpis, setKpis] = useState([]);
  const [departments, setDepartments] = useState([]);
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
      const [kpiRes, deptRes] = await Promise.all([
        apiService.getKpis(),
        apiService.getDepartments()
      ]);
      setKpis(Array.isArray(kpiRes) ? kpiRes : []);
      setDepartments(Array.isArray(deptRes) ? deptRes : []);
      setError('');
    } catch (err) {
      setError('Failed to load KPIs or departments.');
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (field, value) => {
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
      name: kpi.name || '',
      description: kpi.description || '',
      weight: kpi.weight || '',
      departmentId: kpi.departmentId || ''
    });
    setEditing(true);
    setTab('edit');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        await apiService.updateKpi(form.id, form);
      } else {
        await apiService.createKpi(form);
      }
      await fetchData();
      setTab('list');
    } catch (err) {
      setError('Failed to save KPI.');
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
                <th>Name</th>
                <th>Description</th>
                <th>Weight</th>
                <th>Department</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map(kpi => (
                <tr key={kpi.id}>
                  <td>{kpi.name}</td>
                  <td>{kpi.description}</td>
                  <td>{kpi.weight}</td>
                  <td>{departments.find(d => d.id === kpi.departmentId)?.name || 'N/A'}</td>
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
          <div className="form-group">
            <label>Name</label>
            <input value={form.name} onChange={e => handleInput('name', e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={form.description} onChange={e => handleInput('description', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Weight</label>
            <input type="number" value={form.weight} onChange={e => handleInput('weight', e.target.value)} required min="0" max="100" />
          </div>
          <div className="form-group">
            <label>Department</label>
            <select value={form.departmentId} onChange={e => handleInput('departmentId', e.target.value)} required>
              <option value="">Select Department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
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
