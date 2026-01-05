const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

function buildTargetUrl(pathname, searchParams) {
  const base = BACKEND_URL.replace(/\/$/, "");
  const path = pathname.startsWith("/api") ? pathname : `/api${pathname}`;
  const query = searchParams ? `?${searchParams}` : "";
  return `${base}${path}${query}`;
}

async function proxyRequest(request) {
  const url = new URL(request.url);
  const targetUrl = buildTargetUrl(url.pathname, url.searchParams.toString());
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.text() : undefined;

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body
  });

  const responseBody = await response.arrayBuffer();
  return new Response(responseBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

export async function GET(request) {
  return proxyRequest(request);
}

export async function POST(request) {
  return proxyRequest(request);
}

export async function PUT(request) {
  return proxyRequest(request);
}

export async function DELETE(request) {
  return proxyRequest(request);
}

export async function PATCH(request) {
  return proxyRequest(request);
}
