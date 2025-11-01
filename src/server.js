import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { getDb } from "./lib/store.js";

import participantsRouter from "./routes/participants.js";
import prizesRouter from "./routes/prizes.js";
import raffleRouter from "./routes/raffle.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000; // fijo
const HOST = "127.0.0.1"; // fijo

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const baseDataDir = __dirname;

// Ensure data folder and db.json exist
const dataDir = path.join(baseDataDir, "data");
const dbPath = path.join(dataDir, "db.json");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(
    dbPath,
    JSON.stringify(
      {
        participants: [],
        prizes: [],
        meta: { nextPrizeId: 1, pricePerNumber: 10 },
      },
      null,
      2
    ),
    "utf-8"
  );
} else {
  // Ensure pricePerNumber exists without forcing a write if not needed
  const raw = fs.readFileSync(dbPath, "utf-8");
  try {
    const data = JSON.parse(raw);
    let changed = false;
    if (!data.meta) {
      data.meta = { nextPrizeId: 1, pricePerNumber: 10 };
      changed = true;
    } else {
      if (typeof data.meta.nextPrizeId !== "number") {
        data.meta.nextPrizeId = 1;
        changed = true;
      }
      if (typeof data.meta.pricePerNumber !== "number") {
        data.meta.pricePerNumber = 10;
        changed = true;
      }
    }
    if (!Array.isArray(data.participants)) {
      data.participants = [];
      changed = true;
    }
    if (!Array.isArray(data.prizes)) {
      data.prizes = [];
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf-8");
    }
  } catch {}
}

