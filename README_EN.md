# CNB Edge Gateway

EdgeOne Pages Node Functions Proxy for CNB LLM API, fully compatible with OpenAI standard interface, solving CORS issues.

English | [简体中文](./README.md)

Mirror Repositories: [CNB](https://cnb.cool/Mintimate/code-nest/cnb-edge-gateway), [GitHub](https://github.com/Mintimate/cnb-edge-gateway)

## Introduction

This project proxies the [CNB AI Chat Completions API](https://api.cnb.cool/#/operations/AiChatCompletions), converting it to OpenAI standard interface format for easy use with various OpenAI-compatible clients.

### Original CNB API

```bash
curl --request POST \
  --url https://api.cnb.cool/{repo}/-/ai/chat/completions \
  --header 'Accept: application/json' \
  --header 'Authorization: 123' \
  --header 'Content-Type: application/json' \
  --data '{
  "messages": [
    {
      "content": "string",
      "role": "string"
    }
  ],
  "model": "string",
  "stream": true
}'
```

**Authentication**: Requires CNB access token with `repo-code:r` permission, passed via `Authorization: Bearer <token>` header.

### Proxied Interface

```bash
curl --request POST \
  --url https://your-edge-pages-domain/v1/chat/completions \
  --header 'Authorization: Bearer YOUR_CNB_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
  "messages": [
    {
      "content": "string",
      "role": "string"
    }
  ],
  "model": "string",
  "stream": true
}'
```

| Comparison | Original CNB API | Proxied (OpenAI Standard) |
|------------|------------------|---------------------------|
| Endpoint | `POST /{repo}/-/ai/chat/completions` | `POST /v1/chat/completions` |
| Authentication | `Authorization: Bearer <token>` | `Authorization: Bearer <token>` (pass-through) |
| Repository Config | Specified in URL path | Configured via `CNB_REPO` environment variable |

## Features

- ✅ Fully compatible with OpenAI API standard interface
- ✅ Supports streaming responses (SSE)
- ✅ Supports all domains CORS
- ✅ Request/response logging
- ✅ Standardized error response format

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/chat/completions` | POST | Chat completions endpoint |
| `/v1/models` | GET | Models list endpoint |

## Deployment

### 1. Fork this repository

### 2. Create project in EdgeOne Pages

Connect your Git repository, EdgeOne Pages will automatically detect Node Functions.

### 3. Configure environment variables

In EdgeOne Pages console: **Project Settings → Environment Variables**, add:

| Variable | Description | Example |
|----------|-------------|---------|
| `CNB_REPO` | CNB repository path (owner/project/repo) | `Mintimate/code-nest/cnb-edge-gateway` |

### 4. Deploy

Push code or manually trigger deployment.

## Usage

### Configure OpenAI-compatible client

| Configuration | Value |
|---------------|-------|
| Base URL | `https://your-edge-pages-domain/v1` |
| API Key | Your CNB Token |


### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://your-edge-pages-domain/v1",
    api_key="YOUR_CNB_TOKEN"
)

# Streaming call
stream = client.chat.completions.create(
    model="any",
    messages=[{"role": "user", "content": "Hello!"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### JavaScript (fetch)

```javascript
const response = await fetch('https://your-edge-pages-domain/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_CNB_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    stream: true,
    messages: [{ role: 'user', content: 'Hello!' }],
  }),
});

// Handle SSE stream
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(decoder.decode(value));
}
```

## Error Responses

All error responses follow OpenAI standard format:

```json
{
  "error": {
    "message": "Error description",
    "type": "error_type",
    "param": null,
    "code": null
  }
}
```

| Status Code | Type | Description |
|-------------|------|-------------|
| 401 | `authentication_error` | Missing Authorization header |
| 500 | `server_error` | Server configuration error or internal error |

## Project Structure

```
cnb-edge-gateway/
├── node-functions/
│   └── v1/
│       ├── chat/
│       │   └── completions/
│       │       └── index.js    # POST /v1/chat/completions
│       └── models/
│           └── index.js        # GET /v1/models
└── README.md
```

## License

MIT
