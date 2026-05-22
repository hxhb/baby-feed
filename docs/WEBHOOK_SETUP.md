# Webhook System Setup Guide

## Step-by-Step Implementation

### Step 1: Update Prisma Schema

The webhook models have been added to `prisma/schema.prisma`:

```prisma
model WebhookEndpoint { ... }
model WebhookEvent { ... }
model WebhookDelivery { ... }
```

### Step 2: Run Prisma Migration

```bash
# Generate migration
npx prisma migrate dev --name add_webhooks

# Or if using SQLite, apply changes directly
npx prisma db push
```

### Step 3: Verify Files Created

The following new files have been created:

**Core Libraries:**
- `lib/webhook-events.ts` - Event type definitions
- `lib/webhook-service.ts` - Webhook emission service
- `lib/webhook-runner.ts` - Delivery processing and retry logic

**API Routes:**
- `app/api/webhooks/route.ts` - GET/POST for webhook management
- `app/api/webhooks/[id]/route.ts` - PUT/DELETE for specific webhooks
- `app/api/webhooks/deliveries/route.ts` - Delivery logs
- `app/api/cron/webhook-runner/route.ts` - Cron job endpoint

**Modified Files:**
- `app/api/feeding/route.ts` - Emits `feeding.created`
- `app/api/feeding/[id]/route.ts` - Emits `feeding.updated` and `feeding.deleted`
- `app/api/health/route.ts` - Emits `health.created`
- `app/api/health/[id]/route.ts` - Emits `health.updated` and `health.deleted`
- `app/api/admin/users/route.ts` - Emits `user.deleted`
- `lib/validation.ts` - Added `validateUrl()` function
- `lib/rate-limit-config.ts` - Added webhook rate limits

### Step 4: Environment Variables

Add these environment variables (optional):

```bash
# Secret for cron job endpoint (optional, but recommended)
CRON_SECRET=your_random_secret_here
```

### Step 5: Set Up Cron Job

#### Option A: Vercel (if deployed to Vercel)

Update `vercel.json`:
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

#### Option B: External Cron Service

Use services like EasyCron, AWS EventBridge, or Google Cloud Scheduler to call:

```
https://your-app.com/api/cron/webhook-runner
```

Every 1-5 minutes with header:
```
Authorization: Bearer YOUR_CRON_SECRET
```

### Step 6: Test Webhook Creation

```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -H "Cookie: <your_session_cookie>" \
  -d '{
    "url": "https://webhook.site/unique-id",
    "events": ["feeding.created", "health.created"],
    "maxRetries": 5,
    "retryDelay": 60
  }'
```

Visit [webhook.site](https://webhook.site) to get a free test URL.

### Step 7: Test Event Emission

Create a feeding record through the UI or API:

```bash
curl -X POST http://localhost:3000/api/feeding \
  -H "Content-Type: application/json" \
  -H "Cookie: <your_session_cookie>" \
  -d '{
    "babyId": "baby_id_here",
    "type": "BREAST_MILK",
    "leftBreastDuration": 10,
    "rightBreastDuration": 12,
    "startTime": "2024-01-01T12:00:00Z",
    "endTime": "2024-01-01T12:30:00Z"
  }'
```

### Step 8: Check Delivery Logs

```bash
curl http://localhost:3000/api/webhooks/deliveries \
  -H "Cookie: <your_session_cookie>"
```

## Troubleshooting

### Events Not Being Queued

1. Check database connection
2. Verify webhook endpoint exists and is active
3. Check application logs for errors
4. Verify User -> WebhookEndpoint relationship in database

### Deliveries Not Being Sent

1. Verify cron job is configured and running
2. Check `WebhookDelivery` records have `status: "pending"`
3. Monitor `/api/cron/webhook-runner` for errors
4. Check endpoint URL is correct and reachable
5. Verify `X-Webhook-Signature` header calculation

### Database Migration Issues

```bash
# If migration fails
npx prisma migrate resolve --rolled-back add_webhooks

# Then try again
npx prisma migrate dev --name add_webhooks
```

## Performance Considerations

1. **Database Indexes**: WebhookEvent and WebhookDelivery queries are optimized with indexes
2. **Batch Processing**: Cron job processes up to 100 deliveries per run
3. **Cleanup**: Old events (>30 days) are automatically cleaned up
4. **Rate Limiting**: Webhook endpoints have separate rate limits

## Security Checklist

- [ ] Set `CRON_SECRET` environment variable
- [ ] Use HTTPS for all webhook URLs
- [ ] Verify webhook signatures on your endpoint
- [ ] Store webhook secrets securely
- [ ] Whitelist IPs if possible
- [ ] Monitor failed delivery attempts
- [ ] Implement idempotency on your endpoint
- [ ] Add authentication to your webhook handler

## Production Deployment

1. **Database**: Ensure webhooks tables are created with `npx prisma migrate deploy`
2. **Cron Job**: Set up production cron (Vercel, AWS EventBridge, etc.)
3. **Monitoring**: Monitor delivery failures and set up alerts
4. **Logging**: Enable detailed logging for webhook operations
5. **Testing**: Test with sample webhooks before going live
6. **Documentation**: Share webhook documentation with API consumers

## Backward Compatibility

The webhook system is fully backward compatible:
- Existing APIs unchanged
- Webhooks are opt-in (no events fire until configured)
- No performance impact if no webhooks are configured
- Can be disabled by not setting up cron job

## Next Steps

1. Read [WEBHOOKS.md](./WEBHOOKS.md) for API documentation
2. Set up test webhooks at [webhook.site](https://webhook.site)
3. Implement webhook handling on your consumer side
4. Monitor delivery logs
5. Implement monitoring/alerting for failures