// Logging de errores en data/server.log
const logPath = path.join(dataDir, "server.log");
function appendLog(msg) {
  try {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}
process.on("uncaughtException", (err) => {
  console.error("Uncaught:", err);
  appendLog(`Uncaught: ${err?.stack || err}`);
});
process.on("unhandledRejection", (reason) => {
  console.error("UnhandledRejection:", reason);
  appendLog(`UnhandledRejection: ${reason?.stack || reason}`);
});

// Static assets (se sirven desde el snapshot cuando está empaquetado)
app.use(express.static(path.join(__dirname, "public")));

// API routes
app.use("/api/participants", participantsRouter);
app.use("/api/prizes", prizesRouter);
app.use("/api/raffle", raffleRouter);

// Ticket de participante (imprimible)
app.get("/ticket/:cedula", async (req, res) => {
  const db = await getDb();
  const p = db.participants.find((x) => x.cedula === req.params.cedula);
  if (!p) return res.status(404).send("Participante no encontrado");
  const price = db?.meta?.pricePerNumber ?? 10;
  // Normalizar numerosComprados a objetos { number, date }
  const todayIso = new Date().toISOString().slice(0, 10);
  const entries = Array.isArray(p.numerosComprados)
    ? p.numerosComprados
        .map((x) =>
          x && typeof x === "object" ? x : { number: Number(x), date: todayIso }
        )
        .filter((e) => Number.isFinite(e.number))
        .sort((a, b) => a.number - b.number)
    : [];
  const bigNumber = entries.length ? entries[0].number : "—";
  const prizes =
    Array.isArray(db.prizes) && db.prizes.length
      ? db.prizes
          .map(
            (pr, i) =>
              `${i + 1}. ${pr.descripcion || pr.description || "Premio"}`
          )
          .join("<br>")
      : "Sorteo con premios para los primeros lugares. ¡Mucha suerte!";
  const today = new Date().toLocaleDateString();
  const esc = (s) =>
    String(s).replace(
      /[&<>]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])
    );

  res.setHeader("Content-Type", "text/html; charset=utf-8");

  // Build one ticket per number y formatear como #000
  const fmt = (n) =>
    typeof n === "number" ? `#${String(n).padStart(3, "0")}` : "—";
  const list = entries.length ? entries : [{ number: null, date: todayIso }];
  const tickets = list
    .map((item) => {
      const numLabel = fmt(item.number);
      return `
    <div class="ticket">
      <div class="main">
        <div class="big">${esc(numLabel)}</div>
        <h1 class="title">Rifa Beneficio</h1>
        <div class="subtitle">Comprobante de participación</div>

        <div class="grid">
          <div class="card">
            <h3>Participante</h3>
            <div><strong>Nombre:</strong> ${esc(p.nombre)}</div>
            <div><strong>Teléfono:</strong> ${esc(p.telefono || "—")}</div>
            <div class="muted" style="margin-top:6px;">Fecha: ${esc(
              item.date
            )} · Cédula: ${esc(p.cedula)}</div>
          </div>
          <div class="card">
            <h3>Premios</h3>
            <div class="prizes">${prizes}</div>
          </div>
        </div>

        <div class="card" style="margin-top:6px;">
          <h3>Condiciones</h3>
          <div class="muted">Gracias por participar. Conserve este comprobante. La rifa se rige por las bases del organizador.</div>
        </div>

        <div class="footer">
          <div class="price">Valor del ticket: S/. ${esc(price)}</div>
          <div class="muted">Sujeto a términos y condiciones.</div>
        </div>
      </div>

      <div class="stub">
        <div class="logo">Rifa</div>
        <div class="muted">Talón del participante</div>
        <div class="price">S/. ${esc(price)}</div>
        <div class="lines">
          <div class="line"><span>Número</span><span>${esc(
            numLabel
          )}</span></div>
          <div class="line"><span>Nombre</span><span>${esc(
            p.nombre
          )}</span></div>
          <div class="line"><span>Teléfono</span><span>${esc(
            p.telefono || "—"
          )}</span></div>
          <div class="line"><span>Cédula</span><span>${esc(
            p.cedula
          )}</span></div>
          <div class="line"><span>Fecha</span><span>${esc(
            item.date
          )}</span></div>
        </div>
      </div>
    </div>
  `;
    })
    .join("");

  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ticket de Rifa - ${esc(p.nombre)}</title>
  <style>
    :root{ --ink:#1f2937; --muted:#6b7280; --brand:#6d28d9; --accent:#ef4444; --paper:#ffffff; --bg:#f3f4f6; }
    *{ box-sizing:border-box }
    body{ margin:0; background:var(--bg); color:var(--ink); font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size:3mm }
    .wrap{ max-width:250mm; margin:5mm auto; padding:0mm }
    .stack{ display:grid; grid-template-columns: 1fr; gap:6mm }
    .ticket{ display:grid; grid-template-columns: 2.5fr 1fr; background:var(--paper); border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; box-shadow:0 6px 10px rgba(0,0,0,.06); height: 88mm; }
    .main{ padding:2mm 5mm; padding-right:5mm; position:relative; background:linear-gradient(180deg,#ffffff 0%,#fafafa 100%) }
    .stub{ padding:2mm 5mm; border-left:2px dashed #e5e7eb; background:linear-gradient(180deg,#fff7ed 0%,#fff 100%) }

    /* Número grande esquina superior derecha */
    .big{ position:absolute; top:6mm; right:8mm; font-size:10mm; line-height:1; font-weight:900; color:var(--accent); opacity:.9 }

    .title{ font-size:8mm; font-weight:900; letter-spacing:.5px; color:var(--brand); margin:0 }
    .subtitle{ color:var(--muted); margin-top:2mm; font-size:3mm }

    .grid{ display:grid; grid-template-columns: 1fr 1fr; gap:4mm; margin-top:2mm }
    .card{ border:1px dashed #cbd5e1; border-radius:10px; background:#fff; padding:2mm }
    .card h3{ margin:0 0 2mm; font-size:4mm; color:#0f172a; text-transform:uppercase; letter-spacing:.8px }

    .prizes{ line-height:1.7 }

    .footer{ display:flex; align-items:center; justify-content:space-between; margin-top:6px }
    .price{ background:#fde68a; color:#7c2d12; font-weight:800; padding:3mm 4mm; border-radius:8px; border:1px solid #f59e0b }
    .muted{ color:var(--muted); font-size:3.5mm }

    /* Talón */
    .stub .logo{ font-weight:900; font-size:6mm; color:var(--brand) }
    .stub .price{ margin-top:4mm; display:inline-block }
    .stub .lines{ margin-top:4mm; line-height:1.9 }
    .line{ display:flex; justify-content:space-between; gap:4mm; border-bottom:1px dashed #e5e7eb; padding:1mm 0 }

    .printbar{ margin-top:6mm; text-align:right }
    .btn{ padding:4mm 5mm; border-radius:8px; border:1px solid #d1d5db; background:#fff; cursor:pointer }

    @media print{
      @page { size: A4 portrait; margin: 10mm; }
      body{ background:#fff }
      .wrap{ margin:0; padding:0 }
      .printbar{ display:none }
      .ticket{ box-shadow:none; border:1px solid #e5e7eb; break-inside: avoid; page-break-inside: avoid; }
      .stack{ gap:6mm }
    }
  </style>
</head>
<body>
  <div class="wrap">
      ${tickets}
    <div class="printbar"><button class="btn" onclick="window.print()">Imprimir</button></div>
  </div>
</body>
</html>
`);
});

// Fallback to index.html for root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const server = app.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log(`Servidor iniciado en ${url}`);
  appendLog(`START OK ${url}`);
});

server.on("error", (err) => {
  console.error("Error al iniciar el servidor:", err);
  appendLog(`Listen error: ${err?.stack || err}`);
  process.exitCode = 1;
});
