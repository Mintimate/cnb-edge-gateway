# CNB Edge Gateway

基于 EdgeOne Pages Node Functions 的 CNB 大模型 API 代理，完全兼容 OpenAI 标准接口，解决跨域问题。

[English](./README_EN.md) | 简体中文

## 简介

本项目中继 [CNB AI Chat Completions API](https://api.cnb.cool/#/operations/AiChatCompletions)，将其转换为 OpenAI 标准接口格式，方便在各种 OpenAI 兼容客户端中使用。

### 原始 CNB API

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

**认证方式**: 需要 CNB 访问令牌，包含 `repo-code:r` 权限，通过 `Authorization: Bearer <token>` 头传递。

### 代理后的接口

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

| 对比项 | 原始 CNB API | 代理后 (OpenAI 标准) |
|-------|-------------|---------------------|
| 接口路径 | `POST /{repo}/-/ai/chat/completions` | `POST /v1/chat/completions` |
| 认证方式 | `Authorization: Bearer <token>` | `Authorization: Bearer <token>` (透传) |
| 仓库配置 | URL 路径中指定 | 通过环境变量 `CNB_REPO` 配置 |

## 功能特性

- ✅ 完全兼容 OpenAI API 标准接口
- ✅ 支持流式响应 (SSE)
- ✅ 支持所有域名跨域 (CORS)
- ✅ 请求/响应日志记录
- ✅ 标准化错误响应格式

## 接口说明

| 接口 | 方法 | 说明 |
|------|------|------|
| `/v1/chat/completions` | POST | 聊天补全接口 |
| `/v1/models` | GET | 模型列表接口 |

## 部署

### 1. Fork 本仓库

### 2. 在 EdgeOne Pages 创建项目

连接你的 Git 仓库，EdgeOne Pages 会自动识别 Node Functions。

### 3. 配置环境变量

在 EdgeOne Pages 控制台：**项目设置 → 环境变量** 中添加：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `CNB_REPO` | CNB 仓库路径 (owner/project/repo) | `Mintimate/code-nest/cnb-edge-gateway` |

### 4. 部署

推送代码或手动触发部署。

## 使用方式

### 配置 OpenAI 兼容客户端

| 配置项 | 值 |
|--------|-----|
| Base URL | `https://your-edge-pages-domain/v1` |
| API Key | 你的 CNB Token |


### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://your-edge-pages-domain/v1",
    api_key="YOUR_CNB_TOKEN"
)

# 流式调用
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

// 处理 SSE 流
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(decoder.decode(value));
}
```

## 错误响应

所有错误响应遵循 OpenAI 标准格式：

```json
{
  "error": {
    "message": "错误描述",
    "type": "error_type",
    "param": null,
    "code": null
  }
}
```

| 状态码 | 类型 | 说明 |
|--------|------|------|
| 401 | `authentication_error` | 缺少 Authorization 头 |
| 500 | `server_error` | 服务器配置错误或内部错误 |

## 项目结构

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
