# Yotpo Tag for Google Tag Manager Server-Side

The **Yotpo Tag** for Google Tag Manager Server-Side sends customer, order, and loyalty action
data from your server container directly to the [Yotpo Core API](https://core-api.yotpo.com/reference/welcome)
and the [Yotpo Loyalty & Referrals API](https://loyaltyapi.yotpo.com/reference/welcome). This
server-to-server integration keeps your Yotpo data in sync without relying on client-side
scripts.

## Features

- **Server-to-Server Events**: Sends customer, order, and loyalty action data directly from the
  GTM Server Container to Yotpo, without a client-side script.
- **Two APIs, One Tag Type**: A single template covers both the Core API (Reviews, Visual UGC,
  SMSBump) and the Loyalty & Referrals API — choose the one each tag instance should target.
- **Full Action Coverage**: Create or Update a Customer, Create Order, Create Order Fulfillment,
  and Send Aggregated Order Info on Core; Create Loyalty Customer, Create Customer Action, and
  Create Order on Loyalty.
- **Custom Properties**: An optional key/value table lets you attach documented custom properties
  to a Core order (`order.custom_properties`).
- **Other/Additional Properties**: A free-text key/value table on each Customer and Order action
  lets you send fields that aren't in the main dropdown, merged straight into the payload.
- **Automatic Token Management**: Generates and caches a Core API access token, and transparently
  regenerates it if it has expired or been revoked, without an extra tag or variable.
- **Automatic Fraud-Check Data**: Auto-maps IP address and User Agent from the incoming event data
  for the two Loyalty endpoints that use them, unless you map them manually.
- **Consent Mode Support**: Checks `ad_storage` consent before sending data.
- **Optimistic Scenario**: Optionally fires `gtmOnSuccess()` without waiting for the API response.

## Core API vs Loyalty API

Each tag instance targets exactly one API. Add a second tag if you need to send to both.

| | Core API | Loyalty & Referrals API |
| :--- | :--- | :--- |
| **Powers** | Reviews, Visual UGC, SMSBump, and other Yotpo Reviews features. | The Yotpo Loyalty & Referrals program (points, VIP tiers, referrals). |
| **Credentials** | Store ID (App Key) + API Secret. | API Key (ID) + GUID. |
| **Authentication** | The tag exchanges the Store ID/Secret for a short-lived access token and sends it as the `X-Yotpo-Token` header, caching and refreshing it automatically. | The API Key and GUID are sent as `X-API-KEY` / `X-GUID` headers on every request — no token exchange. |
| **Actions** | Create or Update a Customer, Create Order, Create Order Fulfillment, Send Aggregated Order Info. | Create Loyalty Customer, Create Customer Action, Create Order. |
| **When to use** | You want customer/order data to power Reviews requests, UGC, or SMSBump. | You want customers, actions, or orders to earn points, unlock rewards, or trigger referral campaigns. |

## Installation

1. **Download the Template**: Download the `template.tpl` file from this repository.
2. **Import to GTM Server Container**: In **Templates** → **Tag Templates**, click **New**, then
   use the **three-dot menu** → **Import** to select the downloaded file.
3. **Create a New Tag**: Go to **Tags** → **New** and select the imported **Yotpo** template.

## Tag Configuration

### Base Configuration

| Parameter | Description |
| :--- | :--- |
| **Select API** | Choose **Core** or **Loyalty**. Reveals the matching credential fields and Action Selector below. |
| **Store ID (App Key)** / **API Secret** | Core credentials, used to generate an access token. Find them in your Yotpo account settings. |
| **API ID** / **GUID** | Loyalty & Referrals credentials, sent as headers on every request. Find them under **Settings → General Settings** in your Loyalty & Referrals dashboard. |
| **Use Optimistic Scenario** | Fires `gtmOnSuccess()` immediately, without waiting for the API response. |

### Action Selector

| Parameter | Description |
| :--- | :--- |
| **Core: Action** | `Create or Update a Customer`, `Create Order`, `Create Order Fulfillment`, or `Send Aggregated Order Info`. |
| **Order ID** *(Create Order Fulfillment only)* | The **Yotpo-assigned** order ID (`yotpo_id`) returned when the order was created, not the merchant's `external_id`. |
| **Loyalty: Action** | `Create Loyalty Customer`, `Create Customer Action`, or `Create Order`. |

### Parameter Tables

Each action shows a table (or two) of key/value pairs mapped to the request body. Keys for Core
tables already include the required nesting (for example `customer.external_id` or
`order.line_items`); Loyalty tables use flat keys (for example `email`). Select a key from the
dropdown, or type a dotted path (with numeric segments for array indexes, e.g.
`order.line_items.0.quantity`) to reach a field that isn't listed. Fields expecting a list — such
as **Line Items**, **Fulfilled Items**, or **Items** — need a variable that resolves to an array.
Every **Other/Additional Properties** table uses the same dotted-path format in its free-text
**Property** column — use dots for nested objects (e.g. `address.city`) and a numeric segment for
array items (e.g. `line_items.0.sku`).

| Table | Applies to | Notes |
| :--- | :--- | :--- |
| **Customer Properties** / **Other Customer Properties** | Create or Update a Customer | Identify the customer by `external_id`, or by `phone_number`/`email` alone. Other Customer Properties are merged directly onto the `customer` object (dot notation supported, e.g. `address.city`). |
| **Order Properties** / **Other Order Properties** | Create Order | `external_id`, `order_date`, and `line_items` are required. Other Order Properties are merged directly into the request body (e.g. `custom_properties.my_field`). |
| **Fulfillment Properties** | Create Order Fulfillment | `external_id`, `fulfillment_date`, `status`, and `fulfilled_items` are required. |
| **Aggregated Order Properties** / **Other Aggregated Order Properties** | Send Aggregated Order Info | Batches order, customer, and line item fields in one request. Other Aggregated Order Properties are merged directly into the request body (e.g. `purchase.custom_properties.my_field`). |
| **Customer Properties** *(Loyalty)* | Create Loyalty Customer | `email` is required. |
| **Action Properties** | Create Customer Action | `type`, `action_name`, and either `customer_email` or `customer_id` are required. `ip_address`/`user_agent` auto-map from event data when left unset. |
| **Order Properties** *(Loyalty)* / **Other Order Properties** *(Loyalty)* | Create Order | `customer_email`, `total_amount_cents`, `currency_code`, and `order_id` are required. `ip_address`/`user_agent` auto-map from event data when left unset and are used for the program's fraud checks. Other Order Properties are merged directly into the flat payload. |

### Advanced Settings

| Parameter | Description |
| :--- | :--- |
| **Ad Storage Consent** | `Send data always` (default), or abort the tag when `ad_storage` consent is not granted. |

## Open Source

The **Yotpo Tag for Google Tag Manager Server-Side** is developed and maintained by the
[Stape Team](https://stape.io/) under the Apache 2.0 license.

### GTM Gallery Status
🔴 Not listed
