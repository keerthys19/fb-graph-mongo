require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const cors = require('cors');
const mongoose = require("mongoose");
const session = require('express-session');
const MongoStore = require('connect-mongo');

// Import models
const Page = require('./models/page-schema');
const User = require('./models/user-schema');

// Import routes
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();

// CORS configuration - allow credentials for session cookies
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));

// Capture raw body AND parse JSON (needed for webhook signature verification)
app.use(bodyParser.json({
  verify: (req, res, buf, encoding) => {
    req.rawBody = buf.toString('utf8');
  }
}));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    touchAfter: 24 * 3600 // lazy session update (24 hours)
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
}));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Mount routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// ============================================================================
// WEBHOOK ENDPOINTS
// ============================================================================

/**
 * GET /webhook/facebook-leads
 * Webhook verification endpoint
 */
app.get('/webhook/facebook-leads', (req, res) => {
  console.log('📍 GET /webhook/facebook-leads - Verification Request');
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('Verification params:', { 
    mode, 
    token: token ? '***' : 'missing', 
    challenge: challenge ? '***' : 'missing' 
  });

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

/**
 * POST /webhook/facebook-leads
 * Webhook POST endpoint for receiving lead notifications
 */
app.post('/webhook/facebook-leads', async (req, res) => {
  try {
    console.log('📥 ===================== NEW WEBHOOK REQUEST =====================');
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    // Defensive check: handle empty body
    if (!req.body || Object.keys(req.body).length === 0) {
      console.warn('⚠️ Empty request body received');
      return res.sendStatus(200);
    }

    console.log('📦 Payload:', JSON.stringify(req.body, null, 2));

    // In development mode, bypass signature verification
    if (process.env.NODE_ENV !== 'production') {
      console.log('⚠️ Development mode: Bypassing signature verification');
    } else {
      // Verify webhook signature in production
      const signature = req.headers['x-hub-signature'];
      if (!verifyWebhookSignature(req.rawBody, signature)) {
        console.error('❌ Signature verification failed');
        return res.sendStatus(403);
      }
    }

    const { entry } = req.body;
    if (!entry || !Array.isArray(entry)) {
      console.error('❌ Invalid payload format - missing or invalid entry');
      return res.sendStatus(400);
    }

    // Send response immediately to avoid timeout
    res.sendStatus(200);
    console.log('✅ Webhook response sent: 200');
    
    // Process leads asynchronously
    for (const pageEntry of entry) {
      console.log(`🔄 Processing page entry for page ID: ${pageEntry.id}`);
      for (const change of pageEntry.changes) {
        // Handle both old and new webhook formats
        let leadInfo = null;
        
        if (change.value.item === 'lead') {
          // New format
          leadInfo = {
            pageId: pageEntry.id,
            formId: change.value.form_id,
            leadId: change.value.lead_id,
            fieldData: change.value.field_data
          };
        } else if (change.field === 'leadgen' && change.value.form_id) {
          // Old format
          leadInfo = {
            pageId: pageEntry.id,
            formId: change.value.form_id,
            leadId: change.value.leadgen_id || change.value.lead_id,
            fieldData: null
          };
        }

        if (leadInfo) {
          console.log(`📋 Lead details:
            - Form ID: ${leadInfo.formId}
            - Lead ID: ${leadInfo.leadId}
            - Page ID: ${leadInfo.pageId}
          `);
          try {
            await processNewLead(
              leadInfo.pageId,
              leadInfo.formId,
              leadInfo.leadId,
              leadInfo.fieldData
            );
          } catch (leadErr) {
            console.error(`❌ Error processing lead ${leadInfo.leadId}:`, leadErr.message);
          }
        }
      }
    }
    console.log('✅ Webhook processing completed');
  } catch (err) {
    console.error('❌ Webhook processing error:', err);
    console.error('Stack trace:', err.stack);
    if (!res.headersSent) {
      res.sendStatus(500);
    }
  } finally {
    console.log('📥 ===================== END WEBHOOK REQUEST =====================\n');
  }
});

/**
 * Verify webhook signature from Facebook
 */
function verifyWebhookSignature(rawBody, signature) {
  try {
    if (!signature) {
      console.error('❌ No signature provided');
      return false;
    }
    if (!process.env.APP_SECRET && !process.env.FACEBOOK_APP_SECRET) {
      console.error('❌ No APP_SECRET configured');
      return false;
    }

    const appSecret = process.env.FACEBOOK_APP_SECRET || process.env.APP_SECRET;
    const elements = signature.split('=');
    if (elements.length !== 2) {
      console.error('❌ Invalid signature format');
      return false;
    }

    const signatureHash = elements[1];
    const expectedHash = crypto
      .createHmac('sha1', appSecret)
      .update(rawBody)
      .digest('hex');
    
    console.log('🔐 Signature verification:', {
      received: signatureHash,
      expected: expectedHash,
      match: signatureHash === expectedHash
    });
    
    return signatureHash === expectedHash;
  } catch (err) {
    console.error('❌ Signature verification error:', err);
    return false;
  }
}

/**
 * Process a new lead from webhook
 */
async function processNewLead(pageId, formId, leadId, payloadFieldData) {
  try {
    console.log(`\n🔄 Processing lead ${leadId}:`);
    console.log('- Page ID:', pageId);
    console.log('- Form ID:', formId);
    console.log('- Lead ID:', leadId);

    const leadData = {
      leadId: leadId,
      created_time: new Date(),
      platform: 'facebook',
      field_data: payloadFieldData || []
    };

    console.log('📝 Lead data to save:', JSON.stringify(leadData, null, 2));

    // Search for Page
    console.log(`\n📍 STEP 1: Searching for Page ID: ${pageId}`);
    let page = await Page.findOne({ pageId: pageId });

    if (!page) {
      console.log(`ℹ️ Page not found, creating new page`);
      // Create new page with form and lead
      page = await Page.create({
        pageId: pageId,
        name: 'Unknown Page',
        leadForms: [{
          formId: formId,
          locale: 'en_US',
          name: 'Unknown Form',
          status: 'ACTIVE',
          leads: [leadData]
        }],
        lastUpdated: new Date()
      });
      console.log(`✅ New page created with ID: ${page._id}`);
      console.log(`✅ New form created with ID: ${formId}`);
      console.log(`✅ New lead created with ID: ${leadId}`);
      return;
    }

    console.log(`✅ Page found with ID: ${page._id}`);

    // Search for Form in the page
    console.log(`\n📍 STEP 2: Searching for Form ID: ${formId} in Page`);
    let formIndex = page.leadForms.findIndex(f => f.formId === formId);

    if (formIndex === -1) {
      console.log(`ℹ️ Form not found, creating new form`);
      // Create new form with lead
      page.leadForms.push({
        formId: formId,
        locale: 'en_US',
        name: 'Unknown Form',
        status: 'ACTIVE',
        leads: [leadData]
      });
      page.lastUpdated = new Date();
      await page.save();
      console.log(`✅ New form created with ID: ${formId}`);
      console.log(`✅ New lead created with ID: ${leadId}`);
      return;
    }

    console.log(`✅ Form found with ID: ${formId}`);

    // Search for Lead in the form
    console.log(`\n📍 STEP 3: Searching for Lead ID: ${leadId} in Form`);
    let leadIndex = page.leadForms[formIndex].leads.findIndex(l => l.leadId === leadId);

    if (leadIndex === -1) {
      console.log(`ℹ️ Lead not found, creating new lead`);
      // Create new lead
      page.leadForms[formIndex].leads.push(leadData);
      page.lastUpdated = new Date();
      await page.save();
      console.log(`✅ New lead created with ID: ${leadId}`);
      console.log('📌 Added lead data:', JSON.stringify(leadData, null, 2));
      return;
    }

    console.log(`✅ Lead found with ID: ${leadId}`);

    // Update existing lead
    console.log(`\n📍 STEP 4: Updating existing Lead ID: ${leadId}`);
    page.leadForms[formIndex].leads[leadIndex] = leadData;
    page.lastUpdated = new Date();
    await page.save();
    console.log(`✅ Existing lead updated successfully`);
    console.log('📌 Updated lead data:', JSON.stringify(leadData, null, 2));

  } catch (err) {
    console.error(`❌ Error processing lead ${leadId}:`);
    console.error('- Error message:', err.message);
    console.error('- Stack trace:', err.stack);
    throw err;
  }
}

// ============================================================================
// TEST ENDPOINTS (Development only)
// ============================================================================

if (process.env.NODE_ENV !== 'production') {
  // Test endpoint to generate signature
  app.get('/test/signature', (req, res) => {
    const testPayload = {
      entry: [{
        id: "806684809200027",
        time: Date.now(),
        changes: [{
          value: {
            form_id: "1506172427371578",
            lead_id: "1500797147815898",
            created_time: Date.now(),
            page_id: "806684809200027",
            item: "lead",
            action: "edit"
          }
        }]
      }]
    };

    const appSecret = process.env.FACEBOOK_APP_SECRET || process.env.APP_SECRET;
    const signature = crypto
      .createHmac('sha1', appSecret)
      .update(JSON.stringify(testPayload))
      .digest('hex');

    res.json({
      payload: testPayload,
      signature: 'sha1=' + signature
    });
  });

  // Test endpoint to simulate verification
  app.get('/test/verify', (req, res) => {
    const testUrl = `/webhook/facebook-leads?hub.mode=subscribe&hub.verify_token=${process.env.WEBHOOK_VERIFY_TOKEN}&hub.challenge=1234567890`;
    res.redirect(testUrl);
  });
}

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================

async function initializeApp() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('✅ Connected to MongoDB');

    // Start the Express server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3001'}`);
      console.log(`📍 OAuth Redirect: ${process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/facebook/callback'}`);
    });

    console.log('\n✅ Multi-user OAuth system ready!');
    console.log('👉 Users can login at: /auth/facebook');
    
  } catch (err) {
    console.error('❌ Failed to initialize application:', err);
    process.exit(1);
  }
}

// Start the application
initializeApp();