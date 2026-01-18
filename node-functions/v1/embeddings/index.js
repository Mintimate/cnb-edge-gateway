/**
 * CNB 大模型 API 代理 - Embeddings
 * 完全兼容 OpenAI 标准接口: /v1/embeddings
 */

// Logger
const LOG_PREFIX = '[Gateway-Embeddings]';
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
 * 环境变量 CNB_REPO 格式: owner/project/repo
 * 环境变量 CNB_EMBEDDINGS_PATH 必须设置 (例如: /-/ai/embeddings)
 */
function getCnbApiUrl(env) {
  const repo = env.CNB_REPO;
  const path = env.CNB_EMBEDDINGS_PATH;
  if (!repo || !path) return null;
  // 确保 repo 不包含前导或尾随斜杠，path 包含前导斜杠
  return `https://api.cnb.cool/${repo}${path}`;
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

// POST /v1/embeddings
export async function onRequestPost(context) {
  const { request, clientIp, env } = context;
  const url = new URL(request.url);

  logRequest('POST', url.pathname, url.search);

  // 1. 检查环境变量 CNB_REPO
  if (!env.CNB_REPO) {
    logError('Configuration error', 'CNB_REPO environment variable is not set');
    logResponse('embeddings', 500, { error: 'config_error', detail: 'CNB_REPO not set' });
    return errorResponse(
      'Server configuration error: CNB_REPO environment variable is not set. Please contact the administrator.',
      'server_error',
      500
    );
  }

  // 2. 检查环境变量 CNB_EMBEDDINGS_PATH (强制要求)
  if (!env.CNB_EMBEDDINGS_PATH) {
     logEvent('embeddings', clientIp, { error: 'feature_not_enabled', detail: 'CNB_EMBEDDINGS_PATH not set' });
     return errorResponse(
       'Embeddings feature is not enabled. CNB_EMBEDDINGS_PATH environment variable is required.',
       'server_error', 
       501
     );
  }

  const cnbApiUrl = getCnbApiUrl(env);
  if (!cnbApiUrl) {
       // Should be covered by above checks
       return errorResponse('Configuration Error', 'server_error', 500);
  }

  const token = extractToken(request);
  if (!token) {
    logEvent('embeddings', clientIp, { error: 'missing_token' });
    logResponse('embeddings', 401, { error: 'authentication_error' });
    return errorResponse(
      'Missing Authorization header. Please provide your CNB token as Bearer token.',
      'authentication_error',
      401
    );
  }

  try {
    const body = await request.json();
    const model = body.model || 'default';

    logEvent('embeddings', clientIp, { model, input_length: Array.isArray(body.input) ? body.input.length : 1 });

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
      logResponse('embeddings', cnbResponse.status, { error: 'upstream_error' });
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

    const data = await cnbResponse.json();

    // 兼容性处理：Cherry Studio 等客户端可能遇到 embedding 字段为字符串的情况
    // 自动检测并修复：如果 embedding 是字符串，尝试解析为 JSON 数组
    if (data && data.data && Array.isArray(data.data)) {
        let fixed = false;
        data.data.forEach(item => {
            if (item.embedding && typeof item.embedding === 'string') {
                try {
                     // 简单 heuristics：如果是 [ 开头 ] 结尾，可能是 JSON 字符串
                     const str = item.embedding.trim();
                     if (str.startsWith('[') && str.endsWith(']')) {
                         item.embedding = JSON.parse(str);
                         fixed = true;
                     } 
                } catch (e) {
                    console.warn(LOG_PREFIX, 'Compatibility: Failed to parse string embedding', e);
                }
            }
        });
        if (fixed) {
             console.log(LOG_PREFIX, 'Compatibility: Parsed stringified embedding to array to fix client unmarshal errors');
        }
    }

    logResponse('embeddings', 200, { usage: data.usage });
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    logError('Internal server error', error);
    logResponse('embeddings', 500, { error: 'server_error' });
    return errorResponse(`Internal server error: ${error.message}`, 'server_error', 500);
  }
}
