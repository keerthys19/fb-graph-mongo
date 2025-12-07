import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchPages();
  }, []);

  useEffect(() => {
    if (selectedPage) {
      fetchForms(selectedPage.pageId);
    }
  }, [selectedPage]);

  useEffect(() => {
    if (selectedPage && selectedForm) {
      fetchLeads(selectedPage.pageId, selectedForm.formId);
    }
  }, [selectedForm]);

  const fetchPages = async () => {
    try {
      setLoading(true);
      const data = await apiService.getUserPages();
      setPages(data.pages || []);
    } catch (error) {
      console.error('Error fetching pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchForms = async (pageId) => {
    try {
      const data = await apiService.getPageForms(pageId);
      setForms(data.forms || []);
      setSelectedForm(null);
      setLeads([]);
    } catch (error) {
      console.error('Error fetching forms:', error);
      setForms([]);
    }
  };

  const fetchLeads = async (pageId, formId) => {
    try {
      const data = await apiService.getFormLeads(pageId, formId);
      setLeads(data.leads || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      setLeads([]);
    }
  };

  const handleSyncPage = async () => {
    if (!selectedPage) return;
    
    try {
      setSyncing(true);
      await apiService.syncPageData(selectedPage.pageId);
      await fetchForms(selectedPage.pageId);
      alert('Page data synced successfully!');
    } catch (error) {
      console.error('Error syncing page:', error);
      alert('Failed to sync page data');
    } finally {
      setSyncing(false);
    }
  };

  const connectedPages = pages.filter(p => p.isSubscribed);

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <h1>📊 Lead Manager Dashboard</h1>
          <div className="user-info">
            <span>Welcome, {user?.name}</span>
            <button className="logout-btn" onClick={logout}>Logout</button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="dashboard-content">
        {connectedPages.length === 0 ? (
          <div className="empty-state">
            <h2>No connected pages</h2>
            <p>Go to onboarding to connect your Facebook pages</p>
            <button className="primary-btn" onClick={() => window.location.href = '/onboarding'}>
              Connect Pages
            </button>
          </div>
        ) : (
          <div className="dashboard-grid">
            {/* Pages List */}
            <div className="sidebar">
              <div className="sidebar-header">
                <h3>Your Pages ({connectedPages.length})</h3>
              </div>
              <div className="pages-list">
                {connectedPages.map(page => (
                  <div
                    key={page.pageId}
                    className={`page-item ${selectedPage?.pageId === page.pageId ? 'active' : ''}`}
                    onClick={() => setSelectedPage(page)}
                  >
                    <div className="page-name">{page.pageName}</div>
                    <div className="page-status">
                      <span className="status-badge">Connected</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Forms and Leads */}
            <div className="main-panel">
              {!selectedPage ? (
                <div className="placeholder">
                  <p>Select a page to view its lead forms</p>
                </div>
              ) : (
                <>
                  <div className="panel-header">
                    <h2>{selectedPage.pageName}</h2>
                    <button 
                      className="sync-btn" 
                      onClick={handleSyncPage}
                      disabled={syncing}
                    >
                      {syncing ? '⟳ Syncing...' : '⟳ Sync Data'}
                    </button>
                  </div>

                  {forms.length === 0 ? (
                    <div className="empty-state">
                      <p>No lead forms found for this page</p>
                      <p className="hint">Create a lead form on Facebook or click "Sync Data"</p>
                    </div>
                  ) : (
                    <div className="forms-section">
                      <h3>Lead Forms ({forms.length})</h3>
                      <div className="forms-grid">
                        {forms.map(form => (
                          <div
                            key={form.formId}
                            className={`form-card ${selectedForm?.formId === form.formId ? 'active' : ''}`}
                            onClick={() => setSelectedForm(form)}
                          >
                            <h4>{form.name}</h4>
                            <div className="form-meta">
                              <span className="badge">{form.status}</span>
                              <span className="leads-count">{form.leads?.length || 0} leads</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {selectedForm && (
                        <div className="leads-section">
                          <h3>Leads for "{selectedForm.name}" ({leads.length})</h3>
                          {leads.length === 0 ? (
                            <div className="empty-state">
                              <p>No leads yet for this form</p>
                            </div>
                          ) : (
                            <div className="leads-table">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Platform</th>
                                    <th>Lead Data</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {leads.map(lead => (
                                    <tr key={lead.leadId}>
                                      <td>{new Date(lead.created_time).toLocaleString()}</td>
                                      <td>
                                        <span className={`platform-badge ${lead.platform}`}>
                                          {lead.platform}
                                        </span>
                                      </td>
                                      <td>
                                        <div className="field-data">
                                          {lead.field_data?.map((field, idx) => (
                                            <div key={idx} className="field-item">
                                              <strong>{field.name}:</strong> {field.values?.join(', ')}
                                            </div>
                                          ))}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
