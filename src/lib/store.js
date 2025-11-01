import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "..", "data", "db.json");

let queue = Promise.resolve();

// Reinicia la cola si quedó rechazada
function safeQueue() {
  // Captura y neutraliza cualquier rechazo previo antes de encadenar la siguiente tarea
  queue = queue.catch(() => undefined);
  return queue;
}

async function readDb() {
  const data = await fs.readFile(dbPath, "utf-8");
  return JSON.parse(data);
}

async function writeDb(content) {
  const tempPath = dbPath + ".tmp";
  await fs.writeFile(tempPath, JSON.stringify(content, null, 2), "utf-8");
  await fs.rename(tempPath, dbPath);
}

export function withDb(fn) {
  // Enqueue operations para evitar escrituras concurrentes
  queue = safeQueue().then(async () => {
    const db = await readDb();
    const result = await fn(db);
    if (result && result.__write) {
      delete result.__write;
      await writeDb(result);
      return result;
    }
    return db; // no write
  });
  return queue;
}

export async function getDb() {
  return readDb();
}

export async function saveDb(modifier) {
  return withDb(async (db) => {
    const newDb = await modifier(structuredClone(db));
    newDb.__write = true;
    return newDb;
  });
}

// Helpers
export async function getAllParticipants() {
  const db = await getDb();
  return db.participants;
}

export async function getAllPrizes() {
  const db = await getDb();
  return db.prizes;
}

export async function nextPrizeId() {
  let id;
  await saveDb(async (db) => {
    id = db.meta.nextPrizeId || 1;
    db.meta.nextPrizeId = id + 1;
    return db;
  });
  return id;
}
