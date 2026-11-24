# SAJE Staff mobile app

A separate Expo application for restaurant staff. It shares the SAJE backend and staff accounts with the web admin; it does not introduce a second database or identity system.

## Run locally

```powershell
cd apps/staff-mobile
npm install
npx expo start
```

Set `EXPO_PUBLIC_API_URL` when testing against a non-production API. The default points to the existing SAJE Cloudflare Worker.

## Initial foundation

- Staff-only sign-in using existing SAJE credentials.
- Server-validated staff session and role/permission loading.
- Role-aware landing workspace for managers, waiters, kitchen and cashiers.
- Live open-order list from the shared database.
- Separate native identifiers: `com.saje.staff` (iOS and Android).

## Security note

This initial client stores the opaque session token in AsyncStorage to establish the end-to-end flow. Before distributing production builds, replace this with Expo SecureStore, add session revocation/rotation policy and device logout controls. Every protected API request is independently authenticated and role-checked on the server.
