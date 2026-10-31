// Text-to-speech proxy (Pollinations key stays server-side).
const hits = new Map();
const json = (statusCode, obj) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });
function limited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000, max = Number(process.env.RATE_LIMIT || 60);
  const arr = (hits.get(ip) || []).filter(t => now - t < win);
  arr.push(now); hits.set(ip, arr);
  return arr.length > max;
}
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });
  const allowed = process.env.ALLOWED_ORIGIN;
  if (allowed && (event.headers.origin || "") !== allowed) return json(403, { error: "Origin not allowed" });
  const ip = event.headers["x-nf-client-connection-ip"] || event.headers["x-forwarded-for"] || "unknown";
  if (limited(ip)) return json(429, { error: "Too many requests" });
  const key = process.env.POLLINATIONS_API_KEY;
  if (!key) return json(500, { error: "Server is missing POLLINATIONS_API_KEY" });
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Bad JSON" }); }
  const input = String(body.input || "").slice(0, 3000);
  const voice = String(body.voice || "alloy").slice(0, 40);
  if (!input) return json(400, { error: "Empty input" });
  try {
    const r = await fetch("https://gen.pollinations.ai/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "tts-1", input, voice })
    });
    if (!r.ok) return { statusCode: r.status, headers: { "Content-Type": "text/plain" }, body: await r.text() };
    const buf = Buffer.from(await r.arrayBuffer());
    return { statusCode: 200, headers: { "Content-Type": r.headers.get("content-type") || "audio/mpeg" }, body: buf.toString("base64"), isBase64Encoded: true };
  } catch (e) {
    return json(504, { error: "Couldn't reach the voice service" });
  }
};
