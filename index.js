require("dotenv").config();
const axios = require("axios");
const mongoose = require("mongoose");
const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const cors = require('cors');  // Add this line

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
app.use(cors());  // Add this line
app.use(bodyParser.json());

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Webhook verification endpoint
app.get('/webhook/facebook-leads', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verified');
    res.status(200).send(challenge);
  } else {
    console.error('Webhook verification failed');
    res.sendStatus(403);
  }
});

// Webhook POST endpoint for receiving lead notifications
app.post('/webhook/facebook-leads', async (req, res) => {
  try {
    console.log('📥 Received webhook POST');
    console.log('Headers:', req.headers);
    console.log('Body:', JSON.stringify(req.body, null, 2));

    // For testing purposes, temporarily bypass signature verification
    if (process.env.NODE_ENV !== 'production') {
      console.log('⚠️ Bypassing signature verification in development');
      const { entry } = req.body;
      if (!entry || !Array.isArray(entry)) {
        console.error('❌ Invalid payload format');
        return res.sendStatus(400);
      }

      // Send response immediately to avoid timeout
      res.sendStatus(200);
      
      // Process leads with field_data
      for (const pageEntry of entry) {
        for (const change of pageEntry.changes) {
          if (change.value.item === 'lead') {
            console.log(`⏳ Processing lead: ${change.value.lead_id}`);
            await processNewLead(
              pageEntry.id,
              change.value.form_id,
              change.value.lead_id,
              change.value.field_data // Pass field_data from payload
            );
          }
        }
      }
      return;
    }

    // Normal signature verification
    const signature = req.headers['x-hub-signature'];
    if (!verifyWebhookSignature(req.body, signature)) {
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
            change.value.lead_id
          ).catch(err => {
            console.error(`❌ Error processing lead ${change.value.lead_id}:`, err);
          });
        }
      }
    }
  } catch (err) {
    console.error('❌ Webhook processing error:', err);
    if (!res.headersSent) {
      res.sendStatus(500);
    }
  }
});

function verifyWebhookSignature(payload, signature) {
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
      .update(JSON.stringify(payload))
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
    // If we have field_data in payload, use it directly
    const leadData = {
      leadId: leadId,
      created_time: new Date(),
      field_data: payloadFieldData || [] // Use payload data if available
    };

    // Only fetch from FB API if we don't have field_data
    if (!payloadFieldData) {
      const timeout = 5000;
      const { accessToken } = await getPageAccessToken();
      
      const leadResponse = await Promise.race([
        axios.get(`https://graph.facebook.com/v20.0/${leadId}`, {
          params: { access_token: accessToken }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);
      
      leadData.created_time = leadResponse.data.created_time;
      leadData.field_data = leadResponse.data.field_data;
    }

    console.log('📝 Updating lead with data:', JSON.stringify(leadData, null, 2));

    // First try to update existing lead
    const result = await Page.findOneAndUpdate(
      { 
        pageId: pageId,
        'leadForms.formId': formId,
        'leadForms.leads.leadId': leadId 
      },
      { 
        $set: { 
          'leadForms.$.leads.$[lead]': leadData,
          lastUpdated: new Date()
        }
      },
      {
        arrayFilters: [{ 'lead.leadId': leadId }],
        new: true
      }
    );

    if (!result) {
      await Page.findOneAndUpdate(
        { 
          pageId: pageId,
          'leadForms.formId': formId 
        },
        { 
          $push: { 'leadForms.$.leads': leadData },
          lastUpdated: new Date()
        }
      );
      console.log(`✅ New lead ${leadId} added with field data`);
    } else {
      console.log(`✅ Existing lead ${leadId} updated with field data`);
    }

  } catch (err) {
    console.error(`❌ Error processing lead ${leadId}:`, err.message);
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