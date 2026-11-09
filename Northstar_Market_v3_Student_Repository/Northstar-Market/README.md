# Northstar Market

Northstar Market is a demo online storefront with customer accounts, product reviews, carts, checkout, seller tools and support workflows.

## Development

Requires Node.js 20 or newer and a compatible C++ build toolchain for the local SQLite driver.

```bash
npm install
npm start
```

Visit http://127.0.0.1:3000. The server binds only to localhost.

Use disposable development accounts and fictional data. Run this demo only on your own development machine or an isolated classroom environment.

## Repository overview

- `routes/`: customer, orders, catalog, seller and operational features
- `lib/`: database, account sessions, and HTML helpers
- `public/`: browser assets
- `tools/`: developer checks

Use `npm run check` to validate JavaScript syntax.
