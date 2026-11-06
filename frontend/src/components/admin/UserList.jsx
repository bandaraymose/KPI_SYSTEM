// src/components/admin/UserList.jsx
import React, { useState, useEffect } from 'react';
import apiService from '../../utils/api';
import './UserList.css';

const defaultForm = {
  id: '',
  fullName: '',
  email: '',
  password: '',
  departmentId: '',
  roles: [] // e.g. ["Lecturer"]
};

const UserList = ({ user }) => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 9;
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState(['Admin','HOD','Dean','Lecturer']); // fallback
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ show: false, userId: null });

  // fetch users & departments
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [uRes, dRes, rolesRes] = await Promise.allSettled([
          apiService.getAllUsers(),       // -> expected array of users
          apiService.getDepartments(),    // -> expected array of departments
          apiService.getAllRoles?.()      // optional: if apiService exposes roles
        ]);

        if (uRes.status === 'fulfilled' && Array.isArray(uRes.value)) {
          setUsers(uRes.value.map(normalizeUser));
        } else {
          setUsers([]);
        }

        if (dRes.status === 'fulfilled' && Array.isArray(dRes.value)) {
          setDepartments(dRes.value);
        } else {
          setDepartments([]);
        }

        if (rolesRes && rolesRes.status === 'fulfilled' && Array.isArray(rolesRes.value)) {
          setRoles(rolesRes.value);
        }

        setError('');
      } catch (err) {
        console.error('Error loading users/departments', err);
        setError('Failed to load users. Try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, []);

  useEffect(() => {
    // filter & search
    let list = users.slice();

    if (selectedDepartment !== 'all') {
      list = list.filter(u => String(u.departmentId) === String(selectedDepartment));
    }

    if (selectedRole !== 'all') {
      list = list.filter(u => (u.roles || []).includes(selectedRole));
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(u =>
        (u.fullName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q)
      );
    }

    setFilteredUsers(list);
    setCurrentPage(1); // Reset to first page on filter change
  }, [users, searchTerm, selectedDepartment, selectedRole]);

  // normalize API user -> UI model
  function normalizeUser(u) {
    return {
      id: u.id || u.userId || u._id || '',
      fullName: u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim(),
      email: u.email || '',
      department: u.department?.name || u.departmentName || u.department || 'Unassigned',
      departmentId: u.departmentId ?? u.department?.id ?? null,
      roles: Array.isArray(u.roles) ? u.roles : (u.role ? [u.role] : []),
      createdAt: u.createdAt || u.createdOn || null,
      phone: u.phone || 'N/A'
    };
  }

  // handlers
  const openCreate = () => {
    setForm(defaultForm);
    setShowCreateModal(true);
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setForm({
      id: u.id,
      fullName: u.fullName || '',
      email: u.email || '',
      password: '', // leave blank unless changing
      departmentId: u.departmentId || '',
      roles: u.roles || []
    });
    setShowEditModal(true);
  };

  const closeModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditingUser(null);
    setForm(defaultForm);
    setSubmitting(false);
  };

  const handleInput = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleRoleToggle = (roleName) => {
    setForm(prev => {
      const cur = new Set(prev.roles || []);
      if (cur.has(roleName)) cur.delete(roleName); else cur.add(roleName);
      return { ...prev, roles: Array.from(cur) };
    });
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Basic client validation
      if (!form.fullName || !form.email || !form.password) {
        alert('Full name, email and password are required.');
        setSubmitting(false);
        return;
      }
      if ((form.password || '').length < 6) {
        alert('Password must be at least 6 characters');
        setSubmitting(false);
        return;
      }

      // call API
      const payload = {
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        departmentId: form.departmentId || null,
        roles: form.roles || []
      };
      const res = await apiService.createUser(payload); // expected to return created user
      // add to UI
      setUsers(prev => [normalizeUser(res), ...prev]);
      closeModals();
    } catch (err) {
      console.error('Create user failed', err);
      alert(err?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (!form.id) throw new Error('No user selected');
      if (form.password && form.password.length < 6) {
        alert('New password must be at least 6 characters');
        setSubmitting(false);
        return;
      }
      const payload = {
        fullName: form.fullName,
        email: form.email,
        departmentId: form.departmentId || null,
        roles: form.roles || []
      };
      // include password only if provided
      if (form.password) payload.password = form.password;

      const res = await apiService.updateUser(form.id, payload); // expected updated user
      setUsers(prev => prev.map(u => (u.id === form.id ? normalizeUser(res) : u)));
      closeModals();
    } catch (err) {
      console.error('Update failed', err);
      alert(err?.message || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const triggerDelete = (userId) => {
    setConfirmDelete({ show: true, userId });
  };

  const cancelDelete = () => setConfirmDelete({ show: false, userId: null });

  const confirmDeleteUser = async () => {
    if (!confirmDelete.userId) return;
    try {
      await apiService.deleteUser(confirmDelete.userId);
      setUsers(prev => prev.filter(u => u.id !== confirmDelete.userId));
      cancelDelete();
    } catch (err) {
      console.error('Delete failed', err);
      alert(err?.message || 'Failed to delete user');
    }
  };

  // small helpers
  const deptOptions = [{ id: 'all', name: 'All Departments' }, ...departments];
  const roleOptions = ['all', ...roles];

  // Pagination logic
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);

  if (loading) {
    return <div className="user-list-container"><div className="loading">Loading users...</div></div>;
  }

  return (
    <div className="user-list-container">
      <div className="page-header">
        <div className="header-content">
          <h1>User Management</h1>
          <p>Manage users, assign roles and departments</p>
        </div>
        <div className="header-stats">
          <div className="stat-item">
            <span className="stat-number">{users.length}</span>
            <span className="stat-label">Total Users</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{users.filter(u => (u.roles || []).includes('Lecturer')).length}</span>
            <span className="stat-label">Lecturers</span>
          </div>
        </div>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-controls">
          <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} className="filter-select">
            {deptOptions.map(d => <option key={d.id} value={d.id}>{d.name || d}</option>)}
          </select>

          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="filter-select">
            {roleOptions.map(r => <option key={r} value={r}>{r === 'all' ? 'All Roles' : r}</option>)}
          </select>

          <button className="btn btn-primary" onClick={openCreate}>Create User</button>
        </div>
      </div>

      <div className="results-summary">
        <p>Showing {filteredUsers.length} of {users.length} users</p>
      </div>

      <div className="users-grid">
        {paginatedUsers.map(u => (
          <div key={u.id} className="user-card">
            <div className="user-header">
              <div className="user-avatar">{(u.fullName || 'U').split(' ').map(n=>n[0]).join('').toUpperCase()}</div>
              <div className="user-info">
                <h3>{u.fullName}</h3>
                <p className="muted">{u.email}</p>
                <p className="muted small">{u.department}</p>
              </div>
              <div className="user-actions">
                <button className="btn btn-outline" onClick={() => openEdit(u)}>Edit</button>
                <button className="btn btn-secondary" onClick={() => triggerDelete(u.id)}>Delete</button>
              </div>
            </div>

            <div className="user-body">
              <div className="role-list">
                {(u.roles || []).map(r => <span key={r} className="role-chip">{r}</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>&lt;</button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i + 1}
              className={`page-btn${currentPage === i + 1 ? ' active' : ''}`}
              onClick={() => setCurrentPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <button className="page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>&gt;</button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create User</h3>
              <button className="modal-close" onClick={closeModals}>×</button>
            </div>
            <form className="modal-form" onSubmit={submitCreate}>
              <div className="form-group">
                <label>Full Name</label>
                <input value={form.fullName} onChange={(e)=>handleInput('fullName', e.target.value)} className="form-input" required/>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e)=>handleInput('email', e.target.value)} className="form-input" required/>
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" value={form.password} onChange={(e)=>handleInput('password', e.target.value)} className="form-input" required minLength={6}/>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Department</label>
                  <select value={form.departmentId} onChange={(e)=>handleInput('departmentId', e.target.value)} className="form-select">
                    <option value="">Unassigned</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Roles</label>
                  <div className="roles-grid">
                    {roles.map(r => (
                      <label className="role-checkbox" key={r}>
                        <input type="checkbox" checked={(form.roles||[]).includes(r)} onChange={()=>handleRoleToggle(r)} />
                        {r}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModals}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Creating...' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit User</h3>
              <button className="modal-close" onClick={closeModals}>×</button>
            </div>
            <form className="modal-form" onSubmit={submitEdit}>
              <div className="form-group">
                <label>Full Name</label>
                <input value={form.fullName} onChange={(e)=>handleInput('fullName', e.target.value)} className="form-input" required/>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e)=>handleInput('email', e.target.value)} className="form-input" required/>
              </div>
              <div className="form-group">
                <label>New Password (leave blank to keep current)</label>
                <input type="password" value={form.password} onChange={(e)=>handleInput('password', e.target.value)} className="form-input" minLength={6} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Department</label>
                  <select value={form.departmentId} onChange={(e)=>handleInput('departmentId', e.target.value)} className="form-select">
                    <option value="">Unassigned</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Roles</label>
                  <div className="roles-grid">
                    {roles.map(r => (
                      <label className="role-checkbox" key={r}>
                        <input type="checkbox" checked={(form.roles||[]).includes(r)} onChange={()=>handleRoleToggle(r)} />
                        {r}
                      </label>
                    ))}
                  </div>
                </div>
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
              <p>Are you sure you want to delete this user? This action cannot be undone.</p>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={cancelDelete}>Cancel</button>
                <button className="btn btn-danger" onClick={confirmDeleteUser}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default UserList;
