# Facebook & Instagram Lead Ads Integration

This Node.js application automates the real-time collection of leads from Facebook and Instagram Lead Ads. It integrates with the Meta Graph API and subscribes to webhooks to capture lead data instantly and store it in a MongoDB database.

## Features

- **Real-time Lead Capture**: Listens for `leadgen` webhook events from Facebook and Instagram.
- **Multi-Platform Support**: Distinguishes between leads from Facebook and Instagram.
- **Automatic Data Fetching**: Automatically retrieves full lead details from the Graph API if not provided in the webhook payload.
- **MongoDB Integration**: Stores Pages, Lead Forms, and Leads in a structured MongoDB schema.
- **Duplicate Handling**: Updates existing leads if they are edited, preventing duplicates.
- **Security**: Verifies `X-Hub-Signature` to ensure webhooks originate from Meta.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (via Mongoose)
- **API Interaction**: Axios
- **Security**: Crypto (for signature verification)

## Prerequisites

- Node.js (v14+ recommended)
- MongoDB (Local or Atlas)
- Facebook Developer Account
- Facebook App with `Leads Retrieval` and `Pages Manage Metadata` permissions.

## Installation

1.  **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd fb-graph-mongo
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Connection
MONGO_URI=mongodb://localhost:27017/fb-graph-data

# Facebook Graph API
USER_ACCESS_TOKEN=<YOUR_USER_ACCESS_TOKEN>
APP_SECRET=<YOUR_APP_SECRET>

# Webhook Configuration
WEBHOOK_VERIFY_TOKEN=<YOUR_CHOSEN_VERIFY_TOKEN>
```

### Variable Details

- `USER_ACCESS_TOKEN`: A long-lived system user or admin access token with permissions to manage pages and read leads.
- `APP_SECRET`: Your Facebook App Secret (found in App Dashboard > Basic Settings). Used for signature verification.
- `WEBHOOK_VERIFY_TOKEN`: A random string you define. You will need to enter this same string when setting up the Webhook in the Facebook Developer Portal.

## Usage

### Starting the Server

```bash
node index.js
```

The server will start on port 3000 (or the port defined in `.env`).
It will attempt to connect to MongoDB and perform an initial fetch of existing leads from the configured Page.

### Webhook Setup (Facebook Developer Portal)

1.  Go to your App Dashboard.
2.  Add the **Webhooks** product.
3.  Select **Page** from the dropdown.
4.  Click **Subscribe to this object**.
5.  **Callback URL**: `https://<your-public-domain>/webhook/facebook-leads` (You can use ngrok for local development).
6.  **Verify Token**: The value of `WEBHOOK_VERIFY_TOKEN` from your `.env`.
7.  Subscribe to the `leadgen` field.

## Testing

### Simulating an Instagram Lead

A test script is provided to simulate an incoming webhook from Instagram.

```bash
node test-instagram-webhook.js [FORM_ID] [PAGE_ID] [LEAD_ID]
```

- **Default Behavior**: Sends a mock payload to `http://localhost:3000/webhook/facebook-leads`.
- **Custom IDs**: You can optionally pass Form ID, Page ID, and Lead ID as arguments.

Example:

```bash
node test-instagram-webhook.js 12345 67890 112233
```

## API Endpoints

### `GET /webhook/facebook-leads`

Used by Facebook for Webhook verification.

- **Query Params**: `hub.mode`, `hub.verify_token`, `hub.challenge`.
- **Response**: Returns `hub.challenge` if verification succeeds.

### `POST /webhook/facebook-leads`

Receives lead generation notifications.

- **Headers**: `x-hub-signature` (HMAC SHA1 signature).
- **Body**: JSON payload containing lead changes.

## Database Schema

### Page Model

Stores information about the Facebook Page.

- `pageId`: Unique ID of the page.
- `leadForms`: Array of Lead Forms associated with the page.

### LeadForm Schema

- `formId`: Unique ID of the lead form.
- `leads`: Array of leads captured through this form.

### Lead Schema

- `leadId`: Unique ID of the lead.
- `created_time`: Timestamp of lead creation.
- `platform`: Source of the lead (`facebook` or `instagram`).
- `field_data`: Array of key-value pairs (e.g., email, full_name).

## Troubleshooting

- **Signature Verification Failed**: Ensure `APP_SECRET` in `.env` matches your Facebook App Secret exactly.
- **Webhook Verification Failed**: Ensure `WEBHOOK_VERIFY_TOKEN` matches what you entered in the Facebook Portal.
- **Mongo Connection Error**: Check if your MongoDB service is running and `MONGO_URI` is correct.
