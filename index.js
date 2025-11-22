require("dotenv").config();
const axios = require("axios");
const mongoose = require("mongoose");
const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const cors = require('cors');

// MongoDB schemas
const locationSchema = new mongoose.Schema({
  city: String,
  country: String,
  latitude: Number,
  longitude: Number,
  street: String,
  zip: String
});

const postSchema = new mongoose.Schema({
  postId: String,
  message: String,
  created_time: Date,
  permalink_url: String
});

const leadFieldSchema = new mongoose.Schema({
  name: String,
  values: [String]
});

const leadSchema = new mongoose.Schema({
  leadId: String,
  created_time: Date,
  platform: String, // 'facebook' or 'instagram'
  field_data: [leadFieldSchema]
});

const leadFormSchema = new mongoose.Schema({
  formId: String,
  locale: String,
  name: String,
  status: String,
  leads: [leadSchema]
});

const pageSchema = new mongoose.Schema({
  pageId: String,
  name: String,
  fan_count: Number,
  link: String,
  location: locationSchema,
  phone: String,
  website: String,
  category: String,
  posts: [postSchema],
  leadForms: [leadFormSchema],
  lastUpdated: { type: Date, default: Date.now }
});

const Page = mongoose.model("Page", pageSchema);

async function getPageAccessToken() {
  const { USER_ACCESS_TOKEN } = process.env;
  const response = await axios.get('https://graph.facebook.com/v20.0/me/accounts', {
    params: {
      access_token: USER_ACCESS_TOKEN
    }
  });
  
  const testHubPage = response.data.data.find(page => page.name === "Test Hub Restaurant");
  if (!testHubPage) {
    throw new Error("Test Hub Restaurant page not found");
  }
  
  return {
    pageId: testHubPage.id,
    accessToken: testHubPage.access_token
  };
}

async function fetchLeadFormsAndLeads(pageId, accessToken) {
  // Fetch lead forms
  const formsResponse = await axios.get(`https://graph.facebook.com/v20.0/${pageId}/leadgen_forms`, {
    params: { access_token: accessToken }
  });

  const leadForms = [];
  for (const form of formsResponse.data.data) {
    // Fetch leads for each form
    const leadsResponse = await axios.get(`https://graph.facebook.com/v20.0/${form.id}/leads`, {
      params: { access_token: accessToken }
    });

    const leads = leadsResponse.data.data.map(lead => ({
      leadId: lead.id,
      created_time: lead.created_time,
      field_data: lead.field_data
    }));

    leadForms.push({
      formId: form.id,
      locale: form.locale,
      name: form.name,
      status: form.status,
      leads: leads
    });
  }

  return leadForms;
}

async function fetchPageAndLeads() {
  try {
    const { pageId, accessToken } = await getPageAccessToken();
    console.log("✅ Retrieved page access token");

    // Fetch page details
    const url = `https://graph.facebook.com/v20.0/${pageId}`;
    const fields = "id,name,about,fan_count,link,location,phone,website,emails,category";
    const pageResponse = await axios.get(url, {
      params: {
        fields,
        access_token: accessToken
      }
    });

    const pageData = pageResponse.data;
    const leadForms = await fetchLeadFormsAndLeads(pageId, accessToken);

    // Save to MongoDB
    await Page.findOneAndUpdate(
      { pageId: pageData.id },
      {
        pageId: pageData.id,
        name: pageData.name,
        fan_count: pageData.fan_count,
        link: pageData.link,
        location: pageData.location,
        phone: pageData.phone,
        website: pageData.website,
        category: pageData.category,
        leadForms: leadForms,
        lastUpdated: new Date()
      },
      { upsert: true, new: true }
    );

    console.log("💾 Page data, lead forms, and leads saved to MongoDB");
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
  }
}

const app = express();

// IMPORTANT: Register middleware in correct order
app.use(cors());

// Capture raw body AND parse JSON
app.use(bodyParser.json({
  verify: (req, res, buf, encoding) => {
    // Store raw body for signature verification
    req.rawBody = buf.toString('utf8');
  }
}));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  console.log('Body:', req.body ? 'Parsed' : 'Empty');
  next();
});

