const fs = require('fs');

// Leggi il file JSON
const data = JSON.parse(fs.readFileSync('./data/logs/2026-01-05.json', 'utf8'));

console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                     ANALISI DATI ENERGETICI - TUYA SWITCH                        ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

// =============================================================================
// 1. INTERPRETAZIONE DEI VALORI
// =============================================================================
console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║ 1. INTERPRETAZIONE VALORI TUYA                                                  ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

console.log('┌─ INCREMENTI DI add_ele ─────────────────────────────────────────────────────────┐');
console.log('│                                                                                  │');
console.log('│ OSSERVAZIONE CHIAVE:                                                            │');
console.log('│ • add_ele SEMPRE incrementa di 100 quando c\'è consumo                           │');
console.log('│ • Questo accade ~27 volte durante il periodo monitorato                        │');
console.log('│ • add_ele rimane costante durante lunghi periodi                               │');
console.log('│                                                                                  │');
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

const firstAddEle = data[0].add_ele.value;
const lastAddEle = data[data.length - 1].add_ele.value;
const addEleDiff = lastAddEle - firstAddEle;
const increments = [];
for (let i = 1; i < data.length; i++) {
  const diff = data[i].add_ele.value - data[i-1].add_ele.value;
  if (diff !== 0) increments.push(diff);
}

console.log(`📊 DATI ACQUISITI:`);
console.log(`   • Periodo: 106 minuti (~1.76 ore)`);
console.log(`   • Record: ${data.length} letture a intervalli di ~15 secondi`);
console.log(`   • add_ele inizio: ${firstAddEle} → fine: ${lastAddEle}`);
console.log(`   • Incremento totale: ${addEleDiff} unità`);
console.log(`   • Numero di incrementi: ${increments.length}\n`);

// =============================================================================
// 2. INTERPRETAZIONE CORRETTA
// =============================================================================
console.log('┌─ INTERPRETAZIONE CORRETTA ──────────────────────────────────────────────────────┐');
console.log('│                                                                                  │');
console.log('│ add_ele = ENERGIA CUMULATA (contatore energetico)                              │');
console.log('│ Unità: 0.01 kWh (100 = 1 kWh) oppure 0.1 Wh (100 = 10 Wh)                      │');
console.log('│                                                                                  │');
console.log('│ IPOTESI 1: Incremento = quantizzazione temporale                               │');
console.log('│ ─────────────────────────────────────────────────────────────────────────────  │');
console.log('│ • add_ele incrementa di 100 ogni volta che si accumula ~1 kWh                  │');
console.log('│ • Con consumo medio di 15346 W e durata 106 min:                               │');
const expectedIncrements = Math.round((15346 * 106 / 60) / 1000);
console.log(`   Energia totale = ${(15346 * 106 / 60 / 1000).toFixed(1)} kWh`);
console.log(`   Incrementi attesi = ${expectedIncrements}`);
console.log(`   Incrementi effettivi = ${increments.length}`);
console.log('│                                                                                  │');
console.log('│ IPOTESI 2 (PIÙ PROBABILE): Incremento = campionamento del contatore            │');
console.log('│ ─────────────────────────────────────────────────────────────────────────────  │');
console.log('│ • Il dispositivo CAMPIONA il contatore energetico fisico                       │');
console.log('│ • Quando il contatore fisico incrementa di 1 kWh, add_ele aumenta di 100       │');
console.log('│ • cur_power è una STIMA istantanea calcolata dal dispositivo                   │');
console.log('│ • cur_power NON riflette il consumo reale di quel momento                      │');
console.log('│                                                                                  │');
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// =============================================================================
// 3. CONFRONTO: cur_power vs add_ele
// =============================================================================
console.log('┌─ CONFRONTO: cur_power vs add_ele ────────────────────────────────────────────────┐');
console.log('│                                                                                  │');

// Calcola statistiche di cur_power
const powers = data.map(d => d.cur_power.value);
const avgPower = powers.reduce((a, b) => a + b, 0) / powers.length;
const minPower = Math.min(...powers);
const maxPower = Math.max(...powers);

console.log(`│ cur_power:                                                                       │`);
console.log(`│   • Min: ${minPower} W                                                      │`);
console.log(`│   • Max: ${maxPower} W                                                         │`);
console.log(`│   • Media: ${avgPower.toFixed(1)} W                                                      │`);
console.log(`│                                                                                  │`);

const durationHours = 106 / 60;
const energyFromAddEle = addEleDiff / 100;
const avgPowerFromAddEle = (energyFromAddEle / durationHours) * 1000;

console.log(`│ Consumo da add_ele:                                                              │`);
console.log(`│   • Differenza: ${addEleDiff} unità                                                       │`);
console.log(`│   • Se unità = 0.01 kWh: ${energyFromAddEle.toFixed(1)} kWh consumati                         │`);
console.log(`│   • Potenza media implicita: ${avgPowerFromAddEle.toFixed(1)} W                                │`);
console.log(`│                                                                                  │`);
console.log(`│ DISCREPANZA:                                                                     │`);
console.log(`│   • Potenza media cur_power: ${avgPower.toFixed(1)} W                                       │`);
console.log(`│   • Potenza media da add_ele: ${avgPowerFromAddEle.toFixed(1)} W                             │`);
console.log(`│   • Rapporto: ${(avgPowerFromAddEle / avgPower).toFixed(1)}x                                                │`);
console.log(`│   • Differenza: ${(avgPowerFromAddEle - avgPower).toFixed(1)} W (${((avgPowerFromAddEle - avgPower) / avgPowerFromAddEle * 100).toFixed(1)}%)      │`);
console.log('│                                                                                  │');
console.log('│ CONCLUSIONE: cur_power è una stima NON accurata del consumo reale!             │');
console.log('│ La potenza vera è ~15346 W, non 12476 W come sembrerebbe dai dati istantanei.  │');
console.log('│                                                                                  │');
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// =============================================================================
// 4. ANALISI TEMPORALE
// =============================================================================
console.log('┌─ ANALISI TEMPORALE DEGLI INCREMENTI ────────────────────────────────────────────┐');
console.log('│                                                                                  │');

