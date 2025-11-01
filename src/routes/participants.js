import { Router } from "express";
import { getDb, saveDb } from "../lib/store.js";
import {
  validateParticipant,
  validateParticipantRegistration,
  validatePaymentInput,
  isValidNumberInRange,
  NUMBER_MIN,
  NUMBER_MAX,
} from "../lib/validators.js";

const router = Router();

function sumPayments(p) {
  if (Array.isArray(p.payments)) {
    return p.payments.reduce((acc, pay) => {
      if (typeof pay === "number") return acc + pay; // compatibilidad legacy
      if (pay && typeof pay.amount === "number") return acc + pay.amount;
      return acc;
    }, 0);
  }
  if (typeof p.totalPagado === "number") return p.totalPagado;
  return 0;
}

router.get("/", async (req, res) => {
  const db = await getDb();
  res.json(db.participants);
});

router.get("/availability", async (req, res) => {
  const db = await getDb();
  const editingCedula = req.query.cedula || null;
  const owned = new Set();
  const sold = new Set();

  for (const p of db.participants) {
    const isOwner = editingCedula && p.cedula === editingCedula;
    for (const n of p.numerosComprados) {
      const val = n && typeof n === "object" ? n.number : n;
      const key = String(val);
      if (isOwner) owned.add(key);
      else sold.add(key);
    }
  }

  const result = [];
  for (let n = NUMBER_MIN; n <= NUMBER_MAX; n++) {
    const key = String(n);
    if (owned.has(key)) {
      result.push({ number: n, available: true, ownedBy: editingCedula });
    } else if (sold.has(key)) {
      result.push({ number: n, available: false, ownedBy: null });
    } else {
      result.push({ number: n, available: true, ownedBy: null });
    }
  }
  res.json(result);
});

router.get("/:cedula", async (req, res) => {
  const db = await getDb();
  const p = db.participants.find((x) => x.cedula === req.params.cedula);
  if (!p) return res.status(404).json({ error: "Participante no encontrado" });
  res.json(p);
});

// Listado de pagos del participante
router.get("/:cedula/payments", async (req, res) => {
  const db = await getDb();
  const p = db.participants.find((x) => x.cedula === req.params.cedula);
  if (!p) return res.status(404).json({ error: "Participante no encontrado" });
  const payments = Array.isArray(p.payments) ? p.payments : [];
  res.json(payments);
});

// Registro básico sin números ni pagos
router.post("/", async (req, res) => {
  const input = req.body;
  const errors = validateParticipantRegistration(input);
  if (errors.length) return res.status(400).json({ errors });

  try {
    console.log(input);
    const result = await saveDb(async (db) => {
      if (db.participants.some((p) => p.cedula === input.cedula)) {
        return Promise.reject({ status: 409, error: "Cédula ya registrada" });
      }
      const created = {
        cedula: input.cedula,
        nombre: input.nombre,
        telefono: input.telefono,
        numerosComprados: [],
        payments: [],
      };
      db.participants.push(created);
      return db;
    });
    res
      .status(201)
      .json(result.participants.find((p) => p.cedula === input.cedula));
  } catch (e) {
    const status = e.status || 500;
    res
      .status(status)
      .json({ error: e.error || "Error al crear participante" });
  }
});

// Actualizar datos básicos (sin tocar números ni pagos)
router.put("/:cedula", async (req, res) => {
  const id = req.params.cedula;
  const { nombre, telefono } = req.body;
  const baseErrors = validateParticipantRegistration({
    cedula: id,
    nombre,
    telefono,
  });
  if (baseErrors.length) return res.status(400).json({ errors: baseErrors });

  try {
    const result = await saveDb(async (db) => {
      const idx = db.participants.findIndex((p) => p.cedula === id);
      if (idx === -1)
        return Promise.reject({
          status: 404,
          error: "Participante no encontrado",
        });
      db.participants[idx] = {
        ...db.participants[idx],
        nombre,
        telefono,
      };
      return db;
    });
    res.json(result.participants.find((p) => p.cedula === id));
  } catch (e) {
    const status = e.status || 500;
    res
      .status(status)
      .json({ error: e.error || "Error al actualizar participante" });
  }
});

// Balance de un participante
router.get("/:cedula/balance", async (req, res) => {
  const db = await getDb();
  const p = db.participants.find((x) => x.cedula === req.params.cedula);
  if (!p) return res.status(404).json({ error: "Participante no encontrado" });
  const price =
    db.meta && typeof db.meta.pricePerNumber === "number"
      ? db.meta.pricePerNumber
      : 10;
  const totalPagado = sumPayments(p);
  const qty = Array.isArray(p.numerosComprados) ? p.numerosComprados.length : 0;
  const used = qty * price;
  const balance = totalPagado - used;
  res.json({
    pricePerNumber: price,
    totalPagado,
    cantidadNumeros: qty,
    balance,
  });
});

