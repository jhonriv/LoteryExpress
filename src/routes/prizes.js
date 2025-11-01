import { Router } from "express";
import { getDb, saveDb } from "../lib/store.js";
import { validatePrize } from "../lib/validators.js";

const router = Router();

router.get("/", async (req, res) => {
  const db = await getDb();
  const data = db.prizes.map((p) => {
    const ganador = p.cedulaGanador
      ? db.participants.find((x) => x.cedula === p.cedulaGanador)
      : null;
    return {
      ...p,
      nombreGanador: ganador ? ganador.nombre : null,
    };
  });
  res.json(data);
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const db = await getDb();
  const p = db.prizes.find((x) => x.id === id);
  if (!p) return res.status(404).json({ error: "Premio no encontrado" });
  const ganador = p.cedulaGanador
    ? db.participants.find((x) => x.cedula === p.cedulaGanador)
    : null;
  res.json({ ...p, nombreGanador: ganador ? ganador.nombre : null });
});

router.post("/", async (req, res) => {
  const input = req.body;
  const errors = validatePrize(input);
  if (errors.length) return res.status(400).json({ errors });

  try {
    let created;
    await saveDb(async (db) => {
      const id = db.meta.nextPrizeId || 1;
      db.meta.nextPrizeId = id + 1;
      created = {
        id,
        nombre: input.nombre,
        descripcion: input.descripcion,
        numeroGanador: null,
        cedulaGanador: null,
      };
      db.prizes.push(created);
      return db;
    });
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: "Error al crear premio" });
  }
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const input = req.body;
  const errors = validatePrize(input);
  if (errors.length) return res.status(400).json({ errors });

  try {
    const result = await saveDb(async (db) => {
      const idx = db.prizes.findIndex((p) => p.id === id);
      if (idx === -1)
        return Promise.reject({ status: 404, error: "Premio no encontrado" });
      const prev = db.prizes[idx];
      db.prizes[idx] = {
        ...prev,
        nombre: input.nombre,
        descripcion: input.descripcion,
      };
      return db;
    });
    res.json(result.prizes.find((p) => p.id === id));
  } catch (e) {
    res
      .status(e.status || 500)
      .json({ error: e.error || "Error al actualizar premio" });
  }
});

export default router;
