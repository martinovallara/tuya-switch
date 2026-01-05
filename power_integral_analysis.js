const fs = require('fs');

// Leggi il file JSON
const data = JSON.parse(fs.readFileSync('./data/logs/2026-01-05.json', 'utf8'));

console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                 INTEGRALE POTENZA - ENERGIA CONSUMATA                           ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

// =============================================================================
// 1. Analizza gli intervalli di tempo
// =============================================================================
console.log('┌─ ANALISI INTERVALLI DI CAMPIONAMENTO ────────────────────────────────────────────┐');
console.log('│\n');

const timeIntervals = [];
for (let i = 1; i < data.length; i++) {
  const timeDiff = new Date(data[i].timestamp) - new Date(data[i-1].timestamp);
  timeIntervals.push(timeDiff);
}

const avgIntervalMs = timeIntervals.reduce((a, b) => a + b, 0) / timeIntervals.length;
const avgIntervalSec = avgIntervalMs / 1000;
const minIntervalSec = Math.min(...timeIntervals) / 1000;
const maxIntervalSec = Math.max(...timeIntervals) / 1000;

console.log(`  Numero di intervalli: ${timeIntervals.length}`);
console.log(`  Intervallo medio: ${avgIntervalMs.toFixed(0)} ms = ${avgIntervalSec.toFixed(2)} sec`);
console.log(`  Intervallo minimo: ${minIntervalSec.toFixed(2)} sec`);
console.log(`  Intervallo massimo: ${maxIntervalSec.toFixed(2)} sec\n`);

console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// =============================================================================
// 2. Calcola l'integrale di cur_power * dt
// =============================================================================
console.log('┌─ CALCOLO DELL\'INTEGRALE: ∫ P(t) dt ─────────────────────────────────────────────┐');
console.log('│\n');

let energyWh = 0; // Energia in Wh
let energyAccumulated = []; // Accumulo per ogni intervallo

for (let i = 1; i < data.length; i++) {
  const current = data[i];
  const prev = data[i - 1];
  
  // Intervallo di tempo in secondi
  const timeDiffMs = new Date(current.timestamp) - new Date(prev.timestamp);
  const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
  
  // Potenza media tra i due punti (metodo trapezoidale)
  const avgPower = (current.cur_power.value + prev.cur_power.value) / 2;
  
  // Energia in questo intervallo: P * Δt
  // P in Watt, t in ore → risultato in Wh
  // Poi dividi per 1000 per avere kWh
  const energyWhInterval = avgPower * timeDiffHours;
  
  energyWh += energyWhInterval;
  
  energyAccumulated.push({
    index: i,
    timestamp: current.timestamp,
    power: current.cur_power.value,
    avgPower: avgPower.toFixed(1),
    timeDiffSec: (timeDiffMs / 1000).toFixed(2),
    energyInterval: energyWhInterval.toFixed(3),
    cumulativeWh: energyWh.toFixed(3)
  });
}

const energyKwh = energyWh / 1000;

console.log(`  METODO: Integrazione trapezoidale`);
console.log(`  Formula: E = Σ [ (P[i] + P[i-1])/2 ] × Δt[i]\n`);
console.log(`  Risultati:`);
console.log(`  ┌─────────────────────────────────────────────┐`);
console.log(`  │ ENERGIA TOTALE (da integrale): ${energyKwh.toFixed(3)} kWh       │`);
console.log(`  │ ENERGIA TOTALE (da add_ele):   27.000 kWh       │`);
console.log(`  │ DIFFERENZA:                    ${(27.0 - energyKwh).toFixed(3)} kWh         │`);
console.log(`  │ ERRORE RELATIVO:               ${(Math.abs(27.0 - energyKwh) / 27.0 * 100).toFixed(2)}%           │`);
console.log(`  └─────────────────────────────────────────────┘\n`);

