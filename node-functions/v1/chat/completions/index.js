/**
 * CNB 大模型 API 代理 - Chat Completions
 * 完全兼容 OpenAI 标准接口: /v1/chat/completions
 */

// Logger
const LOG_PREFIX = '[Gateway]';
const logRequest = (method, path, search) => console.log(LOG_PREFIX, 'Request:', { method, path, search: search || '' });
const logEvent = (event, ip, params = {}) => console.log(LOG_PREFIX, 'Event:', { event, ip, ...params });
const logResponse = (event, code, extra = {}) => console.log(LOG_PREFIX, 'Response:', { event, code, ...extra });
const logError = (message, error) => console.error(LOG_PREFIX, 'Error:', message, error?.message || error);

// CORS 响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * 获取 CNB API 地址
 * 环境变量 CNB_REPO 格式: owner/project/repo (例如: Mintimate/code-nest/cnb-edge-gateway)
 */
function getCnbApiUrl(env) {
  const repo = env.CNB_REPO;
  if (!repo) return null;
  return `https://api.cnb.cool/${repo}/-/ai/chat/completions`;
}

/**
 * 从 Authorization 头提取 Token
 */
function extractToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;
  let token = authHeader;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }
  // Remove 'sk-' prefix if present for compatibility
  if (token.startsWith('sk-')) {
    console.log(LOG_PREFIX, 'Compatibility: Removed sk- prefix from token (容错机制)');
    token = token.slice(3);
  }
  return token;
}

/**
 * 返回错误响应（OpenAI 格式）
 */
function errorResponse(message, type = 'invalid_request_error', status = 400) {
  return new Response(
    JSON.stringify({
      error: { message, type, param: null, code: null },
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    }
  );
}

// OPTIONS 预检请求
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// POST /v1/chat/completions
export async function onRequestPost(context) {
  const { request, clientIp, env } = context;
  const url = new URL(request.url);

  logRequest('POST', url.pathname, url.search);

  // 检查环境变量 CNB_REPO
  const cnbApiUrl = getCnbApiUrl(env);
  if (!cnbApiUrl) {
    logError('Configuration error', 'CNB_REPO environment variable is not set');
    logResponse('chat_completions', 500, { error: 'config_error', detail: 'CNB_REPO not set' });
    return errorResponse(
      'Server configuration error: CNB_REPO environment variable is not set. Please contact the administrator.',
      'server_error',
      500
    );
  }

  const token = extractToken(request);
  if (!token) {
    logEvent('chat_completions', clientIp, { error: 'missing_token' });
    logResponse('chat_completions', 401, { error: 'authentication_error' });
    return errorResponse(
      'Missing Authorization header. Please provide your CNB token as Bearer token.',
      'authentication_error',
      401
    );
  }

  try {
    const body = await request.json();
    const isStream = body.stream === true;
    const model = body.model || 'default';

    logEvent('chat_completions', clientIp, { model, stream: isStream, messages: body.messages?.length });

    const cnbResponse = await fetch(cnbApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(body),
    });

    if (!cnbResponse.ok) {
      const errorText = await cnbResponse.text();
      logError('CNB API error', { status: cnbResponse.status, body: errorText });
      logResponse('chat_completions', cnbResponse.status, { error: 'upstream_error' });
      try {
        const errorJson = JSON.parse(errorText);
        return new Response(JSON.stringify(errorJson), {
          status: cnbResponse.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch {
        return errorResponse(`Upstream API error: ${errorText}`, 'api_error', cnbResponse.status);
      }
    }

    if (isStream) {
      logResponse('chat_completions', 200, { type: 'stream' });
      return new Response(cnbResponse.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...corsHeaders,
        },
      });
    } else {
      const data = await cnbResponse.json();
      logResponse('chat_completions', 200, { type: 'json', usage: data.usage });
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  } catch (error) {
    logError('Internal server error', error);
    logResponse('chat_completions', 500, { error: 'server_error' });
    return errorResponse(`Internal server error: ${error.message}`, 'server_error', 500);
  }
}
