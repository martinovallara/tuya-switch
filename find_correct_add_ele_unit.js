const fs = require('fs');

// Leggi il file JSON
const data = JSON.parse(fs.readFileSync('./data/logs/2026-01-05.json', 'utf8'));

console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║              RICERCA UNITÀ CORRETTA PER add_ele                                  ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

// Calcola l'energia dall'integrale di cur_power
let totalEnergyWh = 0;
let prevPower = null;

for (let i = 0; i < data.length; i++) {
  const power = data[i].cur_power.value / 10; // W (corretto)
  
  if (prevPower !== null) {
    const avgPower = (power + prevPower) / 2;
    const deltaT = 15 / 3600; // ore
    const energyInterval = avgPower * deltaT; // Wh
    totalEnergyWh += energyInterval;
  }
  prevPower = power;
}

const energyKwh = totalEnergyWh / 1000;
const energyWh = totalEnergyWh;

// add_ele
const addEleStart = data[0].add_ele.value;
const addEleEnd = data[data.length - 1].add_ele.value;
const addEleDiff = addEleEnd - addEleStart;

console.log('┌─ DATI NOTI ──────────────────────────────────────────────────────────────────────┐\n');
console.log(`Energia dall'integrale di cur_power: ${energyKwh.toFixed(3)} kWh = ${energyWh.toFixed(2)} Wh`);
console.log(`Incremento add_ele: ${addEleDiff}\n`);
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

console.log('┌─ IPOTESI: Quale unità per add_ele? ──────────────────────────────────────────────┐\n');

// Prova varie ipotesi
const hypotheses = [
  { name: '0.1 Wh per unità', factor: 0.1 },
  { name: '1 Wh per unità', factor: 1 },
  { name: '10 Wh per unità', factor: 10 },
  { name: '100 Wh per unità (0.1 kWh)', factor: 100 },
  { name: '1000 Wh per unità (1 kWh)', factor: 1000 },
  { name: '0.01 kWh per unità', factor: 10 },
  { name: 'Unità sconosciuta - test lineare', factor: null }
];

hypotheses.forEach(hyp => {
  if (hyp.factor !== null) {
    const energyFromAddEle = (addEleDiff * hyp.factor) / 1000; // kWh
    const diff = Math.abs(energyKwh - energyFromAddEle);
    const percent = (diff / energyKwh) * 100;
    const match = percent < 5 ? '✅' : '  ';
    
    console.log(`${match} ${hyp.name.padEnd(35)} → ${energyFromAddEle.toFixed(3)} kWh (errore: ${percent.toFixed(1)}%)`);
  }
});

console.log(`\n  Unità che darebbe match perfetto:`);
const perfectFactor = energyWh / addEleDiff;
console.log(`    add_ele × ${perfectFactor.toFixed(3)} = ${energyWh.toFixed(2)} Wh\n`);
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// Verifica con V × I
console.log('┌─ VERIFICA ALTERNATIVA: Usando V × I ─────────────────────────────────────────────┐\n');

let totalEnergyVxI = 0;
for (let i = 1; i < data.length; i++) {
  const voltage = data[i].cur_voltage.value / 10; // V
  const current = data[i].cur_current.value / 1000; // A
  const power = voltage * current; // W
  
  const prevVoltage = data[i-1].cur_voltage.value / 10;
  const prevCurrent = data[i-1].cur_current.value / 1000;
  const prevPower = prevVoltage * prevCurrent;
  
  const avgPower = (power + prevPower) / 2;
  const deltaT = 15 / 3600;
  const energyInterval = avgPower * deltaT;
  totalEnergyVxI += energyInterval;
}

const energyVxIKwh = totalEnergyVxI / 1000;
console.log(`Energia da V × I: ${energyVxIKwh.toFixed(3)} kWh\n`);

// Quale fattore per add_ele con V×I?
const perfectFactorVxI = (totalEnergyVxI) / addEleDiff;
console.log(`Se usiamo V × I, add_ele dovrebbe essere moltiplicato per: ${perfectFactorVxI.toFixed(3)}\n`);

console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// Analisi dei picchi
console.log('┌─ ANALISI PICCHI DI POTENZA ──────────────────────────────────────────────────────┐\n');

const powerValues = data.map(d => d.cur_power.value / 10);
const maxPower = Math.max(...powerValues);
const maxIndex = powerValues.indexOf(maxPower);

console.log(`Picco di potenza massima: ${maxPower.toFixed(1)} W`);
console.log(`Timestamp: ${data[maxIndex].timestamp}`);
console.log(`Voltage raw: ${data[maxIndex].cur_voltage.value} (${(data[maxIndex].cur_voltage.value / 10).toFixed(1)} V)`);
console.log(`Current raw: ${data[maxIndex].cur_current.value} (${(data[maxIndex].cur_current.value / 1000).toFixed(3)} A)`);
console.log(`Power da cur_power: ${maxPower.toFixed(1)} W`);
console.log(`Power da V×I: ${((data[maxIndex].cur_voltage.value / 10) * (data[maxIndex].cur_current.value / 1000)).toFixed(1)} W\n`);

console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');
