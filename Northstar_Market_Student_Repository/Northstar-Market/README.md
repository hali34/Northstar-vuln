# Northstar Market

Northstar Market is a sample online storefront with a customer account area, orders, product reviews, discount codes, seller branding, downloadable statements, and a support console. It is intended for local, authorized development and review.

## Requirements

Node.js 20 or newer, npm, and a local machine capable of building `better-sqlite3`.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`. The SQLite database is created in `runtime/` on first startup.

## Demo accounts

| Account | Password | Access |
|---|---|---|
| `alex@example.test` | `Welcome123!` | Customer |
| `blair@example.test` | `Welcome123!` | Customer |
| `seller@example.test` | `Welcome123!` | Seller |
| `support@example.test` | `Welcome123!` | Support |

All fixtures and account details are fictional. No payment processing or real external services are configured. Use this application only on localhost or an isolated lab network; do not expose it to the public internet.

## Structure

- `server.js` — application entry point
- `lib/` — database, sessions, presentation helpers
- `routes/` — storefront, account, orders, seller and support
- `public/` — browser assets
- `views/` — site templates

The demo data can be reset by deleting the `runtime/` directory while the server is stopped.
