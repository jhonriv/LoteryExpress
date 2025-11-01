import { apiGet, apiPost, apiPut } from "./api.js";

function byId(id) {
  return document.getElementById(id);
}

async function loadList() {
  const tbody = document.querySelector("#tbl tbody");
  if (!tbody) return; // estamos en form
  const data = await apiGet("/api/participants");
  tbody.innerHTML = data
    .map((p) => {
      const count = Array.isArray(p.numerosComprados)
        ? p.numerosComprados.length
        : 0;
      const printBtn =
        count > 0
          ? `<a class="btn btn-sm btn-outline-secondary" target="_blank" href="/ticket/${encodeURIComponent(
              p.cedula
            )}">Imprimir números</a>`
          : `<button class="btn btn-sm btn-outline-secondary" disabled>Imprimir números</button>`;
      return `
    <tr>
      <td>${p.cedula}</td>
      <td>${p.nombre}</td>
      <td>${p.telefono}</td>
      <td>${count}</td>
      <td><a class="btn btn-sm btn-outline-primary" href="/participantes/form.html?cedula=${encodeURIComponent(
        p.cedula
      )}">Editar</a></td>
      <td><a class="btn btn-sm btn-success" href="/participantes/compra.html?cedula=${encodeURIComponent(
        p.cedula
      )}">Comprar/Seleccionar</a></td>
      <td>${printBtn}</td>
    </tr>
  `;
    })
    .join("");
}

let selectedNumbers = new Set();

async function loadAvailability(editingId) {
  const url = editingId
    ? `/api/participants/availability?cedula=${encodeURIComponent(editingId)}`
    : "/api/participants/availability";
  const items = await apiGet(url);
  renderNumbersGrid(items);
}

function renderNumbersGrid(items) {
  const grid = byId("numbersGrid");
  if (!grid) return;
  grid.innerHTML = "";
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "number-cell btn btn-sm";
    btn.textContent = String(item.number);

    const isSelected = selectedNumbers.has(item.number);

    if (!item.available) {
      btn.classList.add("btn-outline-danger", "disabled");
      btn.disabled = true;
      btn.title = "Vendido";
    } else if (isSelected) {
      btn.classList.add("btn-primary", "selected");
      btn.title = "Seleccionado";
    } else if (item.ownedBy) {
      // disponible y propio cuando editas
      btn.classList.add("btn-info");
      btn.title = "Tuyo (edición)";
    } else {
      btn.classList.add("btn-outline-secondary");
    }

    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      if (selectedNumbers.has(item.number)) {
        selectedNumbers.delete(item.number);
      } else {
        selectedNumbers.add(item.number);
      }
      // re-render rápido del botón
      const nowSelected = selectedNumbers.has(item.number);
      btn.classList.toggle("btn-primary", nowSelected);
      btn.classList.toggle(
        "btn-outline-secondary",
        !nowSelected && !item.ownedBy
      );
      btn.classList.toggle("btn-info", !nowSelected && !!item.ownedBy);
      btn.classList.toggle("selected", nowSelected);
    });

    grid.appendChild(btn);
  }
}

async function loadForm() {
  const form = byId("participantForm");
  if (!form) return;
  const params = new URLSearchParams(location.search);
  const editingId = params.get("cedula");
  if (editingId) {
    byId("cedula").value = editingId;
    byId("cedula").disabled = true;
    const p = await apiGet(
      `/api/participants/${encodeURIComponent(editingId)}`
    );
    byId("nombre").value = p.nombre;
    byId("telefono").value = p.telefono;
  }

  await loadAvailability(editingId || undefined);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      cedula: editingId || byId("cedula").value.trim(),
      nombre: byId("nombre").value.trim(),
      telefono: byId("telefono").value.trim(),
    };

    console.log(payload);
    try {
      if (editingId)
        await apiPut(`/api/participants/${encodeURIComponent(editingId)}`, {
          nombre: payload.nombre,
          telefono: payload.telefono,
        });
      else await apiPost("/api/participants", payload);
      location.href = "/participantes/index.html";
    } catch (err) {
      console.log(err);
      alert(err);
    }
  });
}

loadList();
loadForm();
