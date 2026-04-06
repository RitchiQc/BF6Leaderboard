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

// User-Agent sent to upstream APIs. Uses a recent browser string so
// that Tracker.gg treats the request like a normal visitor.
const UPSTREAM_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// Full set of browser-like headers sent to Tracker.gg.
// Cloudflare bot-management inspects Sec-Fetch-*, Accept-Language,
// Accept-Encoding and other signals; missing them often triggers a
// 403 or a silent 404.
function upstreamHeaders() {
  return {
    "User-Agent": UPSTREAM_USER_AGENT,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    Referer: "https://tracker.gg/",
    Origin: "https://tracker.gg",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };
}

// CORS headers added to every response.
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Expose-Headers": "X-Proxy-Status, X-Upstream-Status",
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

    // Diagnostic endpoint — makes a test call to Tracker.gg and
    // reports the upstream status + first bytes of the body so the
    // user can verify their deployment works end-to-end.
    if (url.pathname === "/test") {
      return handleTest(request);
    }

    return Response.json(
      { error: "Not found. Use /proxy?url=<encoded-url> or /test" },
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
    // Send comprehensive browser-like headers so Cloudflare's bot
    // management does not flag the request.
    const response = await fetch(targetUrl.toString(), {
      headers: upstreamHeaders(),
      redirect: "follow",
    });

    const upstreamStatus = response.status;
    const body = await response.text();

    // Always return HTTP 200 from the Worker so the browser / fetch
    // API never shows a raw "page not found" error.  The real upstream
    // status is available in the X-Upstream-Status header and, for
    // non-2xx responses, also in the JSON body wrapper.
    if (upstreamStatus >= 200 && upstreamStatus < 300) {
      return new Response(body, {
        status: 200,
        headers: {
          ...headers,
          "Content-Type": response.headers.get("Content-Type") || "application/json",
          "X-Proxy-Status": "ok",
          "X-Upstream-Status": String(upstreamStatus),
        },
      });
    }

    // Upstream returned an error — wrap it so the front-end can
    // inspect both the status and the original body.
    return Response.json(
      {
        proxyError: true,
        upstreamStatus: upstreamStatus,
        message: "Tracker.gg returned HTTP " + upstreamStatus,
        body: body.substring(0, 2000),
      },
      {
        status: 200,
        headers: {
          ...headers,
          "X-Proxy-Status": "upstream-error",
          "X-Upstream-Status": String(upstreamStatus),
        },
      },
    );
  } catch (err) {
    return Response.json(
      { proxyError: true, upstreamStatus: 0, message: "Upstream request failed: " + err.message },
      { status: 502, headers },
    );
  }
}

// ─── Diagnostic endpoint ─────────────────────────────────────
// GET /test — makes a quick call to the Tracker.gg leaderboard
// endpoint and returns a summary.  Useful for verifying the
// Worker is deployed and Tracker.gg is reachable.
async function handleTest(request) {
  const headers = corsHeaders(request.headers.get("Origin"));
  const testUrl =
    "https://api.tracker.gg/api/v2/bf6/standard/leaderboards?type=gamemodes&platform=all&board=Kills&gamemode=gm_strike&page=1";

  try {
    const response = await fetch(testUrl, {
      headers: upstreamHeaders(),
      redirect: "follow",
    });
    const body = await response.text();
    const isJson = (() => {
      try { JSON.parse(body); return true; } catch { return false; }
    })();

    return Response.json(
      {
        status: "tested",
        upstreamUrl: testUrl,
        upstreamStatus: response.status,
        upstreamContentType: response.headers.get("Content-Type"),
        isJson: isJson,
        bodyPreview: body.substring(0, 500),
      },
      { headers },
    );
  } catch (err) {
    return Response.json(
      { status: "error", message: err.message },
      { status: 502, headers },
    );
  }
}
