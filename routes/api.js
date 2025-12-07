const express = require('express');
const router = express.Router();
const User = require('../models/user-schema');
const Page = require('../models/page-schema');
const facebookOAuth = require('../services/facebook-oauth');

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

/**
 * GET /api/user/pages
 * Get all pages for the authenticated user
 */
router.get('/user/pages', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.session.userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      success: true, 
      pages: user.pages 
    });
  } catch (error) {
    console.error('❌ Error fetching user pages:', error);
    res.status(500).json({ error: 'Failed to fetch pages' });
  }
});

/**
 * POST /api/user/pages/connect
 * Subscribe selected page to webhooks
 */
router.post('/user/pages/connect', requireAuth, async (req, res) => {
  try {
    const { pageId } = req.body;

    if (!pageId) {
      return res.status(400).json({ error: 'Page ID is required' });
    }

    const user = await User.findOne({ userId: req.session.userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find the page in user's pages
    const pageIndex = user.pages.findIndex(p => p.pageId === pageId);
    if (pageIndex === -1) {
      return res.status(404).json({ error: 'Page not found in user account' });
    }

    const page = user.pages[pageIndex];

    // Subscribe page to webhooks
    await facebookOAuth.subscribePageToWebhooks(page.pageId, page.accessToken, ['leadgen']);

    // Update page subscription status
    user.pages[pageIndex].isSubscribed = true;
    await user.save();

    console.log(`✅ Connected page ${page.pageName} (${pageId}) for user ${user.name}`);

    res.json({ 
      success: true, 
      message: 'Page connected successfully',
      page: user.pages[pageIndex]
    });
  } catch (error) {
    console.error('❌ Error connecting page:', error);
    res.status(500).json({ error: 'Failed to connect page' });
  }
});

/**
 * POST /api/user/pages/disconnect
 * Unsubscribe page from webhooks
 */
router.post('/user/pages/disconnect', requireAuth, async (req, res) => {
  try {
    const { pageId } = req.body;

    if (!pageId) {
      return res.status(400).json({ error: 'Page ID is required' });
    }

    const user = await User.findOne({ userId: req.session.userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const pageIndex = user.pages.findIndex(p => p.pageId === pageId);
    if (pageIndex === -1) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const page = user.pages[pageIndex];

    // Unsubscribe page from webhooks
    await facebookOAuth.unsubscribePageFromWebhooks(page.pageId, page.accessToken);

    // Update subscription status
    user.pages[pageIndex].isSubscribed = false;
    await user.save();

    console.log(`✅ Disconnected page ${page.pageName} (${pageId})`);

    res.json({ 
      success: true, 
      message: 'Page disconnected successfully' 
    });
  } catch (error) {
    console.error('❌ Error disconnecting page:', error);
    res.status(500).json({ error: 'Failed to disconnect page' });
  }
});

/**
 * GET /api/pages/:pageId/forms
 * Get lead forms for a specific page
 */
router.get('/pages/:pageId/forms', requireAuth, async (req, res) => {
  try {
    const { pageId } = req.params;

    // Get user and verify they own this page
    const user = await User.findOne({ userId: req.session.userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const page = user.pages.find(p => p.pageId === pageId);
    if (!page) {
      return res.status(403).json({ error: 'Access denied to this page' });
    }

    // Get page data from database
    const pageData = await Page.findOne({ pageId: pageId });
    
    if (!pageData) {
      return res.json({ 
        success: true, 
        forms: [],
        message: 'No forms found for this page yet'
      });
    }

    res.json({ 
      success: true, 
      forms: pageData.leadForms || []
    });
  } catch (error) {
    console.error('❌ Error fetching forms:', error);
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

/**
 * GET /api/pages/:pageId/forms/:formId/leads
 * Get leads for a specific form
 */
router.get('/pages/:pageId/forms/:formId/leads', requireAuth, async (req, res) => {
  try {
    const { pageId, formId } = req.params;

    // Verify user owns this page
    const user = await User.findOne({ userId: req.session.userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const page = user.pages.find(p => p.pageId === pageId);
    if (!page) {
      return res.status(403).json({ error: 'Access denied to this page' });
    }

    // Get page data
    const pageData = await Page.findOne({ pageId: pageId });
    if (!pageData) {
      return res.json({ success: true, leads: [] });
    }

    // Find the form
    const form = pageData.leadForms.find(f => f.formId === formId);
    if (!form) {
      return res.json({ success: true, leads: [] });
    }

    res.json({ 
      success: true, 
      leads: form.leads || [],
      formName: form.name
    });
  } catch (error) {
    console.error('❌ Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

/**
 * POST /api/pages/:pageId/sync
 * Manually sync page data from Facebook
 */
router.post('/pages/:pageId/sync', requireAuth, async (req, res) => {
  try {
    const { pageId } = req.params;

    const user = await User.findOne({ userId: req.session.userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const page = user.pages.find(p => p.pageId === pageId);
    if (!page) {
      return res.status(403).json({ error: 'Access denied to this page' });
    }

    // Fetch lead forms from Facebook
    const forms = await facebookOAuth.getPageLeadForms(pageId, page.accessToken);
    
    // Fetch leads for each form
    const formsWithLeads = [];
    for (const form of forms) {
      const leads = await facebookOAuth.getFormLeads(form.id, page.accessToken);
      
      formsWithLeads.push({
        formId: form.id,
        locale: form.locale,
        name: form.name,
        status: form.status,
        leads: leads.map(lead => ({
          leadId: lead.id,
          created_time: lead.created_time,
          platform: 'facebook',
          field_data: lead.field_data
        }))
      });
    }

    // Update or create page document
    await Page.findOneAndUpdate(
      { pageId: pageId },
      {
        pageId: pageId,
        name: page.pageName,
        leadForms: formsWithLeads,
        lastUpdated: new Date()
      },
      { upsert: true, new: true }
    );

    console.log(`✅ Synced page data for ${page.pageName}`);

    res.json({ 
      success: true, 
      message: 'Page data synced successfully',
      formsCount: formsWithLeads.length,
      leadsCount: formsWithLeads.reduce((sum, form) => sum + form.leads.length, 0)
    });
  } catch (error) {
    console.error('❌ Error syncing page:', error);
    res.status(500).json({ error: 'Failed to sync page data' });
  }
});

module.exports = router;
