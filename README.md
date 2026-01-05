# Tuya Energy Micro App

Micro app web per scaricare lo storico consumi con granularita 5 minuti e generare un grafico.

## Setup

1. Copia `.env.example` in `.env` e inserisci le credenziali Tuya.
2. Installa dipendenze e avvia:

```bash
npm install
npm start
```

Apri `http://localhost:3000`.

## Note

- Il DP code di default e `add_ele` (kWh). Se il tuo device usa un altro codice, cambialo nel form.
- I timestamp sono calcolati in locale (browser) per la data selezionata.
- L'endpoint usa `report-logs` (`/v1.0/iot-03/devices/{deviceId}/report-logs`) con `type=1`.
- Se la tua API risponde `uri path invalid`, puoi impostare `TUYA_STATS_PATHS` (lista separata da virgole) con i path corretti, ad esempio:
  - `/v1.0/iot-03/devices/{deviceId}/statistics`
  - `/v1.0/devices/{deviceId}/statistics`
- Per i report log puoi usare `TUYA_REPORT_PATHS` e `TUYA_REPORT_CODES` (codici separati da virgole).
