const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const APP_SECRET = process.env.APP_SECRET || 'your_facebook_app_secret'; // Ensure this matches your .env
const PORT = process.env.PORT || 3000;

// Accept overrides via env or CLI args
const FORM_ID = process.env.FORM_ID || process.argv[2] || "123456789012345"; // <--- added configurable form id
const PAGE_ID = process.env.PAGE_ID || process.argv[3] || "17841400000000000";
const LEAD_ID = process.env.LEAD_ID || process.argv[4] || "987654321098777";

async function testInstagramWebhook() {
  const payload = {
    entry: [{
      id: PAGE_ID, // uses configurable page id
      time: Math.floor(Date.now() / 1000),
      changes: [{
        value: {
          form_id: FORM_ID,               // <-- inserted/used here
          lead_id: LEAD_ID,               // configurable lead id
          created_time: Math.floor(Date.now() / 1000),
          page_id: PAGE_ID,
          item: "lead",
          action: "create",
          field_data: [
            { name: "full_name", values: ["Instagram User"] },
            { name: "email", values: ["insta@example.com"] },
            { name: "platform", values: ["ig"] } // Sometimes IG leads have this
          ]
        }
      }]
    }]
  };

  const signature = crypto
    .createHmac('sha1', APP_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  try {
    console.log('🚀 Sending mock Instagram webhook with form_id:', FORM_ID);
    const response = await axios.post(`http://localhost:${PORT}/webhook/facebook-leads`, payload, {
      headers: {
        'x-hub-signature': `sha1=${signature}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Response status:', response.status);
    console.log('✅ Response data:', response.data);
  } catch (error) {
    console.error('❌ Error sending webhook:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testInstagramWebhook();
