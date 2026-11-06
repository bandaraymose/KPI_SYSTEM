import React, { useEffect, useState } from 'react';
import apiService from '../../utils/api';
import './Profile.css';

const Profile = ({ user }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); // general (loading) error at top of page

  // Email change
  const [newEmail, setNewEmail] = useState('');
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('');
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const me = await apiService.getProfile();
        setProfile(me);
        setNewEmail(me.email || '');
      } catch (err) {
        console.error('Failed to load profile', err);
        setError(err?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setSavingEmail(true);
    setError('');
    setEmailError('');
    setEmailSuccess('');
    try {
      await apiService.updateMyEmail(newEmail, currentPasswordForEmail);
      // refresh currentUser cache
      const me = await apiService.getProfile();
      setProfile(me);
      // update app's localStorage currentUser name/email if email changed
      const cur = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const updated = { ...cur, username: me.email, email: me.email };
      localStorage.setItem('currentUser', JSON.stringify(updated));
      setEmailSuccess('Email updated successfully');
      setCurrentPasswordForEmail('');
    } catch (err) {
      console.error('Update email error', err);
      // Map common auth errors to friendlier messages
      if (err?.status === 400 || err?.status === 401) {
        setEmailError('Incorrect current password');
      } else {
        setEmailError(err?.message || 'Failed to update email');
      }
    } finally {
      setSavingEmail(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSavingPassword(true);
    setError('');
    setPasswordError('');
    setPasswordSuccess('');
    try {
      if ((newPassword || '').length < 6) {
        setPasswordError('Password must be at least 6 characters');
        setSavingPassword(false);
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setPasswordError('New passwords do not match');
        setSavingPassword(false);
        return;
      }
      await apiService.changeMyPassword(currentPassword, newPassword);
      setPasswordSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      console.error('Change password error', err);
      if (err?.status === 400 || err?.status === 401) {
        setPasswordError('Incorrect current password');
      } else {
        setPasswordError(err?.message || 'Failed to change password');
      }
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return <div className="profile-container"><div className="loading">Loading profile...</div></div>;
  }

  // Do not replace the whole page on error; show a banner instead

  return (
    <div className="profile-container">
      {error ? <div className="error-message" style={{ marginBottom: '12px' }}>{error}</div> : null}
      <div className="page-header">
        <h1>My Profile</h1>
        <p>Manage your account information</p>
      </div>

      <div className="profile-card">
        <div className="profile-row">
          <div className="profile-avatar">{(profile?.fullName || 'U N').split(' ').map(n => n[0]).join('').toUpperCase()}</div>
          <div className="profile-details">
            <div className="profile-name">{profile?.title ? `${profile.title} ` : ''}{profile?.fullName}</div>
            <div className="profile-meta">
              <span className="chip">{(profile?.roles || [])[0] || 'User'}</span>
              {profile?.departmentId ? <span className="chip">Dept #{profile.departmentId}</span> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <h3>Update Email</h3>
          <form onSubmit={handleUpdateEmail}>
            {emailError ? <div className="error-message">{emailError}</div> : null}
            {emailSuccess ? <div className="success-message">{emailSuccess}</div> : null}
            <div className="form-group">
              <label>New Email</label>
              <input className="form-input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Current Password</label>
              <div className="password-input">
                <input className="form-input" type={showEmailPassword ? 'text' : 'password'} value={currentPasswordForEmail} onChange={e => setCurrentPasswordForEmail(e.target.value)} required />
                <button type="button" className="toggle-visibility" onClick={() => setShowEmailPassword(v => !v)}>{showEmailPassword ? 'Hide' : 'Show'}</button>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={savingEmail}>{savingEmail ? 'Saving...' : 'Save Email'}</button>
            </div>
          </form>
        </div>

        <div className="card">
          <h3>Change Password</h3>
          <form onSubmit={handleChangePassword}>
            {passwordError ? <div className="error-message">{passwordError}</div> : null}
            {passwordSuccess ? <div className="success-message">{passwordSuccess}</div> : null}
            <div className="form-group">
              <label>Current Password</label>
              <div className="password-input">
                <input className="form-input" type={showCurrentPassword ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
                <button type="button" className="toggle-visibility" onClick={() => setShowCurrentPassword(v => !v)}>{showCurrentPassword ? 'Hide' : 'Show'}</button>
              </div>
            </div>
            <div className="form-group">
              <label>New Password</label>
              <div className="password-input">
                <input className="form-input" type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
                <button type="button" className="toggle-visibility" onClick={() => setShowNewPassword(v => !v)}>{showNewPassword ? 'Hide' : 'Show'}</button>
              </div>
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <div className="password-input">
                <input className="form-input" type={showConfirmNewPassword ? 'text' : 'password'} value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required minLength={6} />
                <button type="button" className="toggle-visibility" onClick={() => setShowConfirmNewPassword(v => !v)}>{showConfirmNewPassword ? 'Hide' : 'Show'}</button>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={savingPassword}>{savingPassword ? 'Saving...' : 'Change Password'}</button>
            </div>
          </form>
        </div>
      </div>

      {/* Self-evaluation moved to Workplan > My KPIs */}
    </div>
  );
};

export default Profile;
