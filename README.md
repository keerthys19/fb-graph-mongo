# fb-graph-mongo

📘 Facebook Lead Ads Webhook Integration — Setup & Testing Guide
🔧 Prerequisites
- A Facebook App created in Meta for Developers
- A Facebook Page with published Lead Forms
- A publicly accessible HTTPS webhook endpoint (e.g., hosted on Render, ngrok, etc.)
- Valid Page access token with required permissions

🪜 Step-by-Step Setup
1. Create or Select Your App
- Go to Meta for Developers
- Create a new app or select an existing one
- Ensure the app is set to Business type
2. Add the Webhooks Product
- In the app dashboard, scroll to Add Product
- Click Set Up on Webhooks
3. Customize Webhooks
- Select “Page” as the product
- Enter your Callback URL (your webhook endpoint)
- Enter a Verify Token (a secret string your server uses to validate requests)
- Click Verify and Save
- Your server must respond to Facebook’s verification request with the hub.challenge value
4. Subscribe to the leadgen Field
- After verification, click Subscribe to Fields
- Select leadgen from the list
- Click Save
5. Subscribe the Page to Your App
Use Graph API Explorer or code to run:
POST /{page-id}/subscribed_apps
subscribed_fields=leadgen
access_token={page-access-token}


Example:
POST /806684809200027/subscribed_apps
subscribed_fields=leadgen
access_token=EAAB...your_token


✅ You should get { "success": true } as confirmation
6. Verify Page Access Token
Run:
GET /me/accounts?access_token={user-access-token}


This returns all Pages the user manages, along with Page tokens

🧪 Testing the Webhook
7. Use Lead Ads Testing Tool
- Go to Lead Ads Testing Tool
- Select your Page and a published Lead Form
- Click Create Lead
- Facebook sends a POST request to your webhook
8. Log Incoming Webhook Payload
Your server should log something like:
{
  "entry": [{
    "changes": [{
      "field": "leadgen",
      "value": {
        "leadgen_id": "123456789",
        "form_id": "987654321",
        "page_id": "806684809200027"
      }
    }]
  }]
}



📥 Fetch Full Lead Data
Use the leadgen_id to fetch full lead details:
GET /v24.0/{leadgen_id}?access_token={page-access-token}



🧼 Troubleshooting Tips
- Ensure your webhook URL is publicly accessible and responds with 200 OK
- Confirm the Page is subscribed to your app
- Use GET /{page-id}/subscribed_apps to verify
- Use GET /{page-id}/leadgen_forms to list all forms
- Make sure the form used in testing is published and belongs to the Page

NOTE: In .env file ensure that you are passing thr right USER_ACCESS_TOKEN, MONGO_URI, WEBHOOK_VERIFY_TOKEN and APP_SECRET(same token and secret you used while configuring the webhook)

Important Links: 
1. https://developers.facebook.com/apps/723073380058176/use_cases/customize/webhooks/?product_route=webhooks&business_id=2220252151716216&use_case_enum=WEBHOOKS&selected_tab=webhooks
2. https://developers.facebook.com/tools/lead-ads-testing/
3. https://developers.facebook.com/tools/explorer/?method=GET&path=me%2Faccounts&version=v24.0


