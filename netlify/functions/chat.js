// Gemini proxy: the API key lives in Netlify env vars, never in the browser.
const MODELS = new Set(["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.5-flash"]);
const hits = new Map();
const json = (statusCode, obj) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });
function limited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000, max = Number(process.env.RATE_LIMIT || 60);
  const arr = (hits.get(ip) || []).filter(t => now - t < win);
  arr.push(now); hits.set(ip, arr);
  return arr.length > max;
}
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: { message: "POST only" } });
  const allowed = process.env.ALLOWED_ORIGIN;
  if (allowed && (event.headers.origin || "") !== allowed) return json(403, { error: { message: "Origin not allowed" } });
  const ip = event.headers["x-nf-client-connection-ip"] || event.headers["x-forwarded-for"] || "unknown";
  if (limited(ip)) return json(429, { error: { message: "Too many requests. Wait a few minutes." } });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(500, { error: { message: "Server is missing GEMINI_API_KEY" } });
  const model = event.queryStringParameters && event.queryStringParameters.model;
  if (!MODELS.has(model)) return json(400, { error: { message: "Model not allowed" } });
  if ((event.body || "").length > 5.5 * 1024 * 1024) return json(413, { error: { message: "Request too large" } });
  let payload;
  try { payload = JSON.parse(event.body || "{}"); } catch { return json(400, { error: { message: "Bad JSON" } }); }
  delete payload.tools; delete payload.toolConfig; delete payload.tool_config;
  const cfg = payload.generationConfig || {};
  cfg.maxOutputTokens = Math.min(cfg.maxOutputTokens || 32768, 32768);
  payload.generationConfig = cfg;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(payload)
    });
    return { statusCode: r.status, headers: { "Content-Type": "application/json" }, body: await r.text() };
  } catch (e) {
    return json(504, { error: { message: "Couldn't reach Gemini. Try again." } });
  }
};
