const fs = require('fs');

// Leggi il file JSON
const data = JSON.parse(fs.readFileSync('./data/logs/2026-01-05.json', 'utf8'));

console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                    ANALISI CON UNITÀ CORRETTE                                   ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

console.log('┌─ CONVERSIONE UNITÀ DI MISURA ─────────────────────────────────────────────────────┐\n');

console.log('Fattori di conversione:');
console.log('  • cur_voltage: decimi di volt → dividere per 10');
console.log('  • cur_current: milliampere (mA) → dividere per 1000');
console.log('  • cur_power: decimi di Watt → dividere per 10');
console.log('  • add_ele: assumendo 10 Wh per unità');
console.log('  • DeltaT: 15 sec = 15/3600 ore\n');

console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// Estrai e converti i dati
let totalEnergyWh = 0;
let measurements = [];

for (let i = 0; i < data.length; i++) {
  const record = data[i];
  
  // Conversioni
  const voltage = record.cur_voltage.value / 10;        // V
  const current = record.cur_current.value / 1000;      // A
  const power = record.cur_power.value / 10;            // W
  
  measurements.push({
    index: i,
    timestamp: record.timestamp,
    switch: record.switch_1.value,
    voltage: voltage,
    current: current,
    power: power,
    add_ele_raw: record.add_ele.value,
    fault: record.fault.value
  });
  
  // Calcola l'integrale (escludendo il primo punto)
  if (i > 0) {
    const prev = measurements[i - 1];
    const avgPower = (power + prev.power) / 2;
    const deltaT = 15 / 3600; // ore
    const energyInterval = avgPower * deltaT; // Wh
    totalEnergyWh += energyInterval;
  }
}

console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                      STATISTICHE GRANDEZZE FISICHE                              ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

// Statistiche
const voltages = measurements.map(m => m.voltage);
const currents = measurements.map(m => m.current);
const powers = measurements.map(m => m.power);

const avgVoltage = voltages.reduce((a, b) => a + b) / voltages.length;
const minVoltage = Math.min(...voltages);
const maxVoltage = Math.max(...voltages);

const avgCurrent = currents.reduce((a, b) => a + b) / currents.length;
const minCurrent = Math.min(...currents);
const maxCurrent = Math.max(...currents);

const avgPower = powers.reduce((a, b) => a + b) / powers.length;
const minPower = Math.min(...powers);
const maxPower = Math.max(...powers);

console.log('┌─ TENSIONE (Volt) ────────────────────────────────────────────────────────────────┐\n');
console.log(`  Min:    ${minVoltage.toFixed(1)} V`);
console.log(`  Max:    ${maxVoltage.toFixed(1)} V`);
console.log(`  Media:  ${avgVoltage.toFixed(1)} V\n`);
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

console.log('┌─ CORRENTE (Ampere) ──────────────────────────────────────────────────────────────┐\n');
console.log(`  Min:    ${minCurrent.toFixed(3)} A`);
console.log(`  Max:    ${maxCurrent.toFixed(3)} A`);
console.log(`  Media:  ${avgCurrent.toFixed(3)} A\n`);
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

console.log('┌─ POTENZA (Watt) ─────────────────────────────────────────────────────────────────┐\n');
console.log(`  Min:    ${minPower.toFixed(1)} W`);
console.log(`  Max:    ${maxPower.toFixed(1)} W`);
console.log(`  Media:  ${avgPower.toFixed(1)} W\n`);
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// Verifica: V × I = P
const avgPowerCalculated = avgVoltage * avgCurrent;
console.log('┌─ VERIFICA: V × I ────────────────────────────────────────────────────────────────┐\n');
console.log(`  Potenza media misurata:    ${avgPower.toFixed(1)} W`);
console.log(`  Potenza calcolata (V×I):   ${avgPowerCalculated.toFixed(1)} W`);
console.log(`  Differenza:                ${Math.abs(avgPower - avgPowerCalculated).toFixed(1)} W\n`);

if (Math.abs(avgPower - avgPowerCalculated) / avgPowerCalculated * 100 < 5) {
  console.log('✅ Le misurazioni sono COERENTI (errore < 5%)\n');
} else {
  console.log('⚠️  Le misurazioni hanno discrepanze\n');
}

console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// Energia
console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                         CALCOLO ENERGIA                                         ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

