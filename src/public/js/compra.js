import { apiGet, apiPost } from "./api.js";

function byId(id) {
  return document.getElementById(id);
}

let selected = new Set();
let currentAvailability = [];
let editingId = null;
let price = 0;
let balance = 0;

function renderNumbersGrid() {
  const grid = byId("numbersGrid");
  grid.innerHTML = "";
  for (const item of currentAvailability) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "number-cell btn btn-sm";
    btn.textContent = String(item.number);

    const isSelected = selected.has(item.number);

    if (!item.available) {
      btn.classList.add("btn-outline-danger");
      btn.disabled = true;
      btn.title = "Vendido";
    } else if (isSelected) {
      btn.classList.add("btn-primary");
      btn.title = "Seleccionado";
    } else if (item.ownedBy) {
      btn.classList.add("btn-info");
      btn.title = "Asignado a este participante";
    } else {
      btn.classList.add("btn-outline-secondary");
    }

    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const maxSelectable = Math.floor(balance / price);
      if (!selected.has(item.number)) {
        if (selected.size >= maxSelectable) {
          alert(
            `Saldo insuficiente. Puedes seleccionar hasta ${maxSelectable} número(s).`
          );
          return;
        }
        selected.add(item.number);
        btn.classList.remove("btn-outline-secondary");
        btn.classList.add("btn-primary");
      } else {
        selected.delete(item.number);
        btn.classList.remove("btn-primary");
        btn.classList.add(item.ownedBy ? "btn-info" : "btn-outline-secondary");
      }
    });

    grid.appendChild(btn);
  }
}

async function refreshBalance() {
  const info = await apiGet(
    `/api/participants/${encodeURIComponent(editingId)}/balance`
  );
  price = info.pricePerNumber;
  balance = info.balance;
  byId("price").textContent = price.toFixed(2);
  byId("paid").textContent = info.totalPagado.toFixed(2);
  byId("balance").textContent = balance.toFixed(2);
  byId("maxSelectable").textContent = Math.floor(balance / price);
}

async function refreshAvailability() {
  currentAvailability = await apiGet(
    `/api/participants/availability?cedula=${encodeURIComponent(editingId)}`
  );
  renderNumbersGrid();
}

async function refreshPayments() {
  const tbl = document.querySelector("#paymentsTbl tbody");
  if (!tbl) return;
  const payments = await apiGet(
    `/api/participants/${encodeURIComponent(editingId)}/payments`
  );
  tbl.innerHTML = payments
    .map(
      (p) => `
    <tr>
      <td>${p.id ?? ""}</td>
      <td>${p.date ? new Date(p.date).toLocaleString() : ""}</td>
      <td>${p.method || ""}</td>
      <td>${p.receipt || ""}</td>
      <td>${
        typeof p === "number"
          ? p.toFixed(2)
          : p.amount?.toFixed
          ? p.amount.toFixed(2)
          : p.amount
      }</td>
      <td>${p.balance?.toFixed ? p.balance.toFixed(2) : p.balance ?? ""}</td>
    </tr>
  `
    )
    .join("");
}

async function init() {
  const params = new URLSearchParams(location.search);
  editingId = params.get("cedula");
  if (!editingId) {
    alert("Falta cédula");
    location.href = "/participantes/index.html";
    return;
  }
  await refreshBalance();
  await refreshPayments();
  await refreshAvailability();
}

byId("paymentForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const amount = parseFloat(byId("payAmount").value);
  const method = byId("payMethod").value;
  const receipt = byId("payReceipt").value.trim();
  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Monto inválido");
    return;
  }
  if (!method) {
    alert("Seleccione método");
    return;
  }
  if (!receipt) {
    alert("Ingrese comprobante");
    return;
  }
  try {
    await apiPost(
      `/api/participants/${encodeURIComponent(editingId)}/payments`,
      { amount, method, receipt }
    );
    byId("payAmount").value = "";
    byId("payReceipt").value = "";
    await refreshBalance();
    await refreshPayments();
  } catch (e) {
    try {
      const parsed = JSON.parse(e.message);
      alert(
        (parsed.errors && parsed.errors.join(", ")) ||
          parsed.error ||
          "Error realizando el pago"
      );
    } catch {
      alert("Error realizando el pago");
    }
  }
});

byId("btnSave")?.addEventListener("click", async () => {
  if (selected.size === 0) {
    alert("No hay números seleccionados.");
    return;
  }
  const numbers = Array.from(selected).sort((a, b) => a - b);
  try {
    await apiPost(
      `/api/participants/${encodeURIComponent(editingId)}/pick-numbers`,
      { numbers }
    );
    selected.clear();
    await refreshBalance();
    await refreshAvailability();
    alert("Números asignados correctamente");
  } catch (e) {
    try {
      const parsed = JSON.parse(e.message);
      alert(parsed.error || "Error al asignar");
    } catch {
      alert("Error al asignar números");
    }
  }
});

init();
