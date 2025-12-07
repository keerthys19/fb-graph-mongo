import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/LoginPage.css';

const LoginPage = () => {
  const { login } = useAuth();

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo">📱</div>
          <h1>Facebook Lead Manager</h1>
          <p className="subtitle">Automate your Facebook & Instagram lead collection</p>
        </div>

        <div className="features">
          <div className="feature">
            <span className="feature-icon">⚡</span>
            <div>
              <h3>Real-time Lead Capture</h3>
              <p>Automatically receive leads from Facebook and Instagram</p>
            </div>
          </div>
          <div className="feature">
            <span className="feature-icon">📊</span>
            <div>
              <h3>Centralized Dashboard</h3>
              <p>View and manage all your leads in one place</p>
            </div>
          </div>
          <div className="feature">
            <span className="feature-icon">🔒</span>
            <div>
              <h3>Secure Authentication</h3>
              <p>Connect safely with your Facebook account</p>
            </div>
          </div>
        </div>

        <button className="facebook-login-btn" onClick={login}>
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="white" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          Continue with Facebook
        </button>

        <p className="privacy-notice">
          By continuing, you agree to share your Facebook page information<br/>
          We'll only access pages you manage and their lead forms
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