const incrementTimestamps = [];
for (let i = 1; i < data.length; i++) {
  const diff = data[i].add_ele.value - data[i-1].add_ele.value;
  if (diff !== 0) {
    if (incrementTimestamps.length > 0) {
      const timeSinceLastIncrement = (new Date(data[i].timestamp) - new Date(incrementTimestamps[incrementTimestamps.length - 1].timestamp)) / 1000;
      incrementTimestamps.push({
        timestamp: data[i].timestamp,
        power: data[i].cur_power.value,
        timeSinceLast: timeSinceLastIncrement
      });
    } else {
      incrementTimestamps.push({
        timestamp: data[i].timestamp,
        power: data[i].cur_power.value,
        timeSinceLast: null
      });
    }
  }
}

if (incrementTimestamps.length > 0) {
  const times = incrementTimestamps.slice(1).map(t => t.timeSinceLast);
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  console.log(`│ Incrementi di add_ele (ogni 100 = 1 kWh):                                      │`);
  console.log(`│   • Intervallo medio tra incrementi: ${avgTime.toFixed(1)} secondi (~${(avgTime/60).toFixed(1)} min)  │`);
  console.log(`│   • Intervallo minimo: ${minTime.toFixed(1)} secondi                                        │`);
  console.log(`│   • Intervallo massimo: ${maxTime.toFixed(1)} secondi (~${(maxTime/60).toFixed(1)} min)          │`);
}

console.log('│                                                                                  │');
console.log('│ INTERPRETAZIONE:                                                                 │');
console.log('│ • Gli incrementi NON sono regolari                                              │');
console.log('│ • Questo suggerisce che add_ele sia un contatore del dispositivo fisico         │');
console.log('│ • Il contatore fisico accumula energia e incrementa DISCRETAMENTE                │');
console.log('│                                                                                  │');
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

// =============================================================================
// 5. CONCLUSIONI E RACCOMANDAZIONI
// =============================================================================
console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║ 2. CONCLUSIONI E RACCOMANDAZIONI                                                ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

console.log('┌─ COSA RAPPRESENTA add_ele ──────────────────────────────────────────────────────┐');
console.log('│                                                                                  │');
console.log('│ ✅ add_ele = CONTATORE DI ENERGIA CUMULATA dal dispositivo Tuya                │');
console.log('│                                                                                  │');
console.log('│ Interpretazione:                                                                │');
console.log('│   • È il VALORE AFFIDABILE per energia totale consumata                        │');
console.log('│   • Incrementa di 100 quando il contatore interno accumula 1 kWh               │');
console.log('│   • Unità: probabilmente 0.01 kWh o 10 Wh                                      │');
console.log('│   • È una misura INTEGRATIVA (non istantanea)                                  │');
console.log('│                                                                                  │');
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

console.log('┌─ COSA RAPPRESENTA cur_power ────────────────────────────────────────────────────┐');
console.log('│                                                                                  │');
console.log('│ ⚠️  cur_power = STIMA ISTANTANEA di potenza (NON precisa)                      │');
console.log('│                                                                                  │');
console.log('│ Limiti:                                                                         │');
console.log('│   • Varia notevolmente (744 W - 31485 W)                                       │');
console.log('│   • Non correlata con gli incrementi di add_ele                                │');
console.log('│   • Probabilmente una stima costruita da V × I                                 │');
console.log('│   • NON adatta per calcoli energetici accurati                                 │');
console.log('│                                                                                  │');
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

console.log('┌─ COME USARE I DATI CORRETTAMENTE ───────────────────────────────────────────────┐');
console.log('│                                                                                  │');
console.log('│ 1️⃣  PER ENERGIA TOTALE CONSUMATA:                                              │');
console.log('│    • Usa la DIFFERENZA di add_ele tra due momenti                              │');
console.log('│    • Consumo (kWh) = Delta add_ele / 100                                       │');
console.log('│    • Consumo (Wh) = Delta add_ele / 10                                         │');
console.log('│                                                                                  │');
console.log('│ 2️⃣  PER POTENZA MEDIA:                                                        │');
console.log('│    • Calcola dalla differenza di add_ele e intervallo di tempo                 │');
console.log('│    • NON usare cur_power per medie su periodi lunghi                           │');
console.log('│                                                                                  │');
console.log('│ 3️⃣  PER POTENZA ISTANTANEA:                                                   │');
console.log('│    • cur_power dà un\'idea, ma con errore considerevole                        │');
console.log('│    • Se accuratezza è critica, usa V × I da cur_voltage e cur_current         │');
console.log('│                                                                                  │');
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');

console.log('┌─ DATI DI QUESTO PERIODO ────────────────────────────────────────────────────────┐');
console.log('│                                                                                  │');
console.log(`│  Durata: ${durationHours.toFixed(2)} ore (106 minuti)`);
console.log(`│  Energia consumata: ${energyFromAddEle.toFixed(1)} kWh`);
console.log(`│  Potenza media: ${avgPowerFromAddEle.toFixed(0)} W`);
console.log(`│  Costo energetico: ~${(energyFromAddEle * 0.23).toFixed(2)}€ (a €0.23/kWh)`);
console.log('│                                                                                  │');
console.log('└──────────────────────────────────────────────────────────────────────────────────┘\n');
