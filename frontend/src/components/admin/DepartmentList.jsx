// src/components/admin/DepartmentList.jsx
import React, { useState, useEffect } from 'react';
import apiService from '../../utils/api';
import './DepartmentList.css';

const defaultForm = { id: '', name: '', code: '', description: '' };

const DepartmentList = () => {
  const [departments, setDepartments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ show: false, id: null });

  // fetch
  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await apiService.getDepartments();
      setDepartments(res || []);
      setError('');
    } catch (err) {
      console.error('Failed to load departments', err);
      setError('Failed to load departments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const filtered = departments.filter(
    d =>
      d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // UI helpers
  const renderDepartments = () => {
    if (loading) return <div className="loading">Loading departments...</div>;
    if (error) return <div className="error-message">{error}</div>;
    if (filtered.length === 0) return <div className="empty-message">No departments found.</div>;
    // ...existing code to render department cards/table...
    return null; // placeholder, actual rendering code is below in the file
  };

  const handleInput = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const openCreate = () => {
    setForm(defaultForm);
    setShowCreateModal(true);
  };

  const openEdit = (dept) => {
    setEditingDept(dept);
    setForm({
      id: dept.id,
      name: dept.name || '',
      code: dept.code || '',
      description: dept.description || ''
    });
    setShowEditModal(true);
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditingDept(null);
    setForm(defaultForm);
    setSubmitting(false);
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiService.createDepartment(form);
      await fetchDepartments();
      closeModals();
    } catch (err) {
      console.error('Create failed', err);
      alert(err?.message || 'Failed to create department');
    } finally {
      setSubmitting(false);
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiService.updateDepartment(form.id, form);
      await fetchDepartments();
      closeModals();
    } catch (err) {
      console.error('Update failed', err);
      alert(err?.message || 'Failed to update department');
    } finally {
      setSubmitting(false);
    }
  };

  const triggerDelete = (id) => setConfirmDelete({ show: true, id });
  const cancelDelete = () => setConfirmDelete({ show: false, id: null });
  const confirmDeleteDept = async () => {
    try {
      await apiService.deleteDepartment(confirmDelete.id);
      await fetchDepartments();
      cancelDelete();
    } catch (err) {
      console.error('Delete failed', err);
      alert(err?.message || 'Failed to delete department');
    }
  };

  if (loading) {
    return <div className="department-list-container"><div className="loading">Loading departments...</div></div>;
  }

  return (
    <div className="department-list-container">
      <div className="page-header">
        <div className="header-content">
          <h1>Departments</h1>
          <p>Manage departments, assign codes and descriptions</p>
        </div>
        <div className="header-stats">
          <div className="stat-item">
            <span className="stat-number">{departments.length}</span>
            <span className="stat-label">Total Departments</span>
          </div>
        </div>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search departments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-controls">
          <button className="btn btn-primary" onClick={openCreate}>Create Department</button>
        </div>
      </div>

      <div className="results-summary">
        <p>Showing {filtered.length} of {departments.length} departments</p>
      </div>

      <div className="departments-grid">
        {filtered.map(d => (
          <div key={d.id} className="department-card">
            <div className="department-header">
              <h3>{d.name}</h3>
              <div className="dept-actions">
                <button className="btn btn-outline" onClick={() => openEdit(d)}>Edit</button>
                <button className="btn btn-secondary" onClick={() => triggerDelete(d.id)}>Delete</button>
              </div>
            </div>
            <p className="muted">{d.code}</p>
            <p>{d.description}</p>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Department</h3>
              <button className="modal-close" onClick={closeModals}>×</button>
            </div>
            <form className="modal-form" onSubmit={submitCreate}>
              <div className="form-group">
                <label>Name</label>
                <input value={form.name} onChange={(e)=>handleInput('name', e.target.value)} className="form-input" required/>
              </div>
              <div className="form-group">
                <label>Code</label>
                <input value={form.code} onChange={(e)=>handleInput('code', e.target.value)} className="form-input" required/>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={form.description} onChange={(e)=>handleInput('description', e.target.value)} className="form-input"/>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModals}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal" onClick={(e)=>e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Department</h3>
              <button className="modal-close" onClick={closeModals}>×</button>
            </div>
            <form className="modal-form" onSubmit={submitEdit}>
              <div className="form-group">
                <label>Name</label>
                <input value={form.name} onChange={(e)=>handleInput('name', e.target.value)} className="form-input" required/>
              </div>
              <div className="form-group">
                <label>Code</label>
                <input value={form.code} onChange={(e)=>handleInput('code', e.target.value)} className="form-input" required/>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={form.description} onChange={(e)=>handleInput('description', e.target.value)} className="form-input"/>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModals}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete.show && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal" onClick={(e)=>e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button className="modal-close" onClick={cancelDelete}>×</button>
            </div>
            <div className="modal-form">
              <p>Are you sure you want to delete this department? This action cannot be undone.</p>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={cancelDelete}>Cancel</button>
                <button className="btn btn-danger" onClick={confirmDeleteDept}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default DepartmentList;
