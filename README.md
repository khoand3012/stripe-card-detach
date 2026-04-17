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

Those values are stored in browser local storage and sent to the local Next.js API route when you start a detachment run.

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