Sample object stored in Mongo:
{
  "_id": {
    "$oid": "6901257d5f6b170e28817c30"
  },
  "pageId": "806684809200027",
  "__v": 0,
  "category": "Restaurant",
  "fan_count": 0,
  "lastUpdated": {
    "$date": "2025-10-28T21:32:19.702Z"
  },
  "leadForms": [
    {
      "formId": "1506172427371578",
      "locale": "en_GB",
      "name": "Test Hub Restaurant's form created on Saturday, 25 October 2025 01:12",
      "status": "ACTIVE",
      "leads": [
        {
          "leadId": "1500797147815898",
          "created_time": {
            "$date": "2025-10-28T21:32:19.701Z"
          },
          "field_data": [
            {
              "name": "FULL_NAME",
              "values": [
                "Updated Test Name"
              ],
              "_id": {
                "$oid": "69013663f1148e7fabfbcb4f"
              }
            },
            {
              "name": "EMAIL",
              "values": [
                "updated@test.com"
              ],
              "_id": {
                "$oid": "69013663f1148e7fabfbcb50"
              }
            },
            {
              "name": "PHONE",
              "values": [
                "9999999999"
              ],
              "_id": {
                "$oid": "69013663f1148e7fabfbcb51"
              }
            }
          ],
          "_id": {
            "$oid": "69013663f1148e7fabfbcb4e"
          }
        }
      ],
      "_id": {
        "$oid": "690135dbf1148e7fabfbcb27"
      }
    },
    {
      "formId": "704901109338946",
      "locale": "en_US",
      "name": "Test Hub Restaurant Form2",
      "status": "ACTIVE",
      "leads": [
        {
          "leadId": "4057351254531755",
          "created_time": {
            "$date": "2025-10-26T04:54:41.000Z"
          },
          "field_data": [
            {
              "name": "which_form_of_food_you_like_the_most",
              "values": [
                "<test lead: dummy data for which_form_of_food_you_like_the_most>"
              ],
              "_id": {
                "$oid": "690135dbf1148e7fabfbcb30"
              }
            },
            {
              "name": "email",
              "values": [
                "test@fb.com"
              ],
              "_id": {
                "$oid": "690135dbf1148e7fabfbcb31"
              }
            },
            {
              "name": "full_name",
              "values": [
                "<test lead: dummy data for full_name>"
              ],
              "_id": {
                "$oid": "690135dbf1148e7fabfbcb32"
              }
            },
            {
              "name": "phone",
              "values": [
                "<test lead: dummy data for phone>"
              ],
              "_id": {
                "$oid": "690135dbf1148e7fabfbcb33"
              }
            }
          ],
          "_id": {
            "$oid": "690135dbf1148e7fabfbcb2f"
          }
        }
      ],
      "_id": {
        "$oid": "690135dbf1148e7fabfbcb2e"
      }
    },
    {
      "formId": "1226304832640225",
      "locale": "en_US",
      "name": "Test Hub Restaurant Form1",
      "status": "ACTIVE",
      "leads": [
        {
          "leadId": "827746656318288",
          "created_time": {
            "$date": "2025-10-24T18:04:49.000Z"
          },
          "field_data": [
            {
              "name": "which_type_of_food_you_like_the_most?",
              "values": [
                "<test lead: dummy data for which_type_of_food_you_like_the_most?>"
              ],
              "_id": {
                "$oid": "690135dbf1148e7fabfbcb36"
              }
            },
            {
              "name": "email",
              "values": [
                "test@fb.com"
              ],
              "_id": {
                "$oid": "690135dbf1148e7fabfbcb37"
              }
            },
            {
              "name": "full_name",
              "values": [
                "<test lead: dummy data for full_name>"
              ],
              "_id": {
                "$oid": "690135dbf1148e7fabfbcb38"
              }
            },
            {
              "name": "phone_number",
              "values": [
                "<test lead: dummy data for phone_number>"
              ],
              "_id": {
                "$oid": "690135dbf1148e7fabfbcb39"
              }
            }
          ],
          "_id": {
            "$oid": "690135dbf1148e7fabfbcb35"
          }
        }
      ],
      "_id": {
        "$oid": "690135dbf1148e7fabfbcb34"
      }
    }
  ],
  "link": "https://www.facebook.com/806684809200027",
  "location": {
    "city": "Mysore",
    "country": "India",
    "latitude": 12.293,
    "longitude": 76.65016,
    "street": "K R Mohalla",
    "zip": "570004",
    "_id": {
      "$oid": "690135dbf1148e7fabfbcb26"
    }
  },
  "name": "Test Hub Restaurant",
  "phone": "+911122334455",
  "posts": [],
  "website": "http://testHubResto.com/"
}
