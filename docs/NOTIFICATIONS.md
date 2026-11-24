# SAJE notifications — deployment checklist

SAJE has one restaurant configuration. Notifications are shared by the customer mobile app, staff mobile app and admin web app.

## Provider configuration

### Expo push (iOS and Android)
1. Create/confirm the EAS project for both Expo apps.
2. Set the same EAS project ID in both app build environments as `EXPO_PUBLIC_EAS_PROJECT_ID`.
3. Configure APNs credentials for the iOS bundle IDs in Expo/EAS.
4. Configure Firebase Cloud Messaging credentials for Android in Expo/EAS.
5. Build and install development/production binaries. Push notifications must be tested on physical devices; Expo Go is not a production push test.

### Browser push (admin web)
1. Generate a VAPID public/private key pair.
2. Set `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` to the public key in the web build environment.
3. Set `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_JWK` and `WEB_PUSH_VAPID_SUBJECT` as server-side Cloudflare Worker secrets/variables.
4. Deploy the `dev` branch and sign in as a staff account with access to Admin → Notifications. Choose **Enable browser alerts** and allow browser permission.
5. Do not expose the private JWK in a `NEXT_PUBLIC_*` variable or commit it.

## Durable retry dispatcher

Order-status events are written to the PostgreSQL notification outbox. The request path attempts immediate delivery; failed/pending outbox events can be retried by the protected dispatcher.

Set a random secret of at least 32 characters as the Cloudflare Worker secret `NOTIFICATION_CRON_SECRET`. Add the same value as a GitHub Actions repository secret named `NOTIFICATION_CRON_SECRET`. Optionally set the GitHub Actions repository variable `SAJE_API_URL`; otherwise the retry workflow uses the SAJE Worker URL.

The GitHub Actions workflow `.github/workflows/notifications-retry.yml` calls the dispatcher every five minutes. It can also be run manually. If the secret is not configured, the scheduled step is skipped.

## Database

The notification schema migration is in `packages/database/prisma/migrations/20261124154000_notifications` and the guest notification extension is in `20261124161000_guest_notifications`. Apply migrations to the development database first, verify, then separately plan production migration. Do not apply production migrations as part of a code deployment.

## Operational checks

- Confirm in-app notifications still load when push permission is denied.
- Confirm Expo tickets are accepted for iOS and Android physical devices.
- Confirm browser push appears with the admin tab closed and click opens the notifications page.
- Confirm invalid Expo tokens and expired Web Push endpoints are disabled.
- Confirm a failed outbox event retries and becomes processed.
- Confirm staff only receive notifications allowed by their roles and preferences.
