# Northstar Market

A sample e-commerce storefront and merchant portal built with Node.js, Express, SQLite and browser-side JavaScript.

## Development

Requires Node.js 20 or newer and a C++ build toolchain supported by `better-sqlite3`.

```bash
npm install
npm start
```

Open http://127.0.0.1:3000. The application binds to localhost.

For application syntax checks: `npm run check`.

Use fake data and disposable test accounts. This project is only for isolated classroom development; do not publish it as a hosted service.

## Repository structure

- `routes/`: customer accounts, catalog, checkout, orders, merchant and staff workflows
- `lib/`: data, account and rendering utilities
- `public/`: browser assets
- `views/`: page layout
- `tools/`: developer checks

## Fulfillment service

The `services/fulfillment/` folder contains a separate Python service for shipment tracking, merchant returns, label handling, and partner integrations. It is optional when running the main storefront locally. See its README for development requirements.
