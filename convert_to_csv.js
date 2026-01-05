const fs = require('fs');
const path = require('path');

// Leggi il file JSON
const data = JSON.parse(fs.readFileSync('./data/logs/2026-01-05.json', 'utf8'));

console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                    CONVERSIONE JSON A CSV                                       ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

// Estrai i campi principali
const csvRows = [];

// Header
const headers = [
  'timestamp',
  'switch_1',
  'add_ele',
  'cur_current',
  'cur_power',
  'cur_voltage',
  'fault'
];

csvRows.push(headers.join(','));

// Dati
data.forEach(record => {
  const row = [
    record.timestamp,
    record.switch_1.value,
    record.add_ele.value,
    record.cur_current.value,
    record.cur_power.value,
    record.cur_voltage.value,
    record.fault.value
  ];
  csvRows.push(row.join(','));
});

// Scrivi il CSV
const csvContent = csvRows.join('\n');
const csvFilePath = './data/logs/2026-01-05.csv';

fs.writeFileSync(csvFilePath, csvContent, 'utf8');

console.log(`✅ File CSV creato con successo!\n`);
console.log(`📁 Percorso: ${csvFilePath}`);
console.log(`📊 Record: ${data.length}`);
console.log(`📋 Colonne: ${headers.join(', ')}\n`);

// Mostra un anteprima
console.log('┌─ ANTEPRIMA (primi 5 record) ─────────────────────────────────────────────────────┐\n');
console.log(csvRows.slice(0, 6).join('\n'));
console.log('\n...\n');
console.log('┌─ ULTIMI 2 RECORD ────────────────────────────────────────────────────────────────┐\n');
console.log(csvRows.slice(-2).join('\n'));
console.log('\n└──────────────────────────────────────────────────────────────────────────────────┘\n');

// Statistiche
console.log('┌─ STATISTICHE FILE CSV ───────────────────────────────────────────────────────────┐\n');
const fileSize = fs.statSync(csvFilePath).size;
console.log(`Dimensione file: ${(fileSize / 1024).toFixed(2)} KB`);
console.log(`Numero di righe: ${csvRows.length} (inclusa intestazione)`);
console.log(`Numero di record dati: ${data.length}`);
console.log('\n└──────────────────────────────────────────────────────────────────────────────────┘\n');
