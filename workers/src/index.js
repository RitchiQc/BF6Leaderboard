/**
 * BF6 Leaderboard — Cloudflare Worker CORS Proxy
 *
 * Proxies requests to the Tracker.gg API server-side so the static
 * front-end never hits CORS restrictions.
 *
 * Deploy with:
 *   cd workers && npx wrangler deploy
 *
 * Usage from the browser:
 *   GET https://<your-worker>.workers.dev/proxy?url=<encoded-tracker-url>
 */

// Only allow proxying to these domains (security measure).
const ALLOWED_HOSTS = ["api.tracker.gg"];

// CORS headers added to every response.
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Handle CORS preflight.
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request.headers.get("Origin")),
      });
    }

    // Health-check endpoint.
    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json(
        { status: "ok", service: "bf6-leaderboard-proxy" },
        { headers: corsHeaders(request.headers.get("Origin")) },
      );
    }

    // Main proxy endpoint.
    if (url.pathname === "/proxy") {
      return handleProxy(request, url);
    }

    return Response.json(
      { error: "Not found. Use /proxy?url=<encoded-url>" },
      { status: 404, headers: corsHeaders(request.headers.get("Origin")) },
    );
  },
};

async function handleProxy(request, url) {
  const origin = request.headers.get("Origin");
  const headers = corsHeaders(origin);

  // Only GET is supported.
  if (request.method !== "GET") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers },
    );
  }

  // Extract and validate the target URL.
  const targetParam = url.searchParams.get("url");
  if (!targetParam) {
    return Response.json(
      { error: 'Missing "url" query parameter' },
      { status: 400, headers },
    );
  }

  let targetUrl;
  try {
    targetUrl = new URL(targetParam);
  } catch {
    return Response.json(
      { error: "Invalid URL" },
      { status: 400, headers },
    );
  }

  // Security: only proxy to allowed hosts.
  if (!ALLOWED_HOSTS.includes(targetUrl.hostname)) {
    return Response.json(
      { error: "Target host not allowed: " + targetUrl.hostname },
      { status: 403, headers },
    );
  }

  try {
    // Fetch from Tracker.gg server-side (no CORS restrictions).
    const response = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent": "BF6Leaderboard/1.0",
        Accept: "application/json",
      },
    });

    // Forward the upstream response with CORS headers.
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        ...headers,
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (err) {
    return Response.json(
      { error: "Upstream request failed: " + err.message },
      { status: 502, headers },
    );
  }
}
