const fs = require('fs');

// Leggi il file JSON
const data = JSON.parse(fs.readFileSync('./data/logs/2026-01-05.json', 'utf8'));

console.log('\n=== ANALISI CONSUMO ENERGIA ===\n');
console.log(`Total records: ${data.length}`);
console.log(`Date range: ${data[0].timestamp} to ${data[data.length - 1].timestamp}\n`);

// Informazioni base
const firstEntry = data[0];
const lastEntry = data[data.length - 1];

console.log('--- DATI PRIMO E ULTIMO RECORD ---');
console.log(`Primo timestamp: ${firstEntry.timestamp}`);
console.log(`  add_ele: ${firstEntry.add_ele.value} (kWh x 100)`);
console.log(`  cur_power: ${firstEntry.cur_power.value} W\n`);

console.log(`Ultimo timestamp: ${lastEntry.timestamp}`);
console.log(`  add_ele: ${lastEntry.add_ele.value} (kWh x 100)`);
console.log(`  cur_power: ${lastEntry.cur_power.value} W\n`);

// Calcola consumo cumulato simulato da cur_power
let simulatedEnergyAccumulated = 0;
let measurements = [];

for (let i = 0; i < data.length; i++) {
  const current = data[i];
  const power = current.cur_power.value; // Watt
  const actualAddEle = current.add_ele.value;
  
  if (i > 0) {
    const prev = data[i - 1];
    const timeDiff = new Date(current.timestamp) - new Date(prev.timestamp);
    const hours = timeDiff / (1000 * 60 * 60);
    
    // Energia consumata in questo intervallo (in Wh)
    // Usiamo la potenza media tra i due punti
    const avgPower = (power + prev.cur_power.value) / 2;
    const energyInterval = avgPower * hours;
    
    simulatedEnergyAccumulated += energyInterval;
    
    if (i <= 5 || i === data.length - 1 || i % Math.floor(data.length / 10) === 0) {
      measurements.push({
        index: i,
        timestamp: current.timestamp,
        timeDiff: timeDiff,
        power: power,
        energyInterval: energyInterval.toFixed(2),
        simulated: (simulatedEnergyAccumulated / 1000).toFixed(3), // Converti in kWh
        actual: (actualAddEle / 100).toFixed(3), // add_ele è in 0.01 kWh
        difference: ((actualAddEle / 100) - (simulatedEnergyAccumulated / 1000)).toFixed(3)
      });
    }
  }
}

console.log('--- CONFRONTO CONSUMO SIMULATO vs REALE (add_ele) ---');
console.log('Index | Timestamp              | Power (W) | Simulated (kWh) | Actual (kWh) | Difference (kWh)');
console.log('------|------------------------|-----------|-----------------|--------------|-----------------');

measurements.forEach(m => {
  console.log(`${String(m.index).padEnd(6)}| ${m.timestamp} | ${String(m.power).padStart(9)} | ${String(m.simulated).padStart(15)} | ${String(m.actual).padStart(12)} | ${String(m.difference).padStart(15)}`);
});

// Statistiche finali
console.log('\n--- STATISTICHE FINALI ---');
console.log(`Consumo simulato (da cur_power): ${(simulatedEnergyAccumulated / 1000).toFixed(3)} kWh`);
console.log(`Consumo reale (add_ele):          ${(lastEntry.add_ele.value / 100).toFixed(3)} kWh`);
console.log(`Differenza:                       ${((lastEntry.add_ele.value / 100) - (simulatedEnergyAccumulated / 1000)).toFixed(3)} kWh`);
console.log(`Errore relativo:                  ${(((lastEntry.add_ele.value / 100) - (simulatedEnergyAccumulated / 1000)) / (lastEntry.add_ele.value / 100) * 100).toFixed(2)}%\n`);

// Analisi dettagliata degli intervalli di tempo
console.log('--- ANALISI INTERVALLI DI TEMPO ---');
const timeIntervals = [];
for (let i = 1; i < data.length; i++) {
  const timeDiff = new Date(data[i].timestamp) - new Date(data[i-1].timestamp);
  timeIntervals.push(timeDiff);
}

const avgInterval = timeIntervals.reduce((a, b) => a + b, 0) / timeIntervals.length;
const minInterval = Math.min(...timeIntervals);
const maxInterval = Math.max(...timeIntervals);

console.log(`Intervallo medio: ${avgInterval.toFixed(0)} ms (${(avgInterval / 1000).toFixed(2)} sec)`);
console.log(`Intervallo minimo: ${minInterval} ms`);
console.log(`Intervallo massimo: ${maxInterval} ms`);

// Conta quanti intervalli sono circa 15 sec
const fifteenSecIntervals = timeIntervals.filter(t => t >= 14000 && t <= 16000).length;
console.log(`Intervalli ~15 sec: ${fifteenSecIntervals} su ${timeIntervals.length}\n`);

// Analizza i valori di add_ele
console.log('--- ANALISI add_ele ---');
const addEleValues = data.map(d => d.add_ele.value);
const uniqueAddEle = [...new Set(addEleValues)];
console.log(`Valori unici di add_ele: ${uniqueAddEle.length}`);
console.log(`Valori: ${uniqueAddEle.slice(0, 20).join(', ')}${uniqueAddEle.length > 20 ? '...' : ''}\n`);

// Analizza variazioni di add_ele
console.log('--- VARIAZIONI add_ele (incrementi) ---');
const increments = [];
for (let i = 1; i < data.length; i++) {
  const diff = data[i].add_ele.value - data[i-1].add_ele.value;
  if (diff !== 0) {
    increments.push({
      index: i,
      timestamp: data[i].timestamp,
      prev: data[i-1].add_ele.value,
      current: data[i].add_ele.value,
      increment: diff,
      power: data[i].cur_power.value
    });
  }
}

if (increments.length > 0) {
  console.log(`Total changes in add_ele: ${increments.length}`);
  console.log('\nPrimi 10 incrementi:');
  console.log('Index | Timestamp              | Old Value | New Value | Increment | Power (W)');
  console.log('------|------------------------|-----------|-----------|-----------|-----------');
  
  increments.slice(0, 10).forEach(inc => {
    console.log(`${String(inc.index).padEnd(6)}| ${inc.timestamp} | ${String(inc.prev).padStart(9)} | ${String(inc.current).padStart(9)} | ${String(inc.increment).padStart(9)} | ${String(inc.power).padStart(9)}`);
  });
} else {
  console.log('NESSUN CAMBIO in add_ele - è costante durante tutto il periodo!');
}
