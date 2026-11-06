import React, { useState, useEffect } from 'react';
import './UserList.css';
import apiService from '../../utils/api';

const defaultForm = {
  id: '',
  fullName: '',
  title: '',
  email: '',
  password: '',
  departmentId: '',
  roles: []
};

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 9;
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState(['Admin','HOD','Dean','Lecturer']);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState({ roles: [], departmentId: null });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ show: false, userId: null });

  // Fetch users, departments, and current user
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [uRes, dRes, meRes] = await Promise.allSettled([
          apiService.getAllUsers(),
          apiService.getDepartments(),
          apiService.getCurrentUser()
        ]);

        if (uRes.status === 'fulfilled' && Array.isArray(uRes.value)) {
          setUsers(uRes.value.map(normalizeUser));
        } else setUsers([]);

        if (dRes.status === 'fulfilled' && Array.isArray(dRes.value)) setDepartments(dRes.value);
        else setDepartments([]);

        if (meRes.status === 'fulfilled') setCurrentUser(meRes.value);

        setError('');
      } catch (err) {
        console.error('Error loading data', err);
        setError('Failed to load users. Try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  useEffect(() => {
    let list = users.slice();

    // HOD sees only lecturers in their department
    if (currentUser.roles.includes('HOD')) {
      list = list.filter(u => u.roles.includes('Lecturer') && u.departmentId === currentUser.departmentId);
    }

    if (selectedDepartment !== 'all') {
      list = list.filter(u => String(u.departmentId) === String(selectedDepartment));
    }

    if (selectedRole !== 'all') {
      list = list.filter(u => u.roles.includes(selectedRole));
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
    setCurrentPage(1);
  }, [users, searchTerm, selectedDepartment, selectedRole, currentUser]);

  function normalizeUser(u) {
    return {
      id: u.id || u.userId || u._id || '',
      fullName: u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim(),
      title: u.title || '',
      email: u.email || '',
      department: u.department?.name || u.departmentName || u.department || 'Unassigned',
      departmentId: u.departmentId ?? u.department?.id ?? null,
      roles: Array.isArray(u.roles) ? u.roles : (u.role ? [u.role] : []),
      createdAt: u.createdAt || u.createdOn || null,
      phone: u.phone || 'N/A'
    };
  }

  const openCreate = () => {
    const isHOD = currentUser.roles.includes('HOD');
    setForm({
      ...defaultForm,
      roles: isHOD ? ['Lecturer'] : [],
      departmentId: isHOD ? currentUser.departmentId : ''
    });
    setShowCreateModal(true);
  };

  const openEdit = (u) => {
    setEditingUser(u);
    const isHOD = currentUser.roles.includes('HOD');
    setForm({
      id: u.id,
      fullName: u.fullName || '',
      title: u.title || '',
      email: u.email || '',
      password: '',
      departmentId: isHOD ? currentUser.departmentId : u.departmentId || '',
      roles: isHOD ? ['Lecturer'] : u.roles
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

  const handleInput = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleRoleToggle = (roleName) => {
    if (currentUser.roles.includes('HOD')) return; // HOD cannot change roles
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

      const payload = {
        fullName: form.fullName,
        title: form.title || null,
        email: form.email,
        password: form.password,
        departmentId: form.departmentId || null,
        roles: form.roles || []
      };
      await apiService.createUser(payload);
      // Backend returns only a message; refresh full list to include the new user
      try {
        const list = await apiService.getAllUsers();
        setUsers(Array.isArray(list) ? list.map(normalizeUser) : []);
      } catch (_) {}
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
        title: form.title || null,
        email: form.email,
        departmentId: form.departmentId || null,
        roles: form.roles || []
      };
      if (form.password) payload.password = form.password;

      // Update basic fields (name/title/email/department)
      await apiService.updateUser(form.id, payload);

      // Update roles separately (Admin only)
      if (currentUser.roles.includes('Admin')) {
        try {
          await apiService.updateUserRoles(form.id, form.roles || []);
        } catch (e) {
          console.error('Failed to update roles', e);
        }
      }

      // Fetch the latest user payload and update state
      try {
        const fresh = await apiService.getUser(form.id);
        setUsers(prev => prev.map(u => (u.id === form.id ? normalizeUser(fresh) : u)));
      } catch (e) {
        console.warn('Failed to fetch updated user; performing partial local update');
        setUsers(prev => prev.map(u => (
          u.id === form.id ? {
            ...u,
            fullName: form.fullName,
            title: form.title || '',
            email: form.email,
            departmentId: form.departmentId || u.departmentId,
            roles: form.roles || u.roles
          } : u
        )));
      }
      closeModals();
    } catch (err) {
      console.error('Edit user failed', err);
      alert(err?.message || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const triggerDelete = (userId) => setConfirmDelete({ show: true, userId });
  const cancelDelete = () => setConfirmDelete({ show: false, userId: null });

  const confirmDeleteUser = async () => {
    try {
      await apiService.deleteUser(confirmDelete.userId);
      setUsers(prev => prev.filter(u => u.id !== confirmDelete.userId));
      cancelDelete();
    } catch (err) {
      alert('Failed to delete user');
    }
  };

  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);

  return (
    <div className="user-list-container">
      <div className="page-header">
        <h1>Users</h1>
        <p>Manage users, assign roles and departments</p>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />

        {!currentUser.roles.includes('HOD') && (
          <>
            <select value={selectedDepartment} onChange={e => setSelectedDepartment(e.target.value)}>
              <option value="all">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}>
              <option value="all">All Roles</option>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </>
        )}

        <button className="btn btn-primary" onClick={openCreate}>Create User</button>
      </div>

      <div className="users-grid">
        {paginatedUsers.map(u => (
          <div key={u.id} className="user-card">
            <div className="user-info">
              <h3>{u.title ? `${u.title} ` : ''}{u.fullName}</h3>
              <p>{u.email}</p>
              <p>{u.department}</p>
              <div className="role-list">
                {u.roles.map(r => <span key={r} className="role-chip">{r}</span>)}
              </div>
            </div>
            <div className="user-actions">
              <button className="btn btn-outline" onClick={() => openEdit(u)}>Edit</button>
              <button className="btn btn-danger" onClick={() => triggerDelete(u.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="pagination">
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i + 1}
            className={`page-btn${currentPage === i + 1 ? ' active' : ''}`}
            onClick={() => setCurrentPage(i + 1)}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Create/Edit/Delete Modals (same as previous, department select disabled for HOD) */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>Create User</h3>
              <button className="modal-close" onClick={closeModals}>&times;</button>
            </div>
            <form className="modal-form" onSubmit={submitCreate}>
              <div className="form-group">
                <label>Full Name</label>
                <input className="form-input" value={form.fullName} onChange={e => handleInput('fullName', e.target.value)} required/>
              </div>
              <div className="form-group">
                <label>Title (optional)</label>
                <select className="form-input" value={form.title} onChange={e => handleInput('title', e.target.value)}>
                  <option value="">Select title</option>
                  <option value="Prof.">Prof.</option>
                  <option value="Dr.">Dr.</option>
                  <option value="Mr.">Mr.</option>
                  <option value="Mrs.">Mrs.</option>
                  <option value="Ms.">Ms.</option>
                </select>
              </div>

              {/* Move Department and Roles up for visibility */}
              <div className="form-group">
                <label>Department</label>
                <select
                  className="form-input"
                  value={form.departmentId}
                  onChange={e => handleInput('departmentId', e.target.value)}
                  disabled={currentUser.roles.includes('HOD')}
                >
                  {!currentUser.roles.includes('HOD') && <option value="">Select Department</option>}
                  {departments.length === 0 && <option value="" disabled>No departments found</option>}
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Role</label>
                <div className="roles-checkboxes">
                  {roles.map(r => {
                    const isHod = currentUser.roles.includes('HOD');
                    return (
                      <label key={r} className={isHod ? 'fixed' : ''}>
                        <input
                          type="radio"
                          name="create-role"
                          checked={(form.roles[0] || '') === r}
                          onChange={() => handleInput('roles', [r])}
                          disabled={isHod}
                        />
                        {r}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label>Email</label>
                <input className="form-input" value={form.email} onChange={e => handleInput('email', e.target.value)} required/>
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" className="form-input" value={form.password} onChange={e => handleInput('password', e.target.value)} required minLength={6}/>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModals}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>Edit User</h3>
              <button className="modal-close" onClick={closeModals}>&times;</button>
            </div>
            <form className="modal-form" onSubmit={submitEdit}>
              <div className="form-group">
                <label>Full Name</label>
                <input className="form-input" value={form.fullName} onChange={e => handleInput('fullName', e.target.value)} required/>
              </div>
              <div className="form-group">
                <label>Title (optional)</label>
                <select className="form-input" value={form.title} onChange={e => handleInput('title', e.target.value)}>
                  <option value="">Select title</option>
                  <option value="Mr.">Mr.</option>
                  <option value="Mrs.">Mrs.</option>
                  <option value="Dr.">Dr.</option>
                  <option value="Prof.">Prof.</option>
                  <option value="Ms.">Ms.</option>
                </select>
              </div>

              {/* Move Department and Roles up for visibility */}
              <div className="form-group">
                <label>Department</label>
                <select
                  className="form-input"
                  value={form.departmentId}
                  onChange={e => handleInput('departmentId', e.target.value)}
                  disabled={currentUser.roles.includes('HOD')}
                >
                  {!currentUser.roles.includes('HOD') && <option value="">Select Department</option>}
                  {departments.length === 0 && <option value="" disabled>No departments found</option>}
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Role</label>
                <div className="roles-checkboxes">
                  {roles.map(r => {
                    const isHod = currentUser.roles.includes('HOD');
                    return (
                      <label key={r} className={isHod ? 'fixed' : ''}>
                        <input
                          type="radio"
                          name="edit-role"
                          checked={(form.roles[0] || '') === r}
                          onChange={() => handleInput('roles', [r])}
                          disabled={isHod}
                        />
                        {r}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label>Email</label>
                <input className="form-input" value={form.email} onChange={e => handleInput('email', e.target.value)} required/>
              </div>
              <div className="form-group">
                <label>Password (leave blank to keep unchanged)</label>
                <input type="password" className="form-input" value={form.password} onChange={e => handleInput('password', e.target.value)} minLength={6} />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModals}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete.show && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>Confirm Delete</h3>
            </div>
            <div className="modal-body">
              Are you sure you want to delete this user?
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={cancelDelete}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDeleteUser}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserList;
