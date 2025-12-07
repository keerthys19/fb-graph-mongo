import React, { useState, useEffect } from 'react';
import apiService from '../services/api';
import '../styles/OnboardingFlow.css';

const OnboardingFlow = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [pages, setPages] = useState([]);
  const [selectedPages, setSelectedPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [connectedCount, setConnectedCount] = useState(0);

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    try {
      setLoading(true);
      const data = await apiService.getUserPages();
      setPages(data.pages || []);
    } catch (error) {
      setError('Failed to load your pages. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const togglePageSelection = (pageId) => {
    setSelectedPages(prev => {
      if (prev.includes(pageId)) {
        return prev.filter(id => id !== pageId);
      } else {
        return [...prev, pageId];
      }
    });
  };

  const handleConnect = async () => {
    if (selectedPages.length === 0) {
      setError('Please select at least one page');
      return;
    }

    setConnecting(true);
    setError(null);
    setConnectedCount(0);

    try {
      for (const pageId of selectedPages) {
        await apiService.connectPage(pageId);
        setConnectedCount(prev => prev + 1);
      }
      setCurrentStep(3);
    } catch (error) {
      setError('Failed to connect pages. Please try again.');
      console.error(error);
    } finally {
      setConnecting(false);
    }
  };

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  if (loading) {
    return (
      <div className="onboarding-container">
        <div className="loading">Loading your pages...</div>
      </div>
    );
  }

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        {/* Progress Steps */}
        <div className="progress-steps">
          <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>
            <div className="step-number">1</div>
            <div className="step-label">Welcome</div>
          </div>
          <div className="step-line"></div>
          <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">Select Pages</div>
          </div>
          <div className="step-line"></div>
          <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <div className="step-label">Complete</div>
          </div>
        </div>

        {/* Step Content */}
        {currentStep === 1 && (
          <div className="step-content">
            <h2>🎉 Welcome!</h2>
            <p className="welcome-text">
              You've successfully connected your Facebook account. 
              Now let's set up your pages to start collecting leads automatically.
            </p>
            <div className="info-box">
              <h3>What happens next?</h3>
              <ul>
                <li>Select the Facebook pages you want to connect</li>
                <li>We'll automatically subscribe them to receive lead notifications</li>
                <li>Start seeing your leads in real-time on the dashboard</li>
              </ul>
            </div>
            <button className="primary-btn" onClick={nextStep}>
              Get Started
            </button>
          </div>
        )}

        {currentStep === 2 && (
          <div className="step-content">
            <h2>Select Your Pages</h2>
            <p className="step-description">
              Choose which Facebook pages you want to connect for lead collection.
            </p>

            {error && <div className="error-message">{error}</div>}

            {pages.length === 0 ? (
              <div className="no-pages">
                <p>No pages found. Make sure you're an admin of at least one Facebook page.</p>
              </div>
            ) : (
              <div className="pages-grid">
                {pages.map(page => (
                  <div
                    key={page.pageId}
                    className={`page-card ${selectedPages.includes(page.pageId) ? 'selected' : ''} ${page.isSubscribed ? 'already-connected' : ''}`}
                    onClick={() => !page.isSubscribed && togglePageSelection(page.pageId)}
                  >
                    <div className="page-checkbox">
                      {page.isSubscribed ? '✓' : selectedPages.includes(page.pageId) ? '✓' : ''}
                    </div>
                    <div className="page-info">
                      <h3>{page.pageName}</h3>
                      <p className="page-id">ID: {page.pageId}</p>
                      {page.isSubscribed && (
                        <span className="badge">Already Connected</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {connecting && (
              <div className="connecting-status">
                Connecting {connectedCount} of {selectedPages.length} pages...
              </div>
            )}

            <div className="actions">
              <button
                className="primary-btn"
                onClick={handleConnect}
                disabled={connecting || selectedPages.length === 0}
              >
                {connecting ? 'Connecting...' : `Connect ${selectedPages.length} Page${selectedPages.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="step-content success">
            <div className="success-icon">✅</div>
            <h2>All Set!</h2>
            <p className="success-text">
              Your pages have been successfully connected. You'll now receive real-time notifications 
              when new leads are submitted through your Facebook lead forms.
            </p>
            <div className="next-steps">
              <h3>Next Steps:</h3>
              <ul>
                <li>Go to your dashboard to view connected pages</li>
                <li>Check your lead forms and existing leads</li>
                <li>Create a test lead to see it in action</li>
              </ul>
            </div>
            <button className="primary-btn" onClick={() => window.location.href = '/dashboard'}>
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingFlow;
