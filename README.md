# Yotpo Tag for Google Tag Manager Server Side

Send customer, review, and loyalty signals to Yotpo's Core and Loyalty APIs directly from your sGTM container.

## How to use Yotpo Tag

1. **Choose API Type:** Select either **Core** or **Loyalty**.
   - **Core API:** Requires your Store ID (App Key) and API Secret.
   - **Loyalty API:** Requires your API ID and GUID.
2. **Select an Action:**
   - **Core Actions:** Create or Update a Customer, Create Order, Create Order Fulfillment, or Send Aggregated Order Info.
   - **Loyalty Actions:** Create Loyalty Customer, Create Customer Action, or Create Order.
3. **Map Parameters:** Use the built-in tables to map your server-side event data to the corresponding Yotpo properties (e.g., customer details, order IDs, or line items).
4. **Advanced Settings (Optional):**
   - **Use Optimistic Scenario:** Speeds up server response time by returning a success status without waiting for the API response.
   - **Tag Execution Consent:** Restrict tag firing to instances where marketing consent (`ad_storage`) is granted.

## Open Source

Yotpo Tag for Google Tag Manager Server Side is developed and maintained by [Stape Team](https://stape.io/) under the Apache 2.0 license.