console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// =============================================================================
// 3. Mostra campioni dell'integrale
// =============================================================================
console.log('┌─ CAMPIONI DELL\'INTEGRALE CUMULATIVO ─────────────────────────────────────────────┐\n');

console.log('Index  | Timestamp              | P(W)  | Avg P(W) | ΔT(sec) | ΔE(Wh) | Cum(Wh)');
console.log('-------|------------------------|-------|----------|---------|--------|----------');

// Mostra i primi 10, alcuni intermedi e gli ultimi
const sampleIndices = [];
for (let i = 1; i <= 10; i++) sampleIndices.push(i);
for (let i = 50; i < data.length; i += Math.floor(data.length / 20)) sampleIndices.push(i);
sampleIndices.push(energyAccumulated.length);

const uniqueSamples = [...new Set(sampleIndices)].filter(idx => idx > 0 && idx <= energyAccumulated.length).sort((a, b) => a - b);

uniqueSamples.forEach(idx => {
  const sample = energyAccumulated[idx - 1];
  if (sample) {
    console.log(`${String(sample.index).padEnd(6)}| ${sample.timestamp} | ${String(sample.power).padStart(5)} | ${String(sample.avgPower).padStart(8)} | ${String(sample.timeDiffSec).padStart(7)} | ${String(sample.energyInterval).padStart(6)} | ${String(sample.cumulativeWh).padStart(8)}`);
  }
});

console.log('\n└──────────────────────────────────────────────────────────────────────────────────┘\n');

// =============================================================================
// 4. Confronto dettagliato
// =============================================================================
console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                           CONFRONTO METODI                                      ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

console.log('┌─ METODO 1: INTEGRALE DA cur_power ──────────────────────────────────────────────┐');
console.log('│\n');
console.log(`│  Energia = ∫ cur_power(t) dt / 1000`);
console.log(`│  Risultato: ${energyKwh.toFixed(3)} kWh\n`);
console.log(`│  Nota: Usa la media tra campioni consecutivi (trapezoidale)\n`);
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

console.log('┌─ METODO 2: DIFFERENZA add_ele ───────────────────────────────────────────────────┐');
console.log('│\n');
const addEleDiff = data[data.length - 1].add_ele.value - data[0].add_ele.value;
const addEleKwh = addEleDiff / 100;

console.log(`│  Energia = (add_ele_finale - add_ele_iniziale) / 100`);
console.log(`│  Energia = (${data[data.length - 1].add_ele.value} - ${data[0].add_ele.value}) / 100`);
console.log(`│  Energia = ${addEleDiff} / 100`);
console.log(`│  Risultato: ${addEleKwh.toFixed(3)} kWh\n`);
console.log(`│  Nota: Valore dal contatore energetico del dispositivo\n`);
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// =============================================================================
// 5. Analisi dell'errore
// =============================================================================
console.log('┌─ ANALISI DELL\'ERRORE ────────────────────────────────────────────────────────────┐\n');

const error = addEleKwh - energyKwh;
const errorPercent = (error / addEleKwh) * 100;
const errorAbsPercent = Math.abs(error / addEleKwh) * 100;

console.log(`  Metodo 1 (Integrale):  ${energyKwh.toFixed(3)} kWh`);
console.log(`  Metodo 2 (add_ele):    ${addEleKwh.toFixed(3)} kWh`);
console.log(`  Differenza assoluta:   ${Math.abs(error).toFixed(3)} kWh`);
console.log(`  Errore percentuale:    ${errorPercent.toFixed(2)}%\n`);

if (errorAbsPercent < 5) {
  console.log(`  ✅ ACCORDO ECCELLENTE: L'integrale di cur_power riflette bene il consumo reale`);
} else if (errorAbsPercent < 10) {
  console.log(`  ✓ ACCORDO BUONO: Leggera discrepanza (normale, cur_power è stima)`);
} else {
  console.log(`  ⚠️  DISCREPANZA SIGNIFICATIVA: cur_power sottostima il consumo reale`);
}

