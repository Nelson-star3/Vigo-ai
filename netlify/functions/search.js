// Web search proxy. Uses Google Programmable Search if GOOGLE_CSE_KEY + GOOGLE_CSE_CX are set, else Wikipedia.
const hits = new Map();
const json = (statusCode, obj) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });
function limited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000, max = Number(process.env.RATE_LIMIT || 60);
  const arr = (hits.get(ip) || []).filter(t => now - t < win);
  arr.push(now); hits.set(ip, arr);
  return arr.length > max;
}
exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "GET only" });
  const ip = event.headers["x-nf-client-connection-ip"] || event.headers["x-forwarded-for"] || "unknown";
  if (limited(ip)) return json(429, { error: "Too many requests" });
  const q = String((event.queryStringParameters && event.queryStringParameters.q) || "").slice(0, 200).trim();
  if (!q) return json(400, { error: "Missing q" });
  try {
    const gk = process.env.GOOGLE_CSE_KEY, gx = process.env.GOOGLE_CSE_CX;
    if (gk && gx) {
      const r = await fetch(`https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(gk)}&cx=${encodeURIComponent(gx)}&num=5&q=${encodeURIComponent(q)}`);
      if (!r.ok) return json(r.status, { error: "Search failed" });
      const d = await r.json();
      return json(200, (d.items || []).map(i => ({ title: i.title, snippet: i.snippet || "", url: i.link })));
    }
    const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=4&prop=extracts%7Cinfo&exintro=1&explaintext=1&exchars=500&inprop=url&format=json`);
    if (!r.ok) return json(r.status, { error: "Search failed" });
    const d = await r.json();
    const pages = Object.values((d.query && d.query.pages) || {}).sort((a, b) => a.index - b.index);
    return json(200, pages.map(p => ({ title: p.title, snippet: (p.extract || "").replace(/\s+/g, " "), url: p.fullurl })));
  } catch (e) {
    return json(504, { error: "Search unavailable" });
  }
};
