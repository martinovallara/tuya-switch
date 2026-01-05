const fs = require('fs');

// Leggi il file JSON
const data = JSON.parse(fs.readFileSync('./data/logs/2026-01-05.json', 'utf8'));

console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                        ANALISI CALCOLO DeltaT                                   ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

console.log('┌─ COME VIENE CALCOLATO DeltaT ────────────────────────────────────────────────────┐\n');

// Prendi i primi 5 intervalli
for (let i = 1; i <= 5; i++) {
  const prev = data[i - 1];
  const current = data[i];
  
  const timeDiffMs = new Date(current.timestamp) - new Date(prev.timestamp);
  const timeDiffSec = timeDiffMs / 1000;
  const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
  
  console.log(`INTERVALLO ${i}:`);
  console.log(`  Timestamp precedente: ${prev.timestamp}`);
  console.log(`  Timestamp attuale:    ${current.timestamp}`);
  console.log(`  Differenza in ms:     ${timeDiffMs} ms`);
  console.log(`  Differenza in sec:    ${timeDiffSec.toFixed(2)} sec`);
  console.log(`  Differenza in ore:    ${timeDiffHours.toFixed(6)} ore`);
  console.log(`  Frazione di ora:      1/${(1/timeDiffHours).toFixed(0)} di ora\n`);
}

console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// Analizza tutti gli intervalli
console.log('┌─ STATISTICHE SU TUTTI GLI INTERVALLI ────────────────────────────────────────────┐\n');

const timeIntervals = [];
for (let i = 1; i < data.length; i++) {
  const timeDiffMs = new Date(data[i].timestamp) - new Date(data[i-1].timestamp);
  timeIntervals.push(timeDiffMs);
}

const avgIntervalMs = timeIntervals.reduce((a, b) => a + b, 0) / timeIntervals.length;
const avgIntervalSec = avgIntervalMs / 1000;
const avgIntervalHours = avgIntervalMs / (1000 * 60 * 60);

console.log(`Numero di intervalli: ${timeIntervals.length}`);
console.log(`\nIntervallo MEDIO:`);
console.log(`  In millisecondi: ${avgIntervalMs.toFixed(2)} ms`);
console.log(`  In secondi:      ${avgIntervalSec.toFixed(2)} sec`);
console.log(`  In ore:          ${avgIntervalHours.toFixed(6)} ore`);
console.log(`  Frazione:        1/${(1/avgIntervalHours).toFixed(0)} di ora\n`);

console.log(`Intervallo MINIMO:`);
const minInterval = Math.min(...timeIntervals);
console.log(`  ${(minInterval / 1000).toFixed(2)} sec = ${(minInterval / (1000 * 60 * 60)).toFixed(6)} ore = 1/${(1000 * 60 * 60 / minInterval).toFixed(0)} di ora\n`);

console.log(`Intervallo MASSIMO:`);
const maxInterval = Math.max(...timeIntervals);
console.log(`  ${(maxInterval / 1000).toFixed(2)} sec = ${(maxInterval / (1000 * 60 * 60)).toFixed(6)} ore = 1/${(1000 * 60 * 60 / maxInterval).toFixed(0)} di ora\n`);

console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// Verifica: cosa significa 1/900 di ora?
console.log('┌─ VERIFICA: 1/900 di ora corrisponde a quanti secondi? ──────────────────────────┐\n');

const timeFor1Over900 = 3600 / 900;
console.log(`1/900 di ora = 3600 sec / 900 = ${timeFor1Over900.toFixed(1)} secondi\n`);

console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// Calcolo energia con diversi DeltaT
console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║              IMPATTO DI DIVERSI DeltaT SULLA ENERGIA CALCOLATA                  ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

// Calcola la potenza media
const powers = data.map(d => d.cur_power.value);
const avgPower = powers.reduce((a, b) => a + b, 0) / powers.length;
const minPower = Math.min(...powers);
const maxPower = Math.max(...powers);

console.log(`Statistica potenze:`);
console.log(`  Min:  ${minPower} W`);
console.log(`  Max:  ${maxPower} W`);
console.log(`  Media: ${avgPower.toFixed(1)} W\n`);