const durationSec = new Date(data[data.length - 1].timestamp) - new Date(data[0].timestamp);
const durationHours = durationSec / (1000 * 60 * 60);
const durationMin = durationSec / (1000 * 60);

const energyKwh = totalEnergyWh / 1000;

console.log('┌─ METODO 1: INTEGRALE DI cur_power ──────────────────────────────────────────────┐\n');
console.log(`  Durata:          ${durationMin.toFixed(1)} minuti (${durationHours.toFixed(3)} ore)`);
console.log(`  Potenza media:   ${avgPower.toFixed(1)} W`);
console.log(`  DeltaT:          15/3600 ore (15 secondi)`);
console.log(`  Numero campioni: ${data.length}`);
console.log(`  Numero intervalli: ${data.length - 1}`);
console.log(`\n  Energia integrata: ${totalEnergyWh.toFixed(2)} Wh = ${energyKwh.toFixed(3)} kWh\n`);
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// add_ele
console.log('┌─ METODO 2: CONTATORE add_ele ────────────────────────────────────────────────────┐\n');

const addEleStart = data[0].add_ele.value;
const addEleEnd = data[data.length - 1].add_ele.value;
const addEleDiff = addEleEnd - addEleStart;

console.log(`  add_ele inizio:     ${addEleStart}`);
console.log(`  add_ele fine:       ${addEleEnd}`);
console.log(`  Incremento:         ${addEleDiff}`);

// Ipotesi: add_ele è in 10 Wh
const energyFromAddEle_10Wh = (addEleDiff * 10) / 1000;

// Ipotesi: add_ele è in 0.01 kWh (100 = 1 kWh)
const energyFromAddEle_001kWh = addEleDiff / 100;

console.log(`\n  Se add_ele è in 10 Wh/unità:`);
console.log(`    Energia = ${addEleDiff} × 10 Wh = ${addEleDiff * 10} Wh = ${energyFromAddEle_10Wh.toFixed(3)} kWh`);

console.log(`\n  Se add_ele è in 0.01 kWh/unità:`);
console.log(`    Energia = ${addEleDiff} / 100 = ${energyFromAddEle_001kWh.toFixed(3)} kWh\n`);

console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// Confronto
console.log('┌─ CONFRONTO ──────────────────────────────────────────────────────────────────────┐\n');

const diff1 = Math.abs(energyKwh - energyFromAddEle_10Wh);
const percent1 = (diff1 / energyFromAddEle_10Wh) * 100;

const diff2 = Math.abs(energyKwh - energyFromAddEle_001kWh);
const percent2 = (diff2 / energyFromAddEle_001kWh) * 100;

console.log(`  Integrale (cur_power):        ${energyKwh.toFixed(3)} kWh`);
console.log(`  add_ele (se 10 Wh/unità):     ${energyFromAddEle_10Wh.toFixed(3)} kWh  → Differenza: ${diff1.toFixed(3)} kWh (${percent1.toFixed(2)}%)`);
console.log(`  add_ele (se 0.01 kWh/unità):  ${energyFromAddEle_001kWh.toFixed(3)} kWh  → Differenza: ${diff2.toFixed(3)} kWh (${percent2.toFixed(2)}%)`);

if (percent1 < 5) {
  console.log(`\n✅ MIGLIORE MATCH: add_ele è in 10 Wh per unità\n`);
} else if (percent2 < 5) {
  console.log(`\n✅ MIGLIORE MATCH: add_ele è in 0.01 kWh per unità\n`);
} else {
  console.log(`\n⚠️  Nessun match perfetto\n`);
}

console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// Campioni
console.log('┌─ ANTEPRIMA DATI CONVERTITI (primi 5 record) ─────────────────────────────────────┐\n');

console.log('Index | Timestamp              | Voltage(V) | Current(A) | Power(W)');
console.log('------|------------------------|------------|------------|----------');

for (let i = 0; i < Math.min(5, measurements.length); i++) {
  const m = measurements[i];
  console.log(`${String(i).padEnd(6)}| ${m.timestamp} | ${String(m.voltage.toFixed(1)).padStart(10)} | ${String(m.current.toFixed(3)).padStart(10)} | ${String(m.power.toFixed(1)).padStart(8)}`);
}

console.log('\n└──────────────────────────────────────────────────────────────────────────────────┘\n');
