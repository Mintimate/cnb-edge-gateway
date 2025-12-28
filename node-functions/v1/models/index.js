/**
 * CNB 大模型 API 代理 - Models
 * 完全兼容 OpenAI 标准接口: /v1/models
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
 * 获取 CNB Models API 地址
 * 环境变量 CNB_REPO 格式: owner/project/repo (例如: Mintimate/code-nest/cnb-edge-gateway)
 * 环境变量 CNB_AI_PATH 可自定义 AI 路径，默认为 /-/ai/models
 */
function getCnbModelsUrl(env) {
  const repo = env.CNB_REPO;
  if (!repo) return null;
  const aiPath = env.CNB_AI_PATH || '/-/ai/models';
  return `https://api.cnb.cool/${repo}${aiPath}`;
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

// GET /v1/models
export async function onRequestGet(context) {
  const { request, clientIp, env } = context;
  const url = new URL(request.url);

  logRequest('GET', url.pathname, url.search);

  // 检查环境变量 CNB_REPO
  const cnbModelsUrl = getCnbModelsUrl(env);
  if (!cnbModelsUrl) {
    logError('Configuration error', 'CNB_REPO environment variable is not set');
    logResponse('models', 500, { error: 'config_error', detail: 'CNB_REPO not set' });
    return errorResponse(
      'Server configuration error: CNB_REPO environment variable is not set. Please contact the administrator.',
      'server_error',
      500
    );
  }

  const token = extractToken(request);
  if (!token) {
    logEvent('models', clientIp, { error: 'missing_token' });
    logResponse('models', 401, { error: 'authentication_error' });
    return errorResponse('Missing Authorization header.', 'authentication_error', 401);
  }

  logEvent('models', clientIp);

  try {
    const cnbResponse = await fetch(cnbModelsUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    // 检查响应是否为 JSON 格式
    const contentType = cnbResponse.headers.get('Content-Type') || '';
    const isJson = contentType.includes('application/json');

    if (!cnbResponse.ok || !isJson) {
      // CNB 不支持 models 接口或返回非 JSON 时，返回默认响应
      logResponse('models', 200, { type: 'fallback', reason: !cnbResponse.ok ? 'not_ok' : 'not_json' });
      return new Response(
        JSON.stringify({
          object: 'list',
          data: [
            {
              id: 'hunyuan-2.0-instruct',
              object: 'model',
              created: Math.floor(Date.now() / 1000),
              owned_by: 'cnb',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const data = await cnbResponse.json();
    logResponse('models', 200, { count: data.data?.length });
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    // 任何异常都返回 fallback 响应
    logError('Fallback due to error', error);
    logResponse('models', 200, { type: 'fallback', reason: 'error' });
    return new Response(
      JSON.stringify({
        object: 'list',
        data: [
          {
            id: 'hunyuan-2.0-instruct',
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: 'cnb',
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}
