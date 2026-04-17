# Detach PM

Next.js web app for detaching Stripe payment methods through a browser UI.

## Stack

- Next.js 16.2.4
- React 19.2.0
- TypeScript
- Stripe Node SDK 22.0.2
- Axios

## Requirements

- Node.js 24

## Run

```bash
yarn install
yarn dev
```

Open `http://localhost:3000`.

## Build

```bash
yarn build
yarn start
```

## Config

The web app has a dedicated `Config` tab where you can enter:

- API endpoint
- Request ID
- Stripe secret key

The API endpoint and request ID are stored in browser local storage. The Stripe secret key is not stored there; keep it in memory for the current session or save it with your browser password manager.

You can also keep fallback values in `.env`:

```env
API_GATEWAY=https://your-api-endpoint/payment/payment-methods
REQUEST_ID=your-request-id
STRIPE_SK=your-stripe-secret-key
```

## Project Layout

```text
pages/
   api/detach.ts    Next.js API route for the detach flow
   _app.tsx         Global app wrapper
   index.tsx        Main web UI
services/
   cryptography.ts  Encryption helpers
   detach.ts        Server-side detach workflow
styles/
   globals.css      Tailwind entry and global styles
```
