import React, { useEffect, useState } from 'react';
import apiService from '../../utils/api';
import './Login.css';

const Login = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  const [isSignup, setIsSignup] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [signupData, setSignupData] = useState({
    title: '',
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    departmentId: ''
  });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const list = await apiService.getDepartments();
        setDepartments(list || []);
      } catch (err) {
        console.error('Failed to load departments for signup:', err);
      }
    };
    if (isSignup) fetchDepartments();
  }, [isSignup]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (isSignup) {
      setSignupData(prev => ({ ...prev, [name]: value }));
    } else {
      setCredentials(prev => ({ ...prev, [name]: value }));
    }
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignup) {
        if ((signupData.password || '').length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        if (signupData.password !== signupData.confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        const payload = {
          title: signupData.title || null,
          fullName: signupData.fullName,
          email: signupData.email,
          phone: signupData.phone || null,
          password: signupData.password,
          confirmPassword: signupData.confirmPassword,
          departmentId: signupData.departmentId ? Number(signupData.departmentId) : null
        };
        const response = await apiService.signup(payload);
        const { user } = response;
        const displayName = `${user.title ? user.title + ' ' : ''}${user.fullName}`;
        const userData = {
          id: user.id,
          username: user.email,
          email: user.email,
          name: displayName,
          role: user.roles?.[0]?.toLowerCase() || 'lecturer',
          roles: user.roles,
          departmentId: user.departmentId
        };
        onLogin(userData);
      } else {
        // Call real API login
        const response = await apiService.login(credentials.email, credentials.password);
        // API returns: { token, user: { id, email, fullName, title?, departmentId, roles } }
        const { user } = response;
        const displayName = `${user.title ? user.title + ' ' : ''}${user.fullName}`;
        // Transform API user data to match what your app expects
        const userData = {
          id: user.id,
          username: user.email,
          email: user.email,
          name: displayName,
          role: user.roles?.[0]?.toLowerCase() || 'lecturer', // Get first role
          roles: user.roles,
          departmentId: user.departmentId
        };
        // Call parent component's onLogin with user data
        onLogin(userData);
      }
    } catch (error) {
      console.error(isSignup ? 'Signup error:' : 'Login error:', error);
      if (!isSignup && (error?.status === 400 || error?.status === 401)) {
        setError('Incorrect email or password');
      } else {
        setError(error.message || (isSignup ? 'Signup failed. Please try again.' : 'Login failed. Please try again.'));
      }
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="university-logo">
          <div className="logo-placeholder">
            <img src="https://www.cbu.ac.zm/cbu-challenge/assets/img/CBU_Logo.png" alt="CBU LOGO"></img>
          </div>
        </div>
        
        <div className="login-card">
          <div className="login-header">
            <h1>KPI Management System</h1>
            <p>School of Information & Communications Technology</p>
            <p>The Copperbelt University</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && <div className="error-message">{error}</div>}

            {!isSignup && !showForgot && (
              <>
                <div className="form-group">
                  <label htmlFor="email" className="form-label">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={credentials.email}
                    onChange={handleInputChange}
                    className="form-input"
                    required
                    placeholder="Enter your email"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password" className="form-label">Password</label>
                  <div className="password-input">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={credentials.password}
                      onChange={handleInputChange}
                      className="form-input"
                      required
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      className="toggle-visibility"
                      onClick={() => setShowLoginPassword(v => !v)}
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    >
                      {showLoginPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary login-btn"
                  disabled={loading}
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </button>

                <div className="form-footer" style={{ marginTop: '8px', textAlign: 'center' }}>
                  <button type="button" className="link-button" onClick={() => { setShowForgot(true); setError(''); }}>
                    Forgot password?
                  </button>
                </div>
              </>
            )}

            {isSignup && !showForgot && (
              <>
                <div className="form-group">
                  <label htmlFor="title" className="form-label">Title</label>
                  <select id="title" name="title" className="form-input" value={signupData.title} onChange={handleInputChange}>
                    <option value="">Select title (Optional)</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Dr.">Dr.</option>
                    <option value="Prof.">Prof.</option>
                    <option value="Ms.">Ms.</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="fullName" className="form-label">Full Name</label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={signupData.fullName}
                    onChange={handleInputChange}
                    className="form-input"
                    required
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email" className="form-label">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={signupData.email}
                    onChange={handleInputChange}
                    className="form-input"
                    required
                    placeholder="Enter your email"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="phone" className="form-label">Phone (Optional)</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={signupData.phone}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="Enter your phone number"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="departmentId" className="form-label">Department</label>
                  <select
                    id="departmentId"
                    name="departmentId"
                    className="form-input"
                    value={signupData.departmentId}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select a department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="password" className="form-label">Password</label>
                  <div className="password-input">
                    <input
                      type={showSignupPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={signupData.password}
                      onChange={handleInputChange}
                      className="form-input"
                      required
                      minLength={6}
                      placeholder="Create a password"
                    />
                    <button
                      type="button"
                      className="toggle-visibility"
                      onClick={() => setShowSignupPassword(v => !v)}
                      aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                    >
                      {showSignupPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
                  <div className="password-input">
                    <input
                      type={showSignupConfirm ? 'text' : 'password'}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={signupData.confirmPassword}
                      onChange={handleInputChange}
                      className="form-input"
                      required
                      minLength={6}
                      placeholder="Confirm your password"
                    />
                    <button
                      type="button"
                      className="toggle-visibility"
                      onClick={() => setShowSignupConfirm(v => !v)}
                      aria-label={showSignupConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showSignupConfirm ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary login-btn"
                  disabled={loading}
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </>
            )}

            {showForgot && (
              <div className="forgot-container" style={{ textAlign: 'center', padding: '16px 0' }}>
                <div className="info-message" style={{ marginBottom: '12px' }}>
                  Please contact your Supervisor or system administrator to reset your password.
                </div>
                <button type="button" className="btn" onClick={() => setShowForgot(false)}>
                  Back to {isSignup ? 'Create Account' : 'Sign In'}
                </button>
              </div>
            )}

            {!showForgot && (
              <div className="form-footer" style={{ marginTop: '12px', textAlign: 'center' }}>
                {!isSignup ? (
                  <span>
                    Don't have an account?{' '}
                    <button type="button" className="link-button" onClick={() => { setIsSignup(true); setError(''); }}>
                      Create one
                    </button>
                  </span>
                ) : (
                  <span>
                    Already have an account?{' '}
                    <button type="button" className="link-button" onClick={() => { setIsSignup(false); setError(''); }}>
                      Sign in
                    </button>
                  </span>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;