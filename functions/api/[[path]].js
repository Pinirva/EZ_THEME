/**
 * Cloudflare Pages Functions - API 反向代理
 * 拦截所有 /api/* 请求，悄悄转发给真正的后端服务器
 * 彻底消除跨域（CORS OPTIONS）预检延迟，并复用 HTTP/2 / HTTP/3 连接
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);

  // 真正的后端服务器域名（不带末尾斜杠）
  const BACKEND_ORIGIN = 'https://customer-access-point-01.1969130.xyz';

  // 拼接完整的后端目标 URL（包含路径和查询参数，如 ?token=xxx）
  const targetUrl = `${BACKEND_ORIGIN}${url.pathname}${url.search}`;

  // 复制客户端请求头，确保 Authorization、Token、Cookie 等正常透传
  const newHeaders = new Headers(context.request.headers);
  newHeaders.set('Host', 'customer-access-point-01.1969130.xyz');

  // 构建转发请求
  const proxyRequest = new Request(targetUrl, {
    method: context.request.method,
    headers: newHeaders,
    body: ['GET', 'HEAD'].includes(context.request.method) ? undefined : context.request.body,
    redirect: 'follow'
  });

  try {
    // 转发请求到后端并获取响应
    const response = await fetch(proxyRequest);

    // 返回后端响应给客户端
    return response;
  } catch (err) {
    return new Response(JSON.stringify({
      error: 'Proxy Error',
      message: err.message
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
