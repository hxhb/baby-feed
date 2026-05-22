# Webhook System Documentation

## Overview

The baby-feed application includes a complete webhook system that allows external applications to receive real-time notifications when baby health and feeding records are created, updated, or deleted.

## Event Types

The following events are supported:

### Feeding Record Events
- `feeding.created` - Triggered when a new feeding record is created
- `feeding.updated` - Triggered when a feeding record is updated
- `feeding.deleted` - Triggered when a feeding record is deleted

### Health Record Events
- `health.created` - Triggered when a new health record is created
- `health.updated` - Triggered when a health record is updated
- `health.deleted` - Triggered when a health record is deleted

### User Events
- `user.deleted` - Triggered when an admin deletes a user (admin-only event)

## Setting Up Webhooks

### 1. Create a Webhook Endpoint

Send a POST request to `/api/webhooks`:

```bash
curl -X POST https://your-app.com/api/webhooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "url": "https://your-service.com/webhook-handler",
    "description": "My webhook endpoint",
    "events": [
      "feeding.created",
      "feeding.updated",
      "health.created"
    ],
    "maxRetries": 5,
    "retryDelay": 60
  }'
```

**Response:**
```json
{
  "id": "webhook_abc123",
  "url": "https://your-service.com/webhook-handler",
  "description": "My webhook endpoint",
  "events": ["feeding.created", "feeding.updated", "health.created"],
  "secret": "whk_abc123def456...",
  "active": true,
  "maxRetries": 5,
  "retryDelay": 60,
  "createdAt": "2024-01-01T12:00:00Z"
}
```

**Save the `secret`** - you'll need it to verify webhook signatures!

### 2. Subscribe to All Events

To receive all available events, use `"*"` in the events array:

```json
{
  "url": "https://your-service.com/webhook-handler",
  "events": ["*"],
  "maxRetries": 5,
  "retryDelay": 60
}
```

### 3. List Your Webhooks

```bash
curl https://your-app.com/api/webhooks \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### 4. Update a Webhook

```bash
curl -X PUT https://your-app.com/api/webhooks/webhook_abc123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{
    "events": ["feeding.created", "health.created", "health.updated"],
    "active": true
  }'
```

### 5. Delete a Webhook

```bash
curl -X DELETE https://your-app.com/api/webhooks/webhook_abc123 \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## Webhook Payload Structure

All webhook payloads have this structure:

```typescript
{
  id: string,              // Unique event ID
  type: string,            // Event type (e.g., "feeding.created")
  timestamp: string,       // ISO 8601 datetime
  userId: string,          // User ID who initiated the action
  data: {
    // Event-specific data
  }
}
```

## Event Payload Examples

### feeding.created

```json
{
  "id": "evt_abc123",
  "type": "feeding.created",
  "timestamp": "2024-01-01T12:30:45Z",
  "userId": "user_123",
  "data": {
    "recordId": "feed_abc123",
    "babyId": "baby_123",
    "type": "BREAST_MILK",
    "leftBreastDuration": 10,
    "rightBreastDuration": 12,
    "startTime": "2024-01-01T12:00:00Z",
    "endTime": "2024-01-01T12:30:00Z",
    "notes": "Fed baby",
    "createdAt": "2024-01-01T12:30:45Z",
    "baby": {
      "id": "baby_123",
      "name": "小明",
      "birthDate": "2024-01-01T00:00:00Z",
      "gender": "M"
    }
  }
}
```

### feeding.updated

```json
{
  "id": "evt_abc124",
  "type": "feeding.updated",
  "timestamp": "2024-01-01T13:00:00Z",
  "userId": "user_123",
  "data": {
    "recordId": "feed_abc123",
    "babyId": "baby_123",
    "type": "BREAST_MILK",
    "changes": {
      "rightBreastDuration": {
        "old": 12,
        "new": 15
      },
      "notes": {
        "old": "Fed baby",
        "new": "Fed baby - very hungry"
      }
    },
    "leftBreastDuration": 10,
    "rightBreastDuration": 15,
    "startTime": "2024-01-01T12:00:00Z",
    "endTime": "2024-01-01T12:30:00Z",
    "notes": "Fed baby - very hungry",
    "updatedAt": "2024-01-01T13:00:00Z",
    "baby": {
      "id": "baby_123",
      "name": "小明"
    }
  }
}
```

### feeding.deleted

```json
{
  "id": "evt_abc125",
  "type": "feeding.deleted",
  "timestamp": "2024-01-01T13:30:00Z",
  "userId": "user_123",
  "data": {
    "recordId": "feed_abc123",
    "babyId": "baby_123",
    "type": "BREAST_MILK",
    "startTime": "2024-01-01T12:00:00Z",
    "endTime": "2024-01-01T12:30:00Z",
    "deletedAt": "2024-01-01T13:30:00Z"
  }
}
```

### health.created

```json
{
  "id": "evt_abc126",
  "type": "health.created",
  "timestamp": "2024-01-01T14:00:00Z",
  "userId": "user_123",
  "data": {
    "recordId": "health_abc123",
    "babyId": "baby_123",
    "type": "WEIGHT",
    "weight": 6.5,
    "recordedAt": "2024-01-01T10:00:00Z",
    "createdAt": "2024-01-01T14:00:00Z",
    "baby": {
      "id": "baby_123",
      "name": "小明",
      "birthDate": "2024-01-01T00:00:00Z",
      "gender": "M"
    }
  }
}
```

