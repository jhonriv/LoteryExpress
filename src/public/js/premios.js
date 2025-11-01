import { apiGet, apiPost, apiPut } from "./api.js";

function byId(id) {
  return document.getElementById(id);
}

async function loadList() {
  const tbl = document.querySelector("#tbl tbody");
  if (!tbl) return;
  const data = await apiGet("/api/prizes");
  tbl.innerHTML = data
    .map(
      (p) => `
    <tr>
      <td>${p.id}</td>
      <td>${p.nombre}</td>
      <td>${p.descripcion}</td>
      <td>${
        p.cedulaGanador
          ? `${p.nombreGanador || ""} (${p.cedulaGanador}) #${p.numeroGanador}`
          : "-"
      }</td>
      <td><a class="btn btn-sm btn-outline-primary" href="/premios/form.html?id=${
        p.id
      }">Editar</a></td>
    </tr>
  `
    )
    .join("");
}

async function loadForm() {
  const form = byId("prizeForm");
  if (!form) return;
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (id) {
    const p = await apiGet(`/api/prizes/${id}`);
    byId("nombre").value = p.nombre;
    byId("descripcion").value = p.descripcion;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      nombre: byId("nombre").value.trim(),
      descripcion: byId("descripcion").value.trim(),
    };
    try {
      if (id) await apiPut(`/api/prizes/${id}`, payload);
      else await apiPost("/api/prizes", payload);
      location.href = "/premios/index.html";
    } catch (err) {
      alert(err.error);
    }
  });
}

loadList();
loadForm();
