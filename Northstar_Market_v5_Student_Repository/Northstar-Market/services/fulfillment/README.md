# Fulfillment Service

This optional internal service handles shipping status, carrier integrations, return requests, label previews, and partner lookup for Northstar Market.

## Local development

Use Python 3.11+ and create a virtual environment. Install the packages in `requirements.txt`, then start `app.py`.

The local development service listens on `http://127.0.0.1:5051`. It uses fictional shipment records and an isolated SQLite database under `data/`.

## Service modules

- Order and shipment status
- Carrier and partner integrations
- Shipping paperwork and label handling
- Returns and operations views

This service is only for local development, not internet deployment.
