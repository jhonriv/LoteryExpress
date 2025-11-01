import { apiGet, apiPost } from "./api.js";

const list = document.getElementById("prizesList");
const btn = document.getElementById("btnDraw");

async function renderStatus(highlightPrizeId = null) {
  const prizes = await apiGet("/api/raffle/status");
  list.innerHTML = prizes
    .map(
      (p) => `
    <div class="col-md-4">
      <div class="card mb-3 ${p.cedulaGanador ? "border-success" : ""} ${
        highlightPrizeId === p.id ? "shadow-lg" : ""
      }" data-prize-id="${
        p.id
      }" style="transition: box-shadow 300ms ease, transform 300ms ease; ${
        highlightPrizeId === p.id ? "transform: scale(1.02);" : ""
      }">
        <div class="card-body">
          <h5 class="card-title">Premio ${p.id} - ${p.nombre}</h5>
          <p class="card-text">${p.descripcion}</p>
          <p class="card-text fw-bold">${
            p.cedulaGanador
              ? `Ganador: ${p.nombreGanador || ""} (${p.cedulaGanador}) #${
                  p.numeroGanador
                }`
              : "Pendiente por sortear"
          }</p>
        </div>
      </div>
    </div>
  `
    )
    .join("");
  // Deshabilitar botón si no hay premios pendientes
  const hasPending = prizes.some((p) => !p.cedulaGanador);
  if (btn) {
    btn.disabled = !hasPending;
    btn.textContent = hasPending ? "Sortear siguiente" : "No hay más premios";
  }
}

// ------- Animación tipo ruleta -------
let rouletteTimer = null;
let rouletteEl = null;

function createRouletteOverlay(title) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.6)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "1050";

  const pane = document.createElement("div");
  pane.style.background = "#fff";
  pane.style.borderRadius = "12px";
  pane.style.padding = "24px 28px";
  pane.style.minWidth = "320px";
  pane.style.textAlign = "center";
  pane.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)";

  const h = document.createElement("div");
  h.textContent = title || "Sorteando...";
  h.style.fontWeight = "600";
  h.style.marginBottom = "8px";

  const num = document.createElement("div");
  num.textContent = "-";
  num.style.fontSize = "56px";
  num.style.fontWeight = "800";
  num.style.letterSpacing = "2px";

  const sub = document.createElement("div");
  sub.textContent = "¡Suerte!";
  sub.style.marginTop = "6px";
  sub.style.color = "#6c757d";

  pane.appendChild(h);
  pane.appendChild(num);
  pane.appendChild(sub);
  overlay.appendChild(pane);
  document.body.appendChild(overlay);
  return { overlay, numEl: num };
}

function startRoulette({
  durationMs = 3500,
  startInterval = 40,
  endInterval = 220,
}) {
  if (rouletteTimer) clearInterval(rouletteTimer);
  const { overlay, numEl } = createRouletteOverlay("Sorteando (al azar)...");
  rouletteEl = overlay;

  const t0 = performance.now();
  function tick(now) {
    const elapsed = now - t0;
    const progress = Math.min(elapsed / durationMs, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // desacelera
    const interval = startInterval + (endInterval - startInterval) * eased;

    const randomNum = Math.floor(Math.random() * 200) + 1; // efecto visual
    numEl.textContent = String(randomNum);

    if (progress >= 1) return; // se cerrará con stopRoulette

    if (rouletteTimer) clearInterval(rouletteTimer);
    rouletteTimer = setInterval(() => {
      cancelAnimationFrame(animFrameId);
      animFrameId = requestAnimationFrame(tick);
    }, interval);
  }

  let animFrameId = requestAnimationFrame(tick);
}

function stopRoulette(finalNumber) {
  if (rouletteTimer) {
    clearInterval(rouletteTimer);
    rouletteTimer = null;
  }
  if (!rouletteEl) return;
  const numEl = rouletteEl.querySelector("div:nth-child(2)");
  if (numEl) numEl.textContent = String(finalNumber);
  setTimeout(() => {
    rouletteEl.remove();
    rouletteEl = null;
  }, 1200);
}
// ------- Fin animación -------

async function getNextPendingPrizeId() {
  const prizes = await apiGet("/api/raffle/status");
  const next = prizes.find((p) => !p.cedulaGanador);
  return next ? next.id : null;
}

btn?.addEventListener("click", async () => {
  // Verificar antes si quedan premios pendientes
  const preCheckId = await getNextPendingPrizeId();
  if (preCheckId == null) {
    alert("No hay premios pendientes por sortear");
    await renderStatus();
    return;
  }

  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "Sorteando...";

  try {
    const nextPrizeId = preCheckId; // ya consultado

    startRoulette({ durationMs: 3500, startInterval: 40, endInterval: 220 });

    await new Promise((r) => setTimeout(r, 2200));

    await apiPost("/api/raffle/draw", {});

    const prizes = await apiGet("/api/raffle/status");
    let winningNumber = null;
    let highlightId = null;
    if (nextPrizeId != null) {
      const p = prizes.find((x) => x.id === nextPrizeId);
      if (p && p.numeroGanador != null) {
        winningNumber = p.numeroGanador;
        highlightId = p.id;
      }
    }
    if (winningNumber == null) {
      const withWinners = prizes.filter((x) => x.numeroGanador != null);
      if (withWinners.length) {
        const last = withWinners[withWinners.length - 1];
        winningNumber = last.numeroGanador;
        highlightId = last.id;
      }
    }

    if (winningNumber != null) {
      stopRoulette(winningNumber);
    } else {
      stopRoulette("?");
    }

    await renderStatus(highlightId);
  } catch (e) {
    try {
      const parsed = JSON.parse(e.message);
      alert(parsed.error || "Error en sorteo");
    } catch (_) {
      alert("Error en sorteo");
    }
    stopRoulette("-");
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
});

renderStatus();