// Durata totale
const durationMs = new Date(data[data.length - 1].timestamp) - new Date(data[0].timestamp);
const durationHours = durationMs / (1000 * 60 * 60);
const durationSec = durationMs / 1000;

console.log(`Durata totale: ${durationSec.toFixed(1)} sec = ${durationHours.toFixed(3)} ore\n`);

// Calcolo energia con 15 sec
let energyWith15Sec = 0;
for (let i = 1; i < data.length; i++) {
  const avgP = (data[i].cur_power.value + data[i-1].cur_power.value) / 2;
  const timeDiffMs = new Date(data[i].timestamp) - new Date(data[i-1].timestamp);
  const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
  energyWith15Sec += avgP * timeDiffHours;
}

console.log('┌─ SCENARIO 1: Usando gli intervalli REALI (~15 sec) ────────────────────────────┐\n');
console.log(`DeltaT medio: 15.01 secondi = 1/240 di ora`);
console.log(`Numero di intervalli: ${data.length - 1}`);
console.log(`Energia calcolata: ${energyWith15Sec.toFixed(3)} kWh\n`);
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// Calcolo energia con 1/900 di ora (4 secondi)
console.log('┌─ SCENARIO 2: Usando DeltaT = 1/900 di ora (4 secondi) ──────────────────────────┐\n');

const deltaTFor1Over900 = 1 / 900; // ore
const numIntervalsFor1Over900 = Math.round(durationHours / deltaTFor1Over900);
const energyWith1Over900 = avgPower * durationHours / 1000;

console.log(`DeltaT: 1/900 di ora = ${4.0} secondi`);
console.log(`Numero di intervalli: ${numIntervalsFor1Over900}`);
console.log(`Energia calcolata (media * durata / 1000): ${energyWith1Over900.toFixed(3)} kWh\n`);
console.log('NOTA: Con 1/900 di ora, ottengo lo stesso risultato perche E = media * durata\n');

// Confronto con add_ele
const addEleDiff = data[data.length - 1].add_ele.value - data[0].add_ele.value;
const addEleKwh = addEleDiff / 100;

console.log('┌─ CONFRONTO CON CONTATORE add_ele ────────────────────────────────────────────────┐\n');
console.log(`add_ele: ${addEleKwh.toFixed(3)} kWh`);
console.log(`Integrale (15 sec): ${energyWith15Sec.toFixed(3)} kWh`);
console.log(`Differenza: ${Math.abs(addEleKwh - energyWith15Sec).toFixed(3)} kWh (${(Math.abs(addEleKwh - energyWith15Sec) / addEleKwh * 100).toFixed(2)}%)\n`);
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// VERIFICA MATEMATICA
console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                      VERIFICA MATEMATICA                                        ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

console.log('La formula dell\'integrale è:');
console.log('  E (kWh) = ∫ P(t) dt / 1000\n');

console.log('Che con campionamento discreto diventa:');
console.log('  E = Σ [ (P[i] + P[i-1])/2 ] × DeltaT[i]\n');

console.log('Dove:');
console.log('  P è in Watt');
console.log('  DeltaT è in ore');
console.log('  Il risultato è in Wh (divido per 1000 per kWh)\n');

console.log('Con i dati reali:');
console.log(`  Potenza media: ${avgPower.toFixed(1)} W`);
console.log(`  Durata: ${durationHours.toFixed(3)} ore`);
console.log(`  Energia = ${avgPower.toFixed(1)} × ${durationHours.toFixed(3)} = ${(avgPower * durationHours).toFixed(1)} Wh = ${(avgPower * durationHours / 1000).toFixed(3)} kWh\n`);

console.log(`Questo DOVREBBE essere il valore corretto (approssimazione):\n`);
console.log(`  ${(avgPower * durationHours / 1000).toFixed(3)} kWh (ma i dati reali sono ${addEleKwh.toFixed(3)} kWh)\n`);

if (Math.abs((avgPower * durationHours / 1000) - addEleKwh) / addEleKwh * 100 < 5) {
  console.log('✅ I valori sono COERENTI (differenza < 5%)\n');
} else {
  console.log('⚠️  I valori hanno una discrepanza significativa\n');
}
