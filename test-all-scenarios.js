const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const APP_SECRET = process.env.APP_SECRET || 'your_facebook_app_secret';
const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

function generateSignature(payload) {
  return crypto
    .createHmac('sha1', APP_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
}

function createPayload(pageId, formId, leadId, fieldData = null) {
  const payload = {
    entry: [{
      id: pageId,
      time: Math.floor(Date.now() / 1000),
      changes: [{
        value: {
          form_id: formId,
          lead_id: leadId,
          created_time: Math.floor(Date.now() / 1000),
          page_id: pageId,
          item: "lead",
          action: "create",
          field_data: fieldData || [
            { name: "full_name", values: ["Test User"] },
            { name: "email", values: ["test@example.com"] },
            { name: "phone", values: ["1234567890"] }
          ]
        }
      }]
    }]
  };
  return payload;
}

async function sendWebhook(scenarioName, pageId, formId, leadId, fieldData = null) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 SCENARIO: ${scenarioName}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📍 Page ID: ${pageId}`);
    console.log(`📍 Form ID: ${formId}`);
    console.log(`📍 Lead ID: ${leadId}`);

    const payload = createPayload(pageId, formId, leadId, fieldData);
    const signature = generateSignature(payload);

    console.log(`\n📤 Sending webhook request...`);
    const response = await axios.post(`${BASE_URL}/webhook/facebook-leads`, payload, {
      headers: {
        'x-hub-signature': `sha1=${signature}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Response Status: ${response.status}`);
    console.log(`✅ Webhook processed successfully!\n`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    if (error.response) {
      console.error(`❌ Response Status:`, error.response.status);
    }
    return false;
  }
}

async function runAllScenarios() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         FACEBOOK LEAD WEBHOOK TEST - ALL SCENARIOS         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Scenario 1: New Lead in Existing Form
  console.log('\n\n📋 SCENARIO 1: NEW LEAD IN EXISTING FORM');
  console.log('Existing Page: 806684809200027, Existing Form: 1506172427371578');
  console.log('Adding a brand new lead to this form...');
  
  await sendWebhook(
    'New Lead in Existing Form',
    '806684809200027',           // Existing page
    '1506172427371578',          // Existing form
    '9999999999999999',          // New lead ID
    [
      { name: "full_name", values: ["New Lead User"] },
      { name: "email", values: ["newlead@example.com"] },
      { name: "phone", values: ["9876543210"] }
    ]
  );

  // Wait 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Scenario 2: New Form in Existing Page
  console.log('\n\n📋 SCENARIO 2: NEW FORM IN EXISTING PAGE');
  console.log('Existing Page: 806684809200027');
  console.log('Adding a brand new form to this page...');
  
  await sendWebhook(
    'New Form in Existing Page',
    '806684809200027',           // Existing page
    '9999999912345678',          // New form ID
    '8888888888888888',          // New lead ID
    [
      { name: "full_name", values: ["Test User Form2"] },
      { name: "email", values: ["formuser@example.com"] },
      { name: "phone", values: ["5555555555"] }
    ]
  );

  // Wait 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Scenario 3: Completely New Page
  console.log('\n\n📋 SCENARIO 3: COMPLETELY NEW PAGE');
  console.log('Creating a brand new page with a new form and lead...');
  
  await sendWebhook(
    'Completely New Page',
    '999999999999999',           // New page ID
    '777777777777777',           // New form ID
    '666666666666666',           // New lead ID
    [
      { name: "full_name", values: ["Brand New Page User"] },
      { name: "email", values: ["newpage@example.com"] },
      { name: "phone", values: ["1111111111"] }
    ]
  );

  // Wait 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Bonus: Update Existing Lead
  console.log('\n\n📋 BONUS: UPDATE EXISTING LEAD');
  console.log('Updating an existing lead with new field data...');
  
  await sendWebhook(
    'Update Existing Lead',
    '806684809200027',           // Existing page
    '1506172427371578',          // Existing form
    '1500797147815898',          // Existing lead ID
    [
      { name: "FULL_NAME", values: ["UPDATED NAME"] },
      { name: "EMAIL", values: ["updated@example.com"] },
      { name: "PHONE", values: ["9999999999"] }
    ]
  );

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              ✅ ALL TESTS COMPLETED                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\nCheck your MongoDB to verify:');
  console.log('1. Scenario 1: New lead 9999999999999999 in existing form');
  console.log('2. Scenario 2: New form 9999999912345678 in existing page');
  console.log('3. Scenario 3: New page 999999999999999 created');
  console.log('4. Bonus: Lead 1500797147815898 field data updated\n');
}

// Run all scenarios
runAllScenarios().catch(console.error);
