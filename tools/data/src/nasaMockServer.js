// data/src/nasaMockServer.js
// Local Node + Express server that serves the cached snapshots (offline demos, file:// UIs).
//
//   npm i express            (only dependency)
//   node data/src/nasaMockServer.js [--port 8787]      # or PORT=8787
//
// Endpoints (CORS: any origin, so a file:// or localhost UI can call it):
//   GET /health
//   GET /api/meda/latest[?date=YYYY-MM-DD]
//   GET /api/mcs/:date            (:date = YYYY-MM-DD or "latest")  [?forecastDays=N, max 30]
// Response: { source, date, record, units, envData, forecast?, synthetic, snapshotFile }
//   `record` = raw canonical record (original units) so clients can run normalize() locally.

import { fetchLatest } from "./nasaData.js";

let express;
try {
  express = (await import("express")).default;
} catch {
  console.error("Missing dependency. Run:  npm i express");
  process.exit(1);
}

export function createApp() {
  const app = express();

  app.use((req, res, next) => { // CORS (no extra package needed)
    res.set({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Cache-Control": "no-store",
    });
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  const send = async (res, source, date, forecastDays) => {
    try {
      const env = await fetchLatest({ source, date: date ?? undefined, offline: true, includeRaw: true, forecastDays });
      const { raw, forecast, ...envData } = env;
      res.json({
        source, date: date ?? null, record: raw.record, units: raw.units, envData,
        ...(forecast ? { forecast } : {}),
        synthetic: raw.synthetic, syntheticNotice: raw.syntheticNotice, snapshotFile: raw.snapshotFile,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  };

  const validDate = (d) => d === undefined || d === "latest" || /^\d{4}-\d{2}-\d{2}$/.test(d);

  app.get("/health", (req, res) => res.json({ ok: true }));

  app.get("/api/meda/latest", (req, res) => {
    if (!validDate(req.query.date)) return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    return send(res, "meda", req.query.date && req.query.date !== "latest" ? req.query.date : null, 0);
  });

  app.get("/api/mcs/:date", (req, res) => {
    const { date } = req.params;
    if (!validDate(date)) return res.status(400).json({ error: "date must be YYYY-MM-DD or 'latest'" });
    const n = Math.min(30, Math.max(0, parseInt(req.query.forecastDays ?? "0", 10) || 0));
    return send(res, "mcs", date === "latest" ? null : date, n);
  });

  return app;
}

const portArg = process.argv.indexOf("--port");
const port = Number(portArg > -1 ? process.argv[portArg + 1] : process.env.PORT) || 8787;

// Start only when run directly (importing createApp() for tests does not listen).
import { pathToFileURL } from "node:url";
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  createApp().listen(port, () => {
    console.log(`NASA mock server on http://localhost:${port}`);
    console.log(`  GET /api/meda/latest\n  GET /api/mcs/latest   (or /api/mcs/YYYY-MM-DD?forecastDays=7)`);
  });
}
