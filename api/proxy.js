// 使用Node.js内置模块，不使用第三方依赖
const https = require('https');
const http = require('http');
const { URL } = require('url');

module.exports = async (req, res) => {
  // 允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // 获取目标URL
  const queryString = req.url.split('?')[1] || '';
  const params = new URLSearchParams(queryString);
  let targetUrl = params.get('target') || 'https://www.google.com';
  
  try {
    // 解码URL
    targetUrl = decodeURIComponent(targetUrl);
    
    // 确保有协议
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }
    
    // 解析URL
    const url = new URL(targetUrl);
    
    console.log(`代理请求: ${targetUrl}`);
    
    // 设置请求选项
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    };
    
    // 复制原始请求头（除了host）
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'connection') {
        options.headers[key] = value;
      }
    }
    
    // 选择http或https模块
    const client = url.protocol === 'https:' ? https : http;
    
    // 创建代理请求
    const proxyReq = client.request(options, (proxyRes) => {
      // 复制响应头
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (key.toLowerCase() === 'content-encoding') continue;
        res.setHeader(key, value);
      }
      
      // 删除安全头，允许在iframe中显示
      res.removeHeader('content-security-policy');
      res.removeHeader('x-frame-options');
      res.removeHeader('x-content-type-options');
      
      // 设置状态码
      res.writeHead(proxyRes.statusCode);
      
      // 管道传输响应数据
      proxyRes.pipe(res);
    });
    
    // 处理错误
    proxyReq.on('error', (err) => {
      console.error('代理请求错误:', err);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="font-family: Arial; padding: 40px; text-align: center;">
            <h1>代理错误</h1>
            <p>无法连接到目标网站</p>
            <p>错误: ${err.message}</p>
            <p>请尝试其他网站</p>
          </body>
        </html>
      `);
    });
    
    // 设置超时
    proxyReq.setTimeout(10000, () => {
      proxyReq.destroy();
      res.writeHead(504, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="font-family: Arial; padding: 40px; text-align: center;">
            <h1>请求超时</h1>
            <p>目标网站响应时间过长</p>
            <p>请稍后重试</p>
          </body>
        </html>
      `);
    });
    
    // 如果有请求体，传输它
    if (req.method === 'POST' || req.method === 'PUT') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
    
  } catch (error) {
    console.error('代理处理错误:', error);
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body style="font-family: Arial; padding: 40px; text-align: center;">
          <h1>URL格式错误</h1>
          <p>请检查您输入的网址</p>
          <p>错误: ${error.message}</p>
        </body>
      </html>
    `);
  }
};
