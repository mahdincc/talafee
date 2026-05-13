# Talafee API Documentation

> API Reference for Talafee Gold Price Comparison Platform

---

## Base URL

```
Production: https://api.talafee.ir/v1
Staging:    https://staging-api.talafee.ir/v1
```

## Authentication

All authenticated endpoints require a Bearer token:

```http
Authorization: Bearer <access_token>
```

---

## Endpoints

### Prices

#### Get All Prices

```http
GET /prices
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `product` | string | Filter by product (e.g., `18k-gold`, `emami-coin`) |
| `provider` | string | Filter by provider ID |
| `sort` | string | Sort by `price_asc`, `price_desc`, `name` |

**Response:**

```json
{
  "success": true,
  "data": {
    "prices": [
      {
        "id": "price_001",
        "provider": {
          "id": "taline",
          "name": "طلاین",
          "logo": "https://..."
        },
        "product": {
          "id": "18k-gold",
          "name": "طلای ۱۸ عیار"
        },
        "buyPrice": 149370000,
        "sellPrice": 148500000,
        "spread": 870000,
        "spreadPercent": 0.58,
        "change24h": 1.2,
        "updatedAt": "2026-03-20T10:30:00Z"
      }
    ],
    "meta": {
      "count": 10,
      "lastUpdate": "2026-03-20T10:30:00Z"
    }
  }
}
```

#### Get Best Price

```http
GET /prices/best
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `product` | string | Yes | Product ID |
| `type` | string | No | `buy` or `sell` (default: `buy`) |

**Response:**

```json
{
  "success": true,
  "data": {
    "product": "18k-gold",
    "type": "buy",
    "bestPrice": 149350000,
    "provider": {
      "id": "tala-bazar",
      "name": "طلابازار"
    },
    "comparison": [
      { "provider": "tala-bazar", "price": 149350000, "diff": 0 },
      { "provider": "taline", "price": 149370000, "diff": 20000 },
      { "provider": "technogold", "price": 149500000, "diff": 150000 }
    ]
  }
}
```

---

### Alerts

#### Create Alert

```http
POST /alerts
```

**Request Body:**

```json
{
  "product": "18k-gold",
  "provider": "all",
  "condition": "below",
  "targetPrice": 148000000,
  "notifyVia": ["email", "push"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "alert_abc123",
    "status": "active",
    "createdAt": "2026-03-20T10:30:00Z"
  }
}
```

#### List User Alerts

```http
GET /alerts
```

#### Delete Alert

```http
DELETE /alerts/:id
```

---

### Wallet

#### Get Wallet Balance

```http
GET /wallet/balance
```

**Response:**

```json
{
  "success": true,
  "data": {
    "cash": {
      "amount": 25500000,
      "currency": "IRR"
    },
    "gold": {
      "18k-gold": {
        "amount": 2.350,
        "unit": "gram",
        "valueIRR": 351019500
      },
      "emami-coin": {
        "amount": 1,
        "unit": "piece",
        "valueIRR": 85000000
      }
    },
    "totalValueIRR": 461519500
  }
}
```

#### Deposit

```http
POST /wallet/deposit
```

**Request Body:**

```json
{
  "amount": 50000000,
  "method": "card",
  "callbackUrl": "https://talafee.ir/payment/callback"
}
```

#### Withdraw

```http
POST /wallet/withdraw
```

**Request Body:**

```json
{
  "amount": 10000000,
  "iban": "IR060120010000001234567890"
}
```

#### Buy Gold

```http
POST /wallet/buy
```

**Request Body:**

```json
{
  "product": "18k-gold",
  "amount": 1.5,
  "maxPrice": 150000000
}
```

#### Sell Gold

```http
POST /wallet/sell
```

**Request Body:**

```json
{
  "product": "18k-gold",
  "amount": 0.5,
  "minPrice": 148000000
}
```

---

### Connected Accounts

#### List Connected Platforms

```http
GET /connected-accounts
```

**Response:**

```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": "conn_001",
        "provider": "taline",
        "status": "connected",
        "lastSync": "2026-03-20T10:25:00Z",
        "balance": {
          "gold": 5.250,
          "cash": 45000000
        }
      }
    ],
    "aggregated": {
      "totalGold": 12.850,
      "totalCash": 185000000,
      "totalValue": 2100000000
    }
  }
}
```

#### Connect Platform (Credentials)

```http
POST /connected-accounts/connect
```

**Request Body:**

```json
{
  "provider": "goldiran",
  "method": "credentials",
  "username": "user@example.com",
  "password": "encrypted_password"
}
```

#### Connect Platform (Browser Session)

```http
POST /connected-accounts/browser-session
```

**Request Body:**

```json
{
  "provider": "goldiran"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_abc123",
    "browserUrl": "https://secure.talafee.ir/browser/sess_abc123",
    "expiresAt": "2026-03-20T10:45:00Z"
  }
}
```

#### Sync Platform

```http
POST /connected-accounts/:id/sync
```

#### Disconnect Platform

```http
DELETE /connected-accounts/:id
```

---

### Fast Buy

#### Execute Fast Buy

```http
POST /fast-buy
```

**Request Body:**

```json
{
  "product": "18k-gold",
  "amount": 1.0,
  "useWallet": true,
  "maxPrice": 150000000
}
```

#### Create Target Order

```http
POST /fast-buy/target-order
```

**Request Body:**

```json
{
  "product": "18k-gold",
  "amount": 2.0,
  "targetPrice": 145000000,
  "expiresAt": "2026-03-25T00:00:00Z"
}
```

---

### Universal Payment

#### Create Payment Link

```http
POST /universal-pay/create
```

**Request Body:**

```json
{
  "merchantUrl": "https://digikala.com",
  "amount": 5000000,
  "paymentSource": "gold",
  "goldAmount": 0.033
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "موجودی کیف پول کافی نیست",
    "messageEn": "Insufficient wallet balance"
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Invalid or expired token |
| `FORBIDDEN` | Access denied |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid request data |
| `INSUFFICIENT_BALANCE` | Not enough funds |
| `PROVIDER_ERROR` | External provider error |
| `RATE_LIMITED` | Too many requests |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Price queries | 100/min |
| Wallet operations | 10/min |
| Authentication | 5/min |

---

## Webhooks

Configure webhooks in your dashboard to receive real-time notifications:

- `price.alert.triggered`
- `wallet.deposit.completed`
- `wallet.withdrawal.completed`
- `order.executed`
- `connected_account.synced`

---

*API Documentation v1.0 - Talafee*
