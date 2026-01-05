const fs = require('fs');

// Leggi il file JSON
const data = JSON.parse(fs.readFileSync('./data/logs/2026-01-05.json', 'utf8'));

console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║            CREAZIONE CSV CON UNITÀ CORRETTE                                     ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

// Crea array per CSV
const csvRows = [];

// Header con unità di misura
const headers = [
  'timestamp',
  'switch_1',
  'voltage_V',
  'current_A',
  'power_W',
  'add_ele_Wh',
  'fault'
];

csvRows.push(headers.join(','));

// Converti e scrivi i dati
let prevTimestamp = null;
let energyAccumulated = 0;

data.forEach((record, index) => {
  // Conversioni
  const voltage = (record.cur_voltage.value / 10).toFixed(1);
  const current = (record.cur_current.value / 1000).toFixed(3);
  const power = (record.cur_power.value / 10).toFixed(1);
  const addEle = record.add_ele.value;
  
  // Calcola energia cumulata
  if (index > 0 && prevTimestamp !== null) {
    const timeDiffMs = new Date(record.timestamp) - new Date(prevTimestamp);
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
    const avgPower = (parseFloat(power) + parseFloat(data[index-1].cur_power.value / 10)) / 2;
    const energyInterval = avgPower * timeDiffHours; // Wh
    energyAccumulated += energyInterval;
  }
  prevTimestamp = record.timestamp;
  
  const row = [
    record.timestamp,
    record.switch_1.value,
    voltage,
    current,
    power,
    addEle,
    record.fault.value
  ];
  csvRows.push(row.join(','));
});

// Scrivi il CSV
const csvContent = csvRows.join('\n');
const csvFilePath = './data/logs/2026-01-05-corrected.csv';

fs.writeFileSync(csvFilePath, csvContent, 'utf8');

console.log(`✅ File CSV con unità corrette creato!\n`);
console.log(`📁 Percorso: ${csvFilePath}`);
console.log(`📊 Record: ${data.length}`);
console.log(`📋 Colonne: ${headers.join(', ')}\n`);

console.log('┌─ CONVERSIONI APPLICATE ──────────────────────────────────────────────────────────┐\n');
console.log('voltage_V = cur_voltage / 10');
console.log('current_A = cur_current / 1000');
console.log('power_W = cur_power / 10');
console.log('add_ele_Wh = add_ele × 1 (in Wh)\n');

console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// Mostra anteprima
console.log('┌─ ANTEPRIMA (primi 5 record) ─────────────────────────────────────────────────────┐\n');
console.log(csvRows.slice(0, 6).join('\n'));
console.log('\n...\n');
console.log(csvRows.slice(-2).join('\n'));

console.log('\n└──────────────────────────────────────────────────────────────────────────────────┘\n');

// Statistiche
const fileSize = fs.statSync(csvFilePath).size;
console.log('┌─ STATISTICHE ────────────────────────────────────────────────────────────────────┐\n');
console.log(`Dimensione file: ${(fileSize / 1024).toFixed(2)} KB`);
console.log(`Numero di righe: ${csvRows.length} (inclusa intestazione)\n`);
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');
