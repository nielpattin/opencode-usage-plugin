# Usage Monitoring API - Quick Reference

**Curl-oriented guide for monitoring LLM API proxy usage**

---

## Base URL

```
http://127.0.0.1:8000
```

All requests require the `PROXY_API_KEY` in the Authorization header.

---

## Endpoints

### 1. Get All Usage Stats (Cached)

```bash
curl "http://127.0.0.1:8000/v1/quota-stats" \
  -H "Authorization: Bearer YOUR_PROXY_API_KEY"
```

**Query Parameters:**
- `provider` (optional) - Filter by provider name

**Example - Specific provider:**
```bash
curl "http://127.0.0.1:8000/v1/quota-stats?provider=gemini_cli" \
  -H "Authorization: Bearer YOUR_PROXY_API_KEY"
```

**Response:**
```json
{
  "providers": {
    "gemini_cli": {
      "credential_count": 3,
      "active_count": 2,
      "on_cooldown_count": 1,
      "exhausted_count": 0,
      "total_requests": 15234,
      "total_tokens": 4520192,
      "total_prompt_tokens": 3200112,
      "total_completion_tokens": 1320080,
      "total_thinking_tokens": 0,
      "total_cache_read_tokens": 51200,
      "total_cache_write_tokens": 8800,
      "approx_cost": 12.58,
      "quota_groups": {
        "gemini-2.5-pro": {
          "baseline": 1500,
          "remaining": 450,
          "resets_at": "2026-01-22T08:00:00Z"
        }
      },
      "credentials": [
        {
          "stable_id": "user@example.com",
          "display_name": "user@example.com",
          "tier": "standard-tier",
          "priority": 1,
          "active": true,
          "on_cooldown": false,
          "exhausted": false,
          "active_requests": 0,
          "total_requests": 5234,
          "total_tokens": 1523400,
          "windows": {
            "5h": {
              "request_count": 500,
              "limit": 1500,
              "remaining": 1000,
              "reset_at": "2026-01-22T08:00:00Z"
            }
          }
        }
      ]
    }
  },
  "summary": {
    "total_requests": 15234,
    "total_tokens": 4520192,
    "total_cost": 12.58
  },
  "data_source": "cache",
  "timestamp": 1737556800.0
}
```

---

### 2. Refresh Stats (Reload from Disk)

```bash
curl -X POST "http://127.0.0.1:8000/v1/quota-stats" \
  -H "Authorization: Bearer YOUR_PROXY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "reload",
    "scope": "all"
  }'
```

**Actions:**
- `reload` - Re-read data from disk (fast)
- `force_refresh` - Fetch live quota from provider API (Antigravity only)

**Scopes:**
- `all` - All providers
- `provider` - Specific provider (requires `provider` field)
- `credential` - Specific credential (requires `provider` and `credential` fields)

**Example - Reload specific provider:**
```bash
curl -X POST "http://127.0.0.1:8000/v1/quota-stats" \
  -H "Authorization: Bearer YOUR_PROXY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "reload",
    "scope": "provider",
    "provider": "antigravity"
  }'
```

**Example - Force refresh Antigravity quota:**
```bash
curl -X POST "http://127.0.0.1:8000/v1/quota-stats" \
  -H "Authorization: Bearer YOUR_PROXY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "force_refresh",
    "scope": "all"
  }'
```

---

### 3. List Available Models

```bash
curl "http://127.0.0.1:8000/v1/models" \
  -H "Authorization: Bearer YOUR_PROXY_API_KEY"
```

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "gemini/gemini-2.5-flash",
      "object": "model",
      "created": 1737556800,
      "owned_by": "gemini"
    },
    {
      "id": "openai/gpt-4o",
      "object": "model",
      "created": 1737556800,
      "owned_by": "openai"
    }
  ]
}
```

---

### 4. Get Model Details

```bash
curl "http://127.0.0.1:8000/v1/models/gemini/gemini-2.5-flash" \
  -H "Authorization: Bearer YOUR_PROXY_API_KEY"
```

**Response:**
```json
{
  "id": "gemini/gemini-2.5-flash",
  "object": "model",
  "created": 1737556800,
  "owned_by": "gemini",
  "input_cost_per_token": 0.0000005,
  "output_cost_per_token": 0.0000015,
  "max_input_tokens": 1048576,
  "max_output_tokens": 8192,
  "context_window": 1048576
}
```

---

### 5. List Providers

```bash
curl "http://127.0.0.1:8000/v1/providers" \
  -H "Authorization: Bearer YOUR_PROXY_API_KEY"
```

**Response:**
```json
{
  "providers": [
    {
      "name": "gemini",
      "enabled": true,
      "credentials": 3
    },
    {
      "name": "openai",
      "enabled": true,
      "credentials": 2
    },
    {
      "name": "antigravity",
      "enabled": true,
      "credentials": 1
    }
  ]
}
```

---

### 6. Proxy Health Check

```bash
curl "http://127.0.0.1:8000/"
```

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-01-22T12:00:00Z"
}
```

---

## Monitoring Scripts

