# Smag Business App

React Native (Expo Router) app for Smag staff, drivers, kitchen owners, and concierge/support.

## How to Register

### As a Driver
1. Open the app → tap **Driver** tab on the login screen
2. Fill in your details and submit
3. Admin reviews your application in **Smag Admin → Kitchens tab**
4. Once approved, you receive a setup email with a link to set your password
5. Tap the link → set password → sign in → Driver Dashboard

### As a Kitchen Owner
1. Open the app → tap **Kitchen** tab on the login screen
2. Fill in your restaurant details and submit
3. Admin reviews in **Smag Admin → Kitchens tab**
4. Once approved, your restaurant appears in the Smag customer app under **Other Kitchens**
5. You receive a setup email → set password → sign in → Kitchen Owner Dashboard

### As an Employee (Kitchen Staff, Concierge, Manager)
1. Admin adds you in **Smag Admin → Employees tab**
2. Setup email is sent automatically
3. Tap the link → set password → sign in → role-appropriate dashboard

---

## Roles & Interfaces

| Role | Interface | Key Features |
|---|---|---|
| Driver | `/(app)/driver` | Assigned orders, status updates, live GPS map |
| Kitchen Staff (Smag) | `/(app)/kitchen-staff` | All incoming orders, mark preparing/ready |
| Kitchen Owner (Other Kitchens) | `/(app)/kitchen-owner` | Orders + menu management + restaurant profile |
| Concierge/Support | `/(app)/concierge` | VIP chat sessions, reply to users |
| Manager | `/(app)/manager` | All orders + team overview |

---

## Screens

- `/(auth)/login` — Sign in + Driver registration + Kitchen registration
- `/(auth)/setup` — Password setup from invite email link
- `/(app)/home` — Role detection, routes to correct dashboard
- `/(app)/driver` — Driver order management + GPS tracking
- `/(app)/driver-map` — Live navigation map with route + position broadcast
- `/(app)/kitchen-staff` — Smag kitchen order queue
- `/(app)/kitchen-owner` — Kitchen owner orders + menu + profile editor
- `/(app)/kitchen-profile` — Edit restaurant name, cuisine, hours, delivery fee, image
- `/(app)/concierge` — VIP support chat
- `/(app)/manager` — Full order management + team view

---

## Setup

```bash
cp .env.example .env
# Fill in Firebase credentials (same project as smag and smag_admin)
npm install
npm start
```

## Required Firebase setup

1. **Trigger Email Extension** — see `smag/docs/email-setup.md`
2. **Google Maps API Key** — add to `.env` as `GOOGLE_MAPS_API_KEY`
3. **Expo Push Notifications** — handled automatically on first sign-in

## Environment variables

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
GOOGLE_MAPS_API_KEY=
```

## Firestore collections used

| Collection | Purpose |
|---|---|
| `employees` | Staff profiles with `uid` after invite accepted |
| `kitchen_owners` | Kitchen owner profiles with `restaurantId` |
| `driver_applications` | Driver signup submissions |
| `kitchen_applications` | Kitchen signup submissions |
| `orders` | All orders — updated by drivers/kitchen staff |
| `external_restaurants` | Kitchen owner restaurant profiles |
| `external_menu_items` | Menu items managed by kitchen owners |
| `vip_chat_sessions` | Support chat sessions for concierge |
| `vip_chat_sessions/{id}/messages` | Individual chat messages |
