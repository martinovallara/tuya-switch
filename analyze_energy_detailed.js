const fs = require('fs');

// Leggi il file JSON
const data = JSON.parse(fs.readFileSync('./data/logs/2026-01-05.json', 'utf8'));

console.log('\n=== INTERPRETAZIONE VALORI TUYA ===\n');

// Analisi 1: Capire l'unità di misura di add_ele
console.log('--- IPOTESI 1: add_ele in unità 0.01 kWh (100 = 1 kWh) ---');
const firstAddEle = data[0].add_ele.value;
const lastAddEle = data[data.length - 1].add_ele.value;
const addEleDiff = lastAddEle - firstAddEle;
const addEleKwh = addEleDiff / 100;

console.log(`Valore iniziale add_ele: ${firstAddEle}`);
console.log(`Valore finale add_ele:   ${lastAddEle}`);
console.log(`Incremento:              ${addEleDiff}`);
console.log(`Consumo (in kWh):        ${addEleKwh.toFixed(3)} kWh\n`);

// Analisi 2: Calcola durata e potenza media
const startTime = new Date(data[0].timestamp);
const endTime = new Date(data[data.length - 1].timestamp);
const durationMs = endTime - startTime;
const durationHours = durationMs / (1000 * 60 * 60);
const durationMinutes = durationMs / (1000 * 60);

console.log('--- DURATA E POTENZA MEDIA ---');
console.log(`Inizio:              ${startTime.toISOString()}`);
console.log(`Fine:                ${endTime.toISOString()}`);
console.log(`Durata:              ${durationMinutes.toFixed(1)} minuti (${durationHours.toFixed(4)} ore)`);

const avgPowerFromAddEle = (addEleKwh / durationHours) * 1000;
console.log(`Potenza media da add_ele: ${avgPowerFromAddEle.toFixed(1)} W\n`);

// Analisi 3: Simula per intervalli di 15 secondi
console.log('--- SIMULAZIONE CONSUMO PER INTERVALLI DI 15 SEC ---');
let simulatedAddEle = firstAddEle;
let powerReadings = [];

for (let i = 1; i < data.length; i++) {
  const current = data[i];
  const prev = data[i - 1];
  const power = (current.cur_power.value + prev.cur_power.value) / 2;
  
  // Energia in 15 secondi: Power (W) * Time (h) = Power * (15/3600) ore
  const energyWh = power * (15 / 3600);
  const energyKwh = energyWh / 1000;
  const incrementBy100 = Math.round(energyKwh * 100);
  
  simulatedAddEle += incrementBy100;
  
  if (i <= 10 || i % 50 === 0) {
    powerReadings.push({
      i,
      timestamp: current.timestamp,
      power: power.toFixed(0),
      energy15sec: energyWh.toFixed(3),
      increment: incrementBy100,
      simulated: simulatedAddEle,
      actual: current.add_ele.value,
      match: simulatedAddEle === current.add_ele.value ? '✓' : 'X'
    });
  }
}

console.log('Index | Timestamp              | Power (W) | Energy 15s (Wh) | Increment | Simulated | Actual   | Match');
console.log('------|------------------------|-----------|-----------------|-----------|-----------|-----------|-----------');

powerReadings.forEach(p => {
  console.log(`${String(p.i).padEnd(6)}| ${p.timestamp} | ${String(p.power).padStart(9)} | ${String(p.energy15sec).padStart(15)} | ${String(p.increment).padStart(9)} | ${String(p.simulated).padStart(9)} | ${String(p.actual).padStart(9)} | ${p.match}`);
});

// Analisi 4: Confronta incrementi effettivi vs simulati
console.log('\n--- INCREMENTI EFFETTIVI di add_ele ---');
const increments = [];
for (let i = 1; i < data.length; i++) {
  const diff = data[i].add_ele.value - data[i-1].add_ele.value;
  if (diff !== 0) {
    increments.push({
      index: i,
      timestamp: data[i].timestamp,
      power: data[i].cur_power.value,
      increment: diff
    });
  }
}

console.log(`Total incrementi rilevati: ${increments.length}\n`);
console.log('Index | Timestamp              | Power (W) | Increment');
console.log('------|------------------------|-----------|-----------');

increments.slice(0, 15).forEach(inc => {
  console.log(`${String(inc.index).padEnd(6)}| ${inc.timestamp} | ${String(inc.power).padStart(9)} | ${String(inc.increment).padStart(9)}`);
});

// Analisi 5: Correlazione tra potenza e incrementi
console.log('\n--- ANALISI CORRELAZIONE POTENZA - INCREMENTI ---');
const avgPowerByIncrement = {};

increments.forEach(inc => {
  if (!avgPowerByIncrement[inc.increment]) {
    avgPowerByIncrement[inc.increment] = { sum: 0, count: 0, values: [] };
  }
  avgPowerByIncrement[inc.increment].sum += inc.power;
  avgPowerByIncrement[inc.increment].count += 1;
  avgPowerByIncrement[inc.increment].values.push(inc.power);
});

Object.keys(avgPowerByIncrement).sort((a, b) => parseInt(a) - parseInt(b)).forEach(inc => {
  const data = avgPowerByIncrement[inc];
  const avg = (data.sum / data.count).toFixed(1);
  const min = Math.min(...data.values);
  const max = Math.max(...data.values);
  console.log(`Incremento ${String(inc).padStart(3)}: Potenza media = ${String(avg).padStart(7)} W (min: ${min}, max: ${max}) - ${data.count} volte`);
});

// Analisi 6: Stima della formula
console.log('\n--- INTERPRETAZIONE FORMULA ---');
console.log('\nIPOTESI: add_ele rappresenta energia cumulata in unità 0.01 kWh');
console.log(`Gli incrementi di 100 unità = 1 kWh di consumo`);
console.log(`\nIn 15 secondi con potenza P (W):`);
console.log(`  Energia = P * (15/3600) Wh = P * 0.00417 Wh`);
console.log(`  Incremento add_ele = energia * 100 = P * 0.417`);
console.log(`\nEsempi:`);
console.log(`  P = 744 W  → increment = ${(744 * 0.417).toFixed(1)} (atteso ~31)`);
console.log(`  P = 1702 W → increment = ${(1702 * 0.417).toFixed(1)} (atteso ~71)`);
console.log(`  P = 30000 W → increment = ${(30000 * 0.417).toFixed(1)} (atteso ~100-125)`);

// Analisi 7: Calcola consumo totale attendibile
console.log('\n--- CONSUMO TOTALE ---');
console.log(`Consumo riportato (add_ele):    ${addEleKwh.toFixed(3)} kWh`);
console.log(`Consumo stimato (cur_power):    ${(increments.length * 100 / 100).toFixed(3)} kWh`);
console.log(`Potenza media osservata:        ${avgPowerFromAddEle.toFixed(1)} W`);
console.log(`Durata misurata:                ${durationMinutes.toFixed(0)} minuti`);