console.log('\n└──────────────────────────────────────────────────────────────────────────────────┘\n');

// =============================================================================
// 6. Statistiche finali
// =============================================================================
console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                       STATISTICHE FINALI                                        ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

const durationMs = new Date(data[data.length - 1].timestamp) - new Date(data[0].timestamp);
const durationHours = durationMs / (1000 * 60 * 60);
const durationMinutes = durationMs / (1000 * 60);

const powers = data.map(d => d.cur_power.value);
const avgPowerInstantaneous = powers.reduce((a, b) => a + b, 0) / powers.length;
const avgPowerFromIntegral = (energyKwh / durationHours) * 1000;
const avgPowerFromAddEle = (addEleKwh / durationHours) * 1000;

console.log('┌─ DURATA E INTERVALLI ────────────────────────────────────────────────────────────┐\n');
console.log(`  Inizio:        ${data[0].timestamp}`);
console.log(`  Fine:          ${data[data.length - 1].timestamp}`);
console.log(`  Durata:        ${durationMinutes.toFixed(1)} minuti (${durationHours.toFixed(3)} ore)`);
console.log(`  Campioni:      ${data.length}`);
console.log(`  Δt medio:      ${avgIntervalSec.toFixed(2)} secondi\n`);
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

console.log('┌─ POTENZA ────────────────────────────────────────────────────────────────────────┐\n');
console.log(`  Potenza istantanea media:  ${avgPowerInstantaneous.toFixed(1)} W`);
console.log(`  Potenza da integrale:      ${avgPowerFromIntegral.toFixed(1)} W`);
console.log(`  Potenza da add_ele:        ${avgPowerFromAddEle.toFixed(1)} W\n`);
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

console.log('┌─ ENERGIA ────────────────────────────────────────────────────────────────────────┐\n');
console.log(`  Da integrale cur_power:    ${energyKwh.toFixed(3)} kWh`);
console.log(`  Da contatore add_ele:      ${addEleKwh.toFixed(3)} kWh`);
console.log(`  Discrepanza:               ${Math.abs(error).toFixed(3)} kWh (${errorAbsPercent.toFixed(2)}%)\n`);
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

console.log('┌─ COSTO ENERGETICO ───────────────────────────────────────────────────────────────┐\n');
const pricePerKwh = 0.23; // €/kWh medio in Italia
const costFromIntegral = energyKwh * pricePerKwh;
const costFromAddEle = addEleKwh * pricePerKwh;

console.log(`  Da integrale:              €${costFromIntegral.toFixed(2)} (a €${pricePerKwh}/kWh)`);
console.log(`  Da add_ele:                €${costFromAddEle.toFixed(2)} (a €${pricePerKwh}/kWh)`);
console.log(`  Differenza costo:          €${Math.abs(costFromIntegral - costFromAddEle).toFixed(2)}\n`);
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// =============================================================================
// 7. Conclusioni
// =============================================================================
console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                          CONCLUSIONI                                            ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

console.log('INTERPRETAZIONE DELLA DISCREPANZA:\n');

if (errorPercent > 0) {
  console.log(`✓ add_ele SUPERA l'integrale di ${Math.abs(errorPercent).toFixed(2)}%`);
  console.log(`  → add_ele è il contatore REALE del dispositivo`);
  console.log(`  → cur_power SOTTOSTIMA leggermente il consumo\n`);
} else {
  console.log(`✓ L'integrale SUPERA add_ele di ${Math.abs(errorPercent).toFixed(2)}%`);
  console.log(`  → cur_power SOVRASTIMA il consumo`);
  console.log(`  → add_ele è comunque il contatore più affidabile\n`);
}

console.log('RACCOMANDAZIONE:\n');
console.log('  Per calcoli ACCURATI di energia consumata:');
console.log('  - USARE add_ele (contatore del dispositivo)');
console.log('  - NON usare solo l\'integrale di cur_power');
console.log('  - cur_power utile per trend e pattern, non per precisione\n');
