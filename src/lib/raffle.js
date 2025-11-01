import { saveDb, getDb } from "./store.js";

export async function raffleStatus() {
  const db = await getDb();
  return db.prizes.map((p) => {
    const ganador = p.cedulaGanador
      ? db.participants.find((x) => x.cedula === p.cedulaGanador)
      : null;
    return {
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      numeroGanador: p.numeroGanador ?? null,
      cedulaGanador: p.cedulaGanador ?? null,
      nombreGanador: ganador ? ganador.nombre : null,
    };
  });
}

export async function drawNextPrize() {
  return saveDb(async (db) => {
    const nextPrize = db.prizes.find((p) => !p.cedulaGanador);
    if (!nextPrize) {
      throw new Error("No hay premios pendientes por sortear");
    }

    // Números ya ganadores
    const numerosGanadores = new Set(
      db.prizes
        .filter((p) => p.numeroGanador != null)
        .map((p) => String(p.numeroGanador))
    );

    // Todos los números vendidos (normalizados a enteros)
    const vendidos = [];
    for (const part of db.participants) {
      for (const n of part.numerosComprados) {
        const val = n && typeof n === "object" ? n.number : n;
        if (Number.isInteger(val)) vendidos.push(val);
      }
    }

    const disponibles = vendidos.filter(
      (n) => !numerosGanadores.has(String(n))
    );
    if (disponibles.length === 0) {
      throw new Error("No hay números disponibles para sortear");
    }

    const pick = disponibles[Math.floor(Math.random() * disponibles.length)];
    const ganador = db.participants.find((p) =>
      p.numerosComprados.some(
        (x) => (x && typeof x === "object" ? x.number : x) === pick
      )
    );
    if (!ganador) {
      throw new Error("Inconsistencia: número sorteado sin participante");
    }

    nextPrize.numeroGanador = pick;
    nextPrize.cedulaGanador = ganador.cedula;

    return db;
  });
}