// Webhook verification endpoint
app.get('/webhook/facebook-leads', (req, res) => {
  console.log('📍 GET /webhook/facebook-leads - Verification Request');
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('Verification params:', { mode, token: token ? '***' : 'missing', challenge: challenge ? '***' : 'missing' });

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

// Webhook POST endpoint for receiving lead notifications
app.post('/webhook/facebook-leads', async (req, res) => {
  try {
    console.log('📥 ===================== NEW WEBHOOK REQUEST =====================');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('📝 Headers:', JSON.stringify(req.headers, null, 2));
    
    // Defensive check: handle empty body
    if (!req.body || Object.keys(req.body).length === 0) {
      console.warn('⚠️ Empty request body received');
      console.log('Raw body:', req.rawBody ? req.rawBody.substring(0, 200) : 'No raw body');
      return res.sendStatus(200); // Still return 200 to acknowledge
    }

    console.log('📦 Payload:', JSON.stringify(req.body, null, 2));

    // For testing purposes, temporarily bypass signature verification
    if (process.env.NODE_ENV !== 'production') {
      console.log('⚠️ Development mode: Bypassing signature verification');
      const { entry } = req.body;
      if (!entry || !Array.isArray(entry)) {
        console.error('❌ Invalid payload format - missing or invalid entry');
        return res.sendStatus(400);
      }

      res.sendStatus(200);
      console.log('✅ Webhook response sent: 200');
      
      // Process leads - await each one
      for (const pageEntry of entry) {
        console.log(`🔄 Processing page entry for page ID: ${pageEntry.id}`);
        for (const change of pageEntry.changes) {
          // Handle both old and new webhook formats
          let leadInfo = null;
          
          if (change.value.item === 'lead') {
            // New format from test-all-scenarios
            leadInfo = {
              pageId: pageEntry.id,
              formId: change.value.form_id,
              leadId: change.value.lead_id,
              fieldData: change.value.field_data
            };
          } else if (change.field === 'leadgen' && change.value.form_id) {
            // Old format from curl command
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
      return;
    }

    // Normal signature verification
    const signature = req.headers['x-hub-signature'];
    if (!verifyWebhookSignature(req.rawBody, signature)) {
      console.error('❌ Signature verification failed');
      return res.sendStatus(403);
    }

    const { entry } = req.body;
    if (!entry || !Array.isArray(entry)) {
      console.error('❌ Invalid payload format');
      return res.sendStatus(400);
    }

    // Send response immediately to avoid timeout
    res.sendStatus(200);
    
    // Process leads asynchronously
    for (const pageEntry of entry) {
      for (const change of pageEntry.changes) {
        if (change.value.item === 'lead') {
          console.log(`⏳ Processing lead: ${change.value.lead_id}`);
          processNewLead(
            pageEntry.id,
            change.value.form_id,
            change.value.lead_id,
            change.value.field_data
          ).catch(err => {
            console.error(`❌ Error processing lead ${change.value.lead_id}:`, err);
          });
        }
      }
    }
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

function verifyWebhookSignature(rawBody, signature) {
  try {
    if (!signature) {
      console.error('❌ No signature provided');
      return false;
    }
    if (!process.env.APP_SECRET) {
      console.error('❌ No APP_SECRET configured');
      return false;
    }

    const elements = signature.split('=');
    if (elements.length !== 2) {
      console.error('❌ Invalid signature format');
      return false;
    }

    const signatureHash = elements[1];
    const expectedHash = crypto
      .createHmac('sha1', process.env.APP_SECRET)
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

    // STEP 1: Search for Page
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

    // STEP 2: Search for Form in the page
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

    // STEP 3: Search for Lead in the form
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

    // STEP 4: Update existing lead
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

// Initialize application
async function initializeApp() {
  try {
    // First connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('✅ Connected to MongoDB');

    // Start the Express server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // Perform initial data fetch
    console.log('📥 Performing initial data fetch...');
    await fetchPageAndLeads();
    
    // Schedule periodic data refresh (optional)
    setInterval(async () => {
      console.log('🔄 Running scheduled data refresh...');
      await fetchPageAndLeads();
    }, 24 * 60 * 60 * 1000); // Refresh every 24 hours
    
  } catch (err) {
    console.error('❌ Failed to initialize application:', err);
  }
}

// Test endpoint to generate signature
app.get('/test/signature', (req, res) => {
  const testPayload = {
    entry: [{
      id: "806684809200027",
      time: Date.now(),
      changes: [{
        value: {
          form_id: "1506172427371578",
          lead_id: "1500797147815898", // Use an existing lead ID
          created_time: Date.now(),
          page_id: "806684809200027",
          item: "lead",
          action: "edit" // Add this to indicate it's an edit
        }
      }]
    }]
  };

  const signature = crypto
    .createHmac('sha1', process.env.APP_SECRET)
    .update(JSON.stringify(testPayload))
    .digest('hex');

  res.json({
    payload: testPayload,
    signature: 'sha1=' + signature
  });
});

// Test endpoint to simulate Facebook verification
app.get('/test/verify', (req, res) => {
  const testUrl = `/webhook/facebook-leads?hub.mode=subscribe&hub.verify_token=${process.env.WEBHOOK_VERIFY_TOKEN}&hub.challenge=1234567890`;
  res.redirect(testUrl);
});

// Start the application
initializeApp();