### Bash - Check All Credentials

```bash
#!/bin/bash

PROXY_KEY="YOUR_PROXY_API_KEY"
PROXY_URL="http://127.0.0.1:8000"

echo "=== Credential Status ==="
curl -s "$PROXY_URL/v1/quota-stats" \
  -H "Authorization: Bearer $PROXY_KEY" | jq '.providers | to_entries[] | {
    provider: .key,
    total: .value.credential_count,
    active: .value.active_count,
    cooldown: .value.on_cooldown_count,
    exhausted: .value.exhausted_count,
    requests: .value.total_requests,
    cost: .value.approx_cost
  }'
```

### Bash - Alert on Low Quota

```bash
#!/bin/bash

PROXY_KEY="YOUR_PROXY_API_KEY"
PROXY_URL="http://127.0.0.1:8000"
THRESHOLD=100  # Alert if < 100 requests remaining

# Get stats and check each credential window
curl -s "$PROXY_URL/v1/quota-stats" \
  -H "Authorization: Bearer $PROXY_KEY" | jq -r '
    .providers as $providers |
    to_entries[] |
    select(.value.credentials != null) |
    .value.credentials[]? |
    select(.windows."5h".remaining < $THRESHOLD) |
    "\(.stable_id): \(.windows."5h".remaining) requests remaining"
  '
```

### Python - Simple Monitor

```python
import requests
import json

PROXY_KEY = "YOUR_PROXY_API_KEY"
PROXY_URL = "http://127.0.0.1:8000"

headers = {"Authorization": f"Bearer {PROXY_KEY}"}

def get_usage_stats():
    resp = requests.get(f"{PROXY_URL}/v1/quota-stats", headers=headers)
    return resp.json()

def print_summary(stats):
    for provider, data in stats["providers"].items():
        print(f"\n{provider.upper()}")
        print(f"  Credentials: {data['credential_count']}")
        print(f"  Active: {data['active_count']}")
        print(f"  Cooldown: {data['on_cooldown_count']}")
        print(f"  Requests: {data['total_requests']:,}")
        print(f"  Cost: ${data['approx_cost']:.2f}")

        for cred in data.get("credentials", []):
            window = cred.get("windows", {}).get("5h", {})
            remaining = window.get("remaining", "N/A")
            print(f"    {cred['display_name']}: {remaining} remaining (5h)")

if __name__ == "__main__":
    stats = get_usage_stats()
    print_summary(stats)
```

---

## Response Fields Reference

### Credential Level

| Field | Type | Description |
|-------|------|-------------|
| `stable_id` | string | Email (OAuth) or hash (API key) |
| `display_name` | string | Human-readable name |
| `tier` | string | Tier name (e.g., "standard-tier") |
| `priority` | int | Priority (1 = highest) |
| `active` | bool | Currently available for use |
| `on_cooldown` | bool | In cooldown period |
| `exhausted` | bool | Marked exhausted in fair cycle |
| `active_requests` | int | Currently in-flight requests |
| `total_requests` | int | Total all-time requests |
| `total_tokens` | int | Total tokens used |
| `total_prompt_tokens` | int | Prompt tokens |
| `total_completion_tokens` | int | Completion tokens |
| `total_thinking_tokens` | int | Thinking tokens |
| `total_cache_read_tokens` | int | Cached prompt reads |
| `total_cache_write_tokens` | int | Cache writes |
| `windows` | object | Time-windowed stats |

### Window Level

| Field | Type | Description |
|-------|------|-------------|
| `request_count` | int | Requests in this window |
| `limit` | int | Max requests (null = unlimited) |
| `remaining` | int | Requests left |
| `reset_at` | string | ISO timestamp when window resets |

### Provider Level

| Field | Type | Description |
|-------|------|-------------|
| `credential_count` | int | Total credentials |
| `active_count` | int | Available for use |
| `on_cooldown_count` | int | In cooldown |
| `exhausted_count` | int | Marked exhausted |
| `total_requests` | int | All requests across credentials |
| `approx_cost` | float | Approximate USD cost |
| `quota_groups` | object | Provider-specific quota data (Antigravity) |

---

## Common Patterns

### Refresh Every Minute

```bash
while true; do
  curl -X POST "http://127.0.0.1:8000/v1/quota-stats" \
    -H "Authorization: Bearer YOUR_PROXY_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"action":"reload","scope":"all"}' | jq '.summary'
  sleep 60
done
```

### Single Provider Watch

```bash
watch -n 5 'curl -s "http://127.0.0.1:8000/v1/quota-stats?provider=antigravity" \
  -H "Authorization: Bearer YOUR_PROXY_API_KEY" | jq ".providers.antigravity"'
```

### Export to CSV

```bash
curl -s "http://127.0.0.1:8000/v1/quota-stats" \
  -H "Authorization: Bearer YOUR_PROXY_API_KEY" | jq -r '
    .providers | to_entries[] | .value.credentials[]? |
    [.stable_id, .tier, .total_requests, .total_tokens, .approx_cost] |
    @csv
  '
```
