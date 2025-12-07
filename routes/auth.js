const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/user-schema');
const facebookOAuth = require('../services/facebook-oauth');

/**
 * GET /auth/facebook
 * Initiates Facebook OAuth flow
 */
router.get('/facebook', (req, res) => {
  try {
    // Generate CSRF state token
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;

    const authUrl = facebookOAuth.getAuthorizationUrl(state);
    console.log('🔐 Redirecting to Facebook OAuth...');
    
    res.redirect(authUrl);
  } catch (error) {
    console.error('❌ Error initiating OAuth:', error);
    res.status(500).json({ error: 'Failed to initiate authentication' });
  }
});

/**
 * GET /auth/facebook/callback
 * Handles OAuth callback from Facebook
 */
router.get('/facebook/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    // Validate state parameter (CSRF protection)
    if (!state || state !== req.session.oauthState) {
      console.error('❌ Invalid state parameter');
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=invalid_state`);
    }

    // Clear the state from session
    delete req.session.oauthState;

    if (!code) {
      console.error('❌ No authorization code received');
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`);
    }

    console.log('✅ Received authorization code');

    // Exchange code for access token
    const tokenResponse = await facebookOAuth.exchangeCodeForToken(code);
    const userAccessToken = tokenResponse.access_token;

    console.log('✅ Exchanged code for access token');

    // Get user profile
    const userProfile = await facebookOAuth.getUserProfile(userAccessToken);
    console.log(`✅ Retrieved user profile: ${userProfile.name} (${userProfile.id})`);

    // Get user's pages
    const pages = await facebookOAuth.getUserPages(userAccessToken);
    console.log(`✅ Retrieved ${pages.length} page(s)`);

    // Save or update user in database
    const user = await User.findOneAndUpdate(
      { userId: userProfile.id },
      {
        userId: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        accessToken: userAccessToken,
        tokenExpiry: tokenResponse.expires_in 
          ? new Date(Date.now() + tokenResponse.expires_in * 1000) 
          : null,
        pages: pages.map(page => ({
          pageId: page.id,
          pageName: page.name,
          accessToken: page.access_token,
          isSubscribed: false
        })),
        lastLogin: new Date()
      },
      { upsert: true, new: true }
    );

    console.log(`💾 Saved user ${user.name} to database`);

    // Store user ID in session
    req.session.userId = user.userId;
    req.session.userName = user.name;

    // Redirect to frontend onboarding page
    res.redirect(`${process.env.FRONTEND_URL}/onboarding`);
  } catch (error) {
    console.error('❌ Error in OAuth callback:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
  }
});

/**
 * POST /auth/logout
 * Logs out the current user
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('❌ Error destroying session:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    console.log('✅ User logged out');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

/**
 * GET /auth/status
 * Check if user is authenticated
 */
router.get('/status', async (req, res) => {
  if (!req.session.userId) {
    return res.json({ authenticated: false });
  }

  try {
    const user = await User.findOne({ userId: req.session.userId }, 'userId name email pages');
    if (!user) {
      return res.json({ authenticated: false });
    }

    res.json({
      authenticated: true,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        pagesCount: user.pages.length
      }
    });
  } catch (error) {
    console.error('❌ Error checking auth status:', error);
    res.status(500).json({ error: 'Failed to check authentication status' });
  }
});

module.exports = router;