### user.deleted (admin event)

```json
{
  "id": "evt_abc127",
  "type": "user.deleted",
  "timestamp": "2024-01-01T15:00:00Z",
  "userId": "admin_user_id",
  "data": {
    "userId": "deleted_user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "babiesCount": 2,
    "feedingRecordsCount": 150,
    "healthRecordsCount": 45,
    "deletedAt": "2024-01-01T15:00:00Z"
  }
}
```

## Webhook Signature Verification

All webhook requests include an HMAC-SHA256 signature in the `X-Webhook-Signature` header. Verify the signature to ensure the webhook is authentic:

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingsSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

app.post('/webhook-handler', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
  res.send('OK');
});
```

## Webhook Headers

Each webhook request includes the following headers:

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `X-Webhook-Signature` | HMAC-SHA256 signature |
| `X-Webhook-Event-Type` | Event type (e.g., `feeding.created`) |
| `X-Webhook-Event-ID` | Unique event ID |
| `X-Webhook-Delivery-ID` | Unique delivery ID |
| `X-Webhook-Timestamp` | ISO 8601 timestamp |

## Retry Policy

If your webhook endpoint returns a non-2xx status code or times out, the system will retry according to your configuration:

- **Max Retries**: How many times to retry (0-10)
- **Retry Delay**: Base delay between retries in seconds (10-3600)
- **Exponential Backoff**: Each retry doubles the delay, capped at 24 hours

Example with maxRetries=5, retryDelay=60:
- 1st attempt: immediate
- 2nd attempt: +60 seconds
- 3rd attempt: +120 seconds
- 4th attempt: +240 seconds
- 5th attempt: +480 seconds
- 6th attempt (if needed): +960 seconds (capped)

## Monitoring Webhook Deliveries

### Get Delivery Logs

```bash
curl "https://your-app.com/api/webhooks/deliveries?endpointId=webhook_abc123&status=failed" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

**Query Parameters:**
- `endpointId` - Filter by specific webhook endpoint
- `status` - Filter by delivery status: `pending`, `success`, `failed`, `timeout`
- `limit` - Number of results (default 50, max 100)
- `offset` - Pagination offset (default 0)

**Response:**
```json
{
  "deliveries": [
    {
      "id": "del_abc123",
      "eventId": "evt_abc123",
      "status": "success",
      "httpStatus": 200,
      "attemptNumber": 1,
      "sentAt": "2024-01-01T12:30:46Z",
      "respondedAt": "2024-01-01T12:30:47Z",
      "createdAt": "2024-01-01T12:30:45Z",
      "event": {
        "id": "evt_abc123",
        "type": "feeding.created",
        "recordId": "feed_abc123",
        "recordType": "FeedingRecord"
      },
      "endpoint": {
        "id": "webhook_abc123",
        "url": "https://your-service.com/webhook-handler"
      }
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 50
}
```

## Cron Job Setup

The webhook delivery system requires a background cron job to process pending deliveries and retries.

### Vercel Cron

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/webhook-runner",
      "schedule": "*/2 * * * *"
    }
  ]
}
```

### AWS EventBridge / External Cron

Call the endpoint every 1-5 minutes:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-app.com/api/cron/webhook-runner
```

Set `CRON_SECRET` environment variable to secure the endpoint.

## Best Practices

1. **Verify Signatures**: Always verify webhook signatures on your endpoint
2. **Idempotency**: Design your webhook handler to be idempotent (safe to replay)
3. **Fast Response**: Respond quickly to webhook requests (< 5 seconds)
4. **Retry Handling**: Monitor and handle delivery failures
5. **Logging**: Log all webhook events for debugging
6. **Security**: Use HTTPS only, validate event data before processing
7. **Dead Letter Queue**: After max retries, store failed events for manual investigation

## Troubleshooting

### Webhooks Not Firing

1. Check webhook is active: `GET /api/webhooks` -> `active: true`
2. Verify event type is in `events` array or `events` contains `"*"`
3. Check cron job is running: monitor `/api/cron/webhook-runner` logs
4. Verify endpoint is reachable from server

### Delivery Failures

1. Check delivery logs: `GET /api/webhooks/deliveries?status=failed`
2. Verify your endpoint returns 2xx status code
3. Check response timeout (10 seconds)
4. Verify signature verification logic
5. Check webhook secret hasn't changed

### Missing Events

1. Verify event type in webhook's events list
2. Check user has permission to create/update records
3. Verify webhook was created before the event occurred
4. Check application logs for errors

## Rate Limiting

Webhook management endpoints have the following rate limits:

- **List webhooks**: 60 requests per minute
- **Create webhook**: 10 requests per 10 minutes
- **Update webhook**: 20 requests per 10 minutes
- **Delete webhook**: 10 requests per 10 minutes
- **List deliveries**: 60 requests per minute

## API Reference

### POST /api/webhooks
Create a new webhook endpoint

### GET /api/webhooks
List all webhook endpoints

### PUT /api/webhooks/:id
Update a webhook endpoint

### DELETE /api/webhooks/:id
Delete a webhook endpoint

### GET /api/webhooks/deliveries
Get delivery logs

### GET /api/cron/webhook-runner
Process pending deliveries (requires CRON_SECRET or Vercel)
