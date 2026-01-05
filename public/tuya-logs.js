/**
 * Servizio di raccolta dati Tuya - Esegue ogni 15 secondi
 * Salva i dati in file JSON organizzati per data
 */

require('dotenv/config');

const {
  getAccessToken,
  tuyaRequest,
  BASE_URLS,
  saveDeviceLog
} = require('../server.cjs');

let lastAccessToken = null;
let lastAccessTokenTime = 0;
const TOKEN_EXPIRY = 30 * 60 * 1000; // 30 minuti

async function getValidAccessToken(baseUrl) {
  const now = Date.now();
  if (!lastAccessToken || (now - lastAccessTokenTime) > TOKEN_EXPIRY) {
    lastAccessToken = await getAccessToken(baseUrl);
    lastAccessTokenTime = now;
    console.log(`[${new Date().toISOString()}] Token rinnovato`);
  }
  return lastAccessToken;
}

async function collectDeviceData() {
  try {
    const clientId = process.env.TUYA_CLIENT_ID;
    const clientSecret = process.env.TUYA_CLIENT_SECRET;
    const deviceId = process.env.TUYA_DEVICE_ID;
    const region = process.env.TUYA_REGION || 'eu';

    if (!clientId || !clientSecret || !deviceId) {
      throw new Error('Mancano credenziali nel .env');
    }

    const baseUrl = BASE_URLS[region];
    const accessToken = await getValidAccessToken(baseUrl);

    // Ottieni stato del dispositivo
    const deviceStatus = await tuyaRequest({
      baseUrl,
      method: 'GET',
      path: `/v1.0/devices/${encodeURIComponent(deviceId)}/status`,
      query: {},
      body: null,
      accessToken
    });

    if (Array.isArray(deviceStatus)) {
      const data = {};
      deviceStatus.forEach(item => {
        data[item.code] = {
          value: item.value,
          unit: item.unit || ''
        };
      });

      await saveDeviceLog(deviceId, data);
      console.log(`[${new Date().toISOString()}] Dati salvati`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Errore raccolta dati:`, error.message);
  }
}

// Avvia la raccolta dati
async function startDataCollection() {
  console.log('🚀 Servizio di raccolta dati avviato\n');
  
  // Prima lettura immediata
  await collectDeviceData();
  
  // Poi ogni 15 secondi
  setInterval(collectDeviceData, 15 * 1000);
}

startDataCollection();
