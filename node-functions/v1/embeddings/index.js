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
 */
function getCnbApiUrl(env) {
  const repo = env.CNB_REPO;
  const path = env.CNB_EMBEDDINGS_PATH;
  if (!repo || !path) return null;
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
  if (token.startsWith('sk-')) {
    token = token.slice(3);
  }
  return token;
}

function errorResponse(message, type = 'invalid_request_error', status = 400) {
  return new Response(
    JSON.stringify({ error: { message, type, param: null, code: null } }),
    { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

// 处理单个 Embedding 请求
async function fetchEmbedding(input, model, token, cnbApiUrl) {
  const response = await fetch(cnbApiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ model, input, text: input }),
    redirect: 'manual',
  });

  if (!response.ok) {
    let errorMsg = `Upstream returned ${response.status}`;
    let errorCode = response.status;
    
    // Redirect handling
    if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('Location');
        if (location) {
            errorMsg += `. Redirect to: ${location}`;
            if (location.includes('signin') || location.includes('login')) {
                errorMsg += ' (Probable cause: Invalid Token or CNB_REPO)';
            }
        }
    }

    try {
      const errorText = await response.text();
      if (errorText) {
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.msg) errorMsg = errorJson.msg;
          else if (errorJson.error?.message) errorMsg = errorJson.error.message;
          else errorMsg = errorText;
          if (errorJson.code) errorCode = errorJson.code;
        } catch {
          errorMsg = errorText;
        }
      }
    } catch (e) { /* ignore */ }
    
    throw { message: errorMsg, code: errorCode, status: response.status };
  }

  const data = await response.json();
  
  // Compatibility fix: convert {"embeddings": []} to {"data": [{embedding: ...}]}
  if (data && data.embeddings && Array.isArray(data.embeddings) && !data.data) {
      // 判断 embeddings 是单个向量还是多个向量的数组
      // 如果第一个元素是数字，说明整个 embeddings 就是一个向量
      // 如果第一个元素是数组，说明 embeddings 包含多个向量
      if (data.embeddings.length > 0 && typeof data.embeddings[0] === 'number') {
          // 单个 embedding 向量：[0.1, 0.2, 0.3, ...]
          data.data = [{
              object: 'embedding',
              embedding: data.embeddings,
              index: 0
          }];
      } else {
          // 多个 embedding 向量：[[0.1, 0.2, ...], [0.3, 0.4, ...]]
          data.data = data.embeddings.map((embedding, index) => ({
              object: 'embedding',
              embedding: embedding,
              index: index
          }));
      }
      delete data.embeddings;
      // Ensure standard response structure
      if (!data.object) data.object = 'list';
      if (!data.model) data.model = 'hunyuan-embedding';
      if (!data.usage) data.usage = { prompt_tokens: 0, total_tokens: 0 };
  }

  // Compatibility fix for string embedding
  if (data && data.data && Array.isArray(data.data)) {
      data.data.forEach(item => {
          if (item.embedding && typeof item.embedding === 'string') {
              try {
                   const str = item.embedding.trim();
                   if (str.startsWith('[') && str.endsWith(']')) {
                       item.embedding = JSON.parse(str);
                   } 
              } catch (e) { }
          }
      });
  }
  return data;
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

  if (!env.CNB_REPO) return errorResponse('CNB_REPO not set', 'server_error', 500);
  if (!env.CNB_EMBEDDINGS_PATH) return errorResponse('CNB_EMBEDDINGS_PATH not set', 'server_error', 501);
  
  const cnbApiUrl = getCnbApiUrl(env);
  const token = extractToken(request);
  if (!token) return errorResponse('Missing Authorization', 'authentication_error', 401);

  try {
    const body = await request.json();
    const model = body.model || 'default';
    // 兼容 input 和 text 两种字段名
    const input = body.input || body.text;

    logEvent('embeddings', clientIp, { model, input_length: Array.isArray(input) ? input.length : 1 });

    let finalData = {
      object: 'list',
      data: [],
      model: model,
      usage: { prompt_tokens: 0, total_tokens: 0 }
    };

    // 如果 input 是字符串数组（批处理），并且长度 > 1，则拆分请求
    // 注意：如果 input 本身是单个字符串，Array.isArray 为 false
    // 如果 input 是 tokenize 后的单个输入（数字数组），我们应该视为单个请求（Array.isArray 但元素是 numbers）
    let isBatch = false;
    if (Array.isArray(input) && input.length > 0) {
        // 简单启发式：如果第一个元素是字符串，则认为是批量字符串请求
        if (typeof input[0] === 'string') {
            isBatch = true;
        }
    }

    if (isBatch) {
        console.log(LOG_PREFIX, 'Batch processing detected, splitting into', input.length, 'requests');
        // 并发请求
        const promises = input.map(str => fetchEmbedding(str, model, token, cnbApiUrl));
        const results = await Promise.all(promises);
        
        // 合并结果
        results.forEach((res, index) => {
            if (res.data && res.data[0]) {
                const embeddingObj = res.data[0];
                embeddingObj.index = index; // 重置 index
                finalData.data.push(embeddingObj);
            }
            if (res.usage) {
                finalData.usage.prompt_tokens += (res.usage.prompt_tokens || 0);
                finalData.usage.total_tokens += (res.usage.total_tokens || 0);
            }
        });
        // 继承最后一个 response 的其他属性（如 model）
        if (results.length > 0 && results[0].model) {
            finalData.model = results[0].model;
        }

    } else {
        // 单个请求
        const res = await fetchEmbedding(input, model, token, cnbApiUrl);
        finalData = res;
    }

    logResponse('embeddings', 200, { usage: finalData.usage });
    return new Response(JSON.stringify(finalData), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    // 捕获 fetchEmbedding 抛出的自定义错误对象，或者是其他 runtime error
    const status = error.status || 500;
    const msg = error.message || error.toString();
    const code = error.code || null;
    
    logError('Request failed', error);
    logResponse('embeddings', status, { error: 'upstream_error', detail: msg });
    
    return new Response(
      JSON.stringify({
        error: {
          message: msg,
          type: 'upstream_error',
          param: null,
          code: code,
        },
      }),
      {
        status: status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}
