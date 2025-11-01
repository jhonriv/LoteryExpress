# LoteryExpress

Aplicación Node.js + Express para gestionar una rifa: registro de participantes, pagos, selección de números y emisión de talonarios imprimibles por número.

## Características

- CRUD de participantes y premios.
- Historial de pagos con método, recibo y balance.
- Selección de números con control de disponibilidad.
- Modelo de números con fecha de selección por número `{ number, date }`.
- Talón imprimible por número con formato `#000` y diseño para 3 talones por página A4.
- Persistencia simple en [src/data/db.json](cci:7://file:///c:/Users/JhonRiv/Documents/Github/LoteryExpress/src/data/db.json:0:0-0:0).

## Requisitos

- Node.js 18+ y npm

## Instalación

- Clonar el repositorio
- Instalar dependencias:
  - `npm install`

## Ejecución

- Desarrollo (con recarga por nodemon):
  - `npm run dev`
- Producción:
  - `npm start`
- Abrir la app:
  - `http://127.0.0.1:3000`

## Estructura

- [src/server.js](cci:7://file:///c:/Users/JhonRiv/Documents/Github/LoteryExpress/src/server.js:0:0-0:0) Servidor Express y HTML de tickets
- [src/routes/participants.js](cci:7://file:///c:/Users/JhonRiv/Documents/Github/LoteryExpress/src/routes/participants.js:0:0-0:0) API de participantes, pagos y selección de números
- `src/routes/prizes.js` API de premios
- `src/routes/raffle.js` API de sorteo
- [src/lib/store.js](cci:7://file:///c:/Users/JhonRiv/Documents/Github/LoteryExpress/src/lib/store.js:0:0-0:0) Lectura/escritura del JSON
- [src/lib/validators.js](cci:7://file:///c:/Users/JhonRiv/Documents/Github/LoteryExpress/src/lib/validators.js:0:0-0:0) Validaciones
- [src/lib/raffle.js](cci:7://file:///c:/Users/JhonRiv/Documents/Github/LoteryExpress/src/lib/raffle.js:0:0-0:0) Lógica de sorteo (compat con números como objetos)
- `src/public/` Frontend estático (HTML/JS/CSS)
- [src/data/db.json](cci:7://file:///c:/Users/JhonRiv/Documents/Github/LoteryExpress/src/data/db.json:0:0-0:0) Base de datos (gitignore por defecto)

## Modelo de datos (db.json)

```json
{
  "participants": [
    {
      "cedula": "string",
      "nombre": "string",
      "telefono": "string",
      "numerosComprados": [{ "number": 123, "date": "YYYY-MM-DD" }],
      "payments": [
        {
          "id": 1,
          "date": "ISO-8601",
          "amount": 10,
          "balance": 10,
          "method": "efectivo|transferencia|yape|plim",
          "receipt": "string"
        }
      ]
    }
  ],
  "prizes": [
    {
      "id": 1,
      "nombre": "string",
      "descripcion": "string",
      "numeroGanador": null,
      "cedulaGanador": null
    }
  ],
  "meta": {
    "nextPrizeId": 2,
    "pricePerNumber": 10
  }
}
```
