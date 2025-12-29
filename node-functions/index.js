/**
 * Root endpoint - API information page
 * GET /
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const I18N = {
  en: {
    lang: 'en',
    subtitle: 'EdgeOne Pages Node Functions Proxy for CNB LLM API',
    badge: 'OpenAI Standard Compatible',
    sectionTitle: 'API Endpoints',
    footer: 'Made by <a href="https://www.mintimate.cn" target="_blank">Mintimate</a> · Powered by EdgeOne Pages'
  },
  zh: {
    lang: 'zh-CN',
    subtitle: '基于 EdgeOne Pages Node Functions 的 CNB 大模型 API 代理',
    badge: '兼容 OpenAI 标准接口',
    sectionTitle: 'API 接口列表',
    footer: '由 <a href="https://www.mintimate.cn" target="_blank">Mintimate</a> 制作 · 基于 EdgeOne Pages 驱动'
  }
};

function getHtml(langData) {
  return `<!DOCTYPE html>
<html lang="${langData.lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CNB Edge Gateway</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <style>
    :root {
      --bg-gradient: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      --card-bg: rgba(255, 255, 255, 0.95);
      --text-primary: #2d3748;
      --text-secondary: #718096;
      --accent: #667eea;
      --accent-hover: #5a67d8;
      --border: #e2e8f0;
      --code-bg: #f7fafc;
      --success: #48bb78;
      --info: #4299e1;
      --shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.1);
    }
    
    @media (prefers-color-scheme: dark) {
      :root {
        --bg-gradient: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
        --card-bg: rgba(26, 32, 44, 0.95);
        --text-primary: #f7fafc;
        --text-secondary: #a0aec0;
        --accent: #7f9cf5;
        --accent-hover: #667eea;
        --border: #4a5568;
        --code-bg: #2d3748;
        --shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.3);
      }
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: var(--bg-gradient);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: var(--text-primary);
      transition: background 0.3s;
    }
    
    .container {
      background: var(--card-bg);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 24px;
      box-shadow: var(--shadow);
      padding: 48px;
      max-width: 640px;
      width: 100%;
      border: 1px solid rgba(255,255,255,0.1);
      transition: all 0.3s ease;
    }
    
    .header {
      text-align: center;
      margin-bottom: 40px;
    }

    .emoji-icon {
        font-size: 3.5rem;
        display: block;
        margin-bottom: 16px;
        animation: float 3s ease-in-out infinite;
    }

    @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
    }

    h1 {
      font-size: 2.2rem;
      margin-bottom: 12px;
      font-weight: 800;
      background: linear-gradient(120deg, var(--accent), #9f7aea);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.5px;
    }

    .subtitle {
      color: var(--text-secondary);
      font-size: 1.1rem;
      line-height: 1.5;
      margin-bottom: 20px;
    }
    
    .badge {
      display: inline-flex;
      align-items: center;
      background: rgba(72, 187, 120, 0.1);
      color: var(--success);
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 600;
      border: 1px solid rgba(72, 187, 120, 0.2);
    }
    
    .section {
      margin-top: 32px;
    }
    
    .section-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-secondary);
      font-weight: 700;
      margin-bottom: 16px;
      opacity: 0.8;
    }
    
    .endpoint-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .endpoint {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
    }
    
    .endpoint:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        border-color: var(--accent);
    }

    .method {
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 800;
      min-width: 64px;
      text-align: center;
      letter-spacing: 0.5px;
    }
    
    .method.post { background: rgba(72, 187, 120, 0.15); color: var(--success); }
    .method.get { background: rgba(66, 153, 225, 0.15); color: var(--info); }
    
    .path {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      color: var(--text-primary);
      font-size: 0.95rem;
      font-weight: 500;
    }
    
    .links {
      display: flex;
      gap: 24px;
      justify-content: center;
      margin-top: 40px;
      padding-top: 30px;
      border-top: 1px solid var(--border);
    }
    
    .link-item {
      color: var(--text-secondary);
      text-decoration: none;
      font-weight: 500;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.95rem;
    }
    
    .link-item:hover {
      color: var(--accent);
      transform: translateY(-1px);
    }

    .link-item svg {
        width: 18px;
        height: 18px;
    }

    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-secondary);
      opacity: 0.7;
      transition: opacity 0.2s;
    }
    
    .footer:hover {
        opacity: 1;
    }
    
    .footer a {
        color: var(--text-primary);
        text-decoration: none;
        font-weight: 500;
        border-bottom: 1px dotted var(--text-secondary);
        transition: border-bottom-color 0.2s;
    }
    .footer a:hover {
        color: var(--accent);
        border-bottom-color: var(--accent);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
        <div class="emoji-icon">
          <img src="/favicon.svg" alt="Logo" width="80" height="80">
        </div>
        <h1>CNB Edge Gateway</h1>
        <p class="subtitle">${langData.subtitle}</p>
        <span class="badge">${langData.badge}</span>
    </div>
    
    <div class="section">
      <div class="section-title">${langData.sectionTitle}</div>
      <div class="endpoint-list">
        <div class="endpoint">
            <span class="method post">POST</span>
            <span class="path">/v1/chat/completions</span>
        </div>
        <div class="endpoint">
            <span class="method get">GET</span>
            <span class="path">/v1/models</span>
        </div>
      </div>
    </div>
    
    <div class="links">
      <a href="https://github.com/Mintimate/cnb-edge-gateway" target="_blank" class="link-item">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
        GitHub
      </a>
      <a href="https://cnb.cool/Mintimate/code-nest/cnb-edge-gateway" target="_blank" class="link-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        CNB Repo
      </a>
      <a href="https://api.cnb.cool/#/operations/AiChatCompletions" target="_blank" class="link-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        API Docs
      </a>
    </div>
    
    <div class="footer">
      ${langData.footer}
    </div>
  </div>
</body>
</html>`;
}

export function onRequest({ request }) {
  const method = request.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Detect language
  const acceptLanguage = request.headers.get('accept-language') || '';
  const isZh = acceptLanguage.toLowerCase().includes('zh');
  const langData = isZh ? I18N.zh : I18N.en;

  // Return HTML page
  return new Response(getHtml(langData), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
