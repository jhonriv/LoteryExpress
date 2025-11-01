export const NUMBER_MIN = 1;
export const NUMBER_MAX = 200;

export function isValidNumberInRange(n) {
  return Number.isInteger(n) && n >= NUMBER_MIN && n <= NUMBER_MAX;
}

// Validación antigua completa (se mantiene si se necesitara en algún flujo legacy)
export function validateParticipant(input) {
  const errors = [];
  if (!input.cedula || typeof input.cedula !== "string")
    errors.push("Cédula requerida");
  if (!input.nombre || typeof input.nombre !== "string")
    errors.push("Nombre requerido");
  if (!input.telefono || typeof input.telefono !== "string")
    errors.push("Teléfono requerido");
  if (!Array.isArray(input.numerosComprados))
    errors.push("numerosComprados debe ser un arreglo");
  else {
    const set = new Set();
    for (const n of input.numerosComprados) {
      if (!isValidNumberInRange(n)) errors.push(`Número fuera de rango: ${n}`);
      const key = String(n);
      if (set.has(key))
        errors.push(`Número repetido en el mismo participante: ${n}`);
      set.add(key);
    }
  }
  if (typeof input.totalPagado !== "number")
    errors.push("totalPagado debe ser número");
  if (typeof input.descuento !== "number")
    errors.push("descuento debe ser número");
  if (!input.fechaCompra || typeof input.fechaCompra !== "string")
    errors.push("fechaCompra requerida (ISO)");
  return errors;
}

// Nueva validación para registro básico (sin números ni pagos)
export function validateParticipantRegistration(input) {
  const errors = [];
  if (!input.cedula || typeof input.cedula !== "string")
    errors.push("Cédula requerida");
  if (!input.nombre || typeof input.nombre !== "string")
    errors.push("Nombre requerido");
  if (!input.telefono || typeof input.telefono !== "string")
    errors.push("Teléfono requerido");
  return errors;
}

export function validatePrize(input) {
  const errors = [];
  if (!input.nombre || typeof input.nombre !== "string")
    errors.push("Nombre de premio requerido");
  if (!input.descripcion || typeof input.descripcion !== "string")
    errors.push("Descripción requerida");
  return errors;
}

export const PAYMENT_METHODS = ["efectivo", "transferencia", "yape", "plim"];

export function validatePaymentInput(input) {
  const errors = [];
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) errors.push("Monto inválido");
  if (!input.method || !PAYMENT_METHODS.includes(input.method))
    errors.push("Método de pago inválido");
  if (!input.receipt || typeof input.receipt !== "string")
    errors.push("Número de comprobante requerido");
  return errors;
}
