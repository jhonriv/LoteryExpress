import { Router } from "express";
import { raffleStatus, drawNextPrize } from "../lib/raffle.js";

const router = Router();

router.get("/status", async (req, res) => {
  const status = await raffleStatus();
  res.json(status);
});

router.post("/draw", async (req, res) => {
  try {
    const result = await drawNextPrize();
    res.json({ ok: true, prizes: result.prizes });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || "Error en sorteo" });
  }
});

export default router;