// Registrar pago (con historial detallado)
router.post("/:cedula/payments", async (req, res) => {
  const errors = validatePaymentInput(req.body || {});
  if (errors.length) return res.status(400).json({ errors });
  const amount = Number(req.body.amount);
  const method = req.body.method;
  const receipt = req.body.receipt;
  const date = req.body.date || new Date().toISOString();

  try {
    let newPayment;
    await saveDb(async (db) => {
      const p = db.participants.find((x) => x.cedula === req.params.cedula);
      if (!p)
        return Promise.reject({
          status: 404,
          error: "Participante no encontrado",
        });
      if (!Array.isArray(p.payments)) p.payments = [];

      // Calcular próximo id local al participante
      const nextId =
        p.payments.reduce((max, pay) => {
          const pid = typeof pay === "number" ? 0 : pay.id || 0;
          return Math.max(max, pid);
        }, 0) + 1;

      // Calcular balance post-pago
      const dbPrice =
        db.meta && typeof db.meta.pricePerNumber === "number"
          ? db.meta.pricePerNumber
          : 10;
      const prevTotal = sumPayments(p);
      const qty = Array.isArray(p.numerosComprados)
        ? p.numerosComprados.length
        : 0;
      const balancePrev = prevTotal - qty * dbPrice;
      const balanceAfter = balancePrev + amount;

      newPayment = {
        id: nextId,
        date,
        amount,
        balance: balanceAfter,
        method,
        receipt,
      };
      p.payments.push(newPayment);
      return db;
    });
    res.json({ ok: true, payment: newPayment });
  } catch (e) {
    res
      .status(e.status || 500)
      .json({ error: e.error || "Error al registrar pago" });
  }
});

// Selección de números (agrega números si hay saldo suficiente)
router.post("/:cedula/pick-numbers", async (req, res) => {
  const numbers = Array.isArray(req.body.numbers)
    ? req.body.numbers.map(Number)
    : [];
  try {
    await saveDb(async (db) => {
      const p = db.participants.find((x) => x.cedula === req.params.cedula);
      if (!p)
        return Promise.reject({
          status: 404,
          error: "Participante no encontrado",
        });
      if (!Array.isArray(p.numerosComprados)) p.numerosComprados = [];
      if (!Array.isArray(p.payments)) p.payments = [];

      // Validar rango y no duplicados internos (compat objetos)
      const localSet = new Set(
        p.numerosComprados.map((x) =>
          String(x && typeof x === "object" ? x.number : x)
        )
      );
      const addSet = new Set();
      for (const n of numbers) {
        if (!isValidNumberInRange(n))
          return Promise.reject({
            status: 400,
            error: `Número fuera de rango: ${n}`,
          });
        const key = String(n);
        if (localSet.has(key))
          return Promise.reject({
            status: 409,
            error: `Número ya asignado al participante: ${n}`,
          });
        if (addSet.has(key))
          return Promise.reject({
            status: 400,
            error: `Número repetido en la solicitud: ${n}`,
          });
        addSet.add(key);
      }

      // Validar disponibilidad global
      const usados = new Set();
      for (const other of db.participants) {
        for (const n of other.numerosComprados) {
          const val = n && typeof n === "object" ? n.number : n;
          usados.add(String(val));
        }
      }
      for (const key of addSet) {
        if (usados.has(key))
          return Promise.reject({
            status: 409,
            error: `Número ya vendido: ${key}`,
          });
      }

      // Validar saldo
      const price =
        db.meta && typeof db.meta.pricePerNumber === "number"
          ? db.meta.pricePerNumber
          : 10;
      const totalPagado = sumPayments(p);
      const qty = p.numerosComprados.length;
      const balance = totalPagado - qty * price;
      const canBuy = Math.floor(balance / price);
      if (numbers.length > canBuy)
        return Promise.reject({
          status: 400,
          error: `Saldo insuficiente. Puedes seleccionar hasta ${canBuy} número(s).`,
        });

      // Agregar números con fecha de selección YYYY-MM-DD
      const today = new Date().toISOString().slice(0, 10);
      p.numerosComprados.push(
        ...numbers.map((num) => ({ number: num, date: today }))
      );
      return db;
    });
    res.json({ ok: true });
  } catch (e) {
    res
      .status(e.status || 500)
      .json({ error: e.error || "Error al asignar números" });
  }
});

export default router;
