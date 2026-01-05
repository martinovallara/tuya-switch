let instantPowerChart = null;
let cumulativePowerChart = null;
let isSelecting = false;
let selectionStart = null;
let chartData = null; // Salva i dati originali

// Inizializza con la data di oggi
document.getElementById('dateInput').valueAsDate = new Date();
document.getElementById('dateInput').addEventListener('change', loadData);
document.getElementById('resetZoomBtn').addEventListener('click', resetZoom);

// Auto-refresh dei dati ogni 15 secondi se è la data di oggi
setInterval(() => {
  const selectedDate = document.getElementById('dateInput').value;
  const today = new Date().toISOString().split('T')[0];
  if (selectedDate === today) {
    loadData();
  }
}, 15000);

async function loadData() {
  try {
    const selectedDate = document.getElementById('dateInput').value;
    updateStatus('Caricamento...');

    const response = await fetch(`/api/logs/${selectedDate}`);
    if (!response.ok) throw new Error('Errore nel caricamento dei dati');

    const logs = await response.json();

    if (logs.length === 0) {
      updateStatus('Nessun dato');
      clearCharts();
      return;
    }

    // Elabora i dati
    chartData = processLogs(logs);
    renderCharts(chartData);
    updateStatistics(chartData, 0, chartData.times.length - 1);
    updateStatus(`${logs.length} letture caricate`);
    clearError();
  } catch (error) {
    showError(`Errore: ${error.message}`);
    updateStatus('Errore');
    console.error(error);
  }
}

function processLogs(logs) {
  const times = [];
  const instantPowers = [];
  const cumulativePowerIntegrated = []; // Da integrazione
  const cumulativePowerDevice = [];      // Da add_ele
  const addEleRaw = [];                  // Valori grezzi di add_ele

  let cumulativeEnergy = 0;

  logs.forEach((log, index) => {
    const time = new Date(log.timestamp);
    times.push(time.toLocaleTimeString('it-IT'));

    // Estrai potenza istantanea
    const powerKey = Object.keys(log).find(k => 
      k.toLowerCase().includes('power') || k.toLowerCase().includes('watts') || k === 'cur_power'
    );
    const instantPowerW = powerKey ? parseFloat(log[powerKey].value) || 0 : 0;
    const instantPowerKW = instantPowerW / 1000;
    instantPowers.push(instantPowerKW);

    // Calcola energia integrata dalla potenza (approssimazione con rettangoli)
    // Se è il primo valore, usa 0
    if (index > 0) {
      const prevLog = logs[index - 1];
      const prevTime = new Date(prevLog.timestamp);
      const timeInterval = (time - prevTime) / 3600000; // Converti millisecondi in ore
      const avgPower = (instantPowerKW + (parseFloat(logs[index - 1][powerKey]?.value || 0) / 1000)) / 2;
      cumulativeEnergy += avgPower * timeInterval;
    }
    cumulativePowerIntegrated.push(cumulativeEnergy);

    // Estrai add_ele grezzo
    const addEleValue = parseFloat(log.add_ele?.value) || 0;
    addEleRaw.push(addEleValue);
    
    // Calcola dispositivo relativo (differenza dal primo)
    const firstValue = parseFloat(logs[0].add_ele?.value) || 0;
    const deviceRelative = addEleValue - firstValue;
    cumulativePowerDevice.push(deviceRelative);
  });

  // Calcola il rapporto medio tra device e integrated
  const lastIntegrated = cumulativePowerIntegrated[cumulativePowerIntegrated.length - 1];
  const lastDeviceRaw = addEleRaw[addEleRaw.length - 1] - addEleRaw[0];
  const conversionFactor = lastIntegrated > 0 ? lastDeviceRaw / lastIntegrated : 1;

  console.log(`📊 Analisi Energia:`);
  console.log(`  • Energia integrata dalla potenza: ${lastIntegrated.toFixed(6)} kWh`);
  console.log(`  • Differenza add_ele grezzo: ${lastDeviceRaw}`);
  console.log(`  • Fattore di conversione: ${conversionFactor.toFixed(4)}`);
  console.log(`  • Stima unità add_ele: 1 unità = ${(1 / conversionFactor).toFixed(6)} kWh`);

  return {
    times,
    instantPowers,
    cumulativePowerIntegrated,
    cumulativePowerDevice,
    addEleRaw,
    conversionFactor,
    originalTimes: times.slice()
  };
}

function renderCharts(data) {
  const { times, instantPowers, cumulativePowerIntegrated } = data;

  // Chart Potenza Istantanea
  if (instantPowerChart) {
    instantPowerChart.destroy();
  }

  const instantCtx = document.getElementById('instantPowerChart').getContext('2d');
  instantPowerChart = new Chart(instantCtx, {
    type: 'line',
    data: {
      labels: times,
      datasets: [{
        label: 'Potenza (kW)',
        data: instantPowers,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.05)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointBackgroundColor: '#667eea'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        zoom: {
          zoom: {
            wheel: { enabled: true, speed: 0.1, modifierKey: 'ctrl' },
            pinch: { enabled: true },
            mode: 'x'
          },
          pan: {
            enabled: true,
            mode: 'x',
            modifierKey: 'shift'
          }
        }
      },
      scales: {
        x: {
          type: 'category'
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Potenza (kW)' }
        }
      }
    }
  });

  // Chart Energia Cumulata (usa integrazione)
  if (cumulativePowerChart) {
    cumulativePowerChart.destroy();
  }

  const cumulativeCtx = document.getElementById('cumulativePowerChart').getContext('2d');
  cumulativePowerChart = new Chart(cumulativeCtx, {
    type: 'line',
    data: {
      labels: times,
      datasets: [{
        label: 'Energia (kWh) - Integrata da Potenza',
        data: cumulativePowerIntegrated,
        borderColor: '#764ba2',
        backgroundColor: 'rgba(118, 75, 162, 0.05)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointBackgroundColor: '#764ba2'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        zoom: {
          zoom: {
            wheel: { enabled: true, speed: 0.1, modifierKey: 'ctrl' },
            pinch: { enabled: true },
            mode: 'x'
          },
          pan: {
            enabled: true,
            mode: 'x',
            modifierKey: 'shift'
          }
        }
      },
      scales: {
        x: {
          type: 'category'
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Energia (kWh)' }
        }
      }
    }
  });

  // Aggiungi event listener per selezione intervallo temporale
  addChartSelectionListener(document.getElementById('instantPowerChart'), instantPowerChart, times, data);
  addChartSelectionListener(document.getElementById('cumulativePowerChart'), cumulativePowerChart, times, data);
}

function addChartSelectionListener(canvas, chart, times, data) {
  canvas.addEventListener('mousedown', (e) => {
    isSelecting = true;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const canvasWidth = canvas.offsetWidth;
    selectionStart = x / canvasWidth;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isSelecting) return;
    canvas.style.cursor = 'col-resize';
  });

  canvas.addEventListener('mouseup', (e) => {
    if (!isSelecting) return;
    isSelecting = false;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const canvasWidth = canvas.offsetWidth;
    const selectionEnd = x / canvasWidth;

    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);

    const startIndex = Math.floor(start * times.length);
    const endIndex = Math.ceil(end * times.length);

    if (endIndex - startIndex < 2) {
      canvas.style.cursor = 'default';
      return;
    }

    // Zoom sull'intervallo selezionato
    const xScale = chart.scales.x;
    xScale.min = startIndex;
    xScale.max = endIndex - 1;
    chart.update();

    // Aggiorna statistiche per la finestra selezionata
    updateStatistics(data, startIndex, endIndex - 1);

    canvas.style.cursor = 'default';
  });

  canvas.addEventListener('mouseleave', () => {
    isSelecting = false;
    canvas.style.cursor = 'default';
  });
}

function updateStatistics(data, startIndex, endIndex) {
  const { instantPowers, cumulativePowerIntegrated, originalTimes } = data;

  // Estrai solo i dati della finestra visibile
  const visiblePowers = instantPowers.slice(startIndex, endIndex + 1);
  const visibleEnergy = cumulativePowerIntegrated.slice(startIndex, endIndex + 1);
  const visibleTimes = originalTimes.slice(startIndex, endIndex + 1);

  const avgPower = visiblePowers.length > 0 
    ? (visiblePowers.reduce((a, b) => a + b, 0) / visiblePowers.length).toFixed(2)
    : '-';

  const maxPower = visiblePowers.length > 0 
    ? Math.max(...visiblePowers).toFixed(2)
    : '-';

  const minPower = visiblePowers.length > 0 
    ? Math.min(...visiblePowers).toFixed(2)
    : '-';

  // Consumo = differenza tra valore finale e iniziale dell'intervallo
  const totalConsumption = visibleEnergy.length > 1
    ? (visibleEnergy[visibleEnergy.length - 1] - visibleEnergy[0]).toFixed(4)
    : visibleEnergy.length === 1
    ? visibleEnergy[0].toFixed(4)
    : '0.0000';

  // Mostra intervallo temporale
  const timeRange = visibleTimes.length > 0
    ? `${visibleTimes[0]} → ${visibleTimes[visibleTimes.length - 1]}`
    : '-';

  document.getElementById('avgPower').textContent = avgPower;
  document.getElementById('maxPower').textContent = maxPower;
  document.getElementById('minPower').textContent = minPower;
  document.getElementById('totalConsumption').textContent = totalConsumption;
  document.getElementById('readingCount').textContent = visiblePowers.length;
  document.getElementById('timeRange').textContent = timeRange;
}

function clearCharts() {
  if (instantPowerChart) instantPowerChart.destroy();
  if (cumulativePowerChart) cumulativePowerChart.destroy();

  document.getElementById('avgPower').textContent = '-';
  document.getElementById('maxPower').textContent = '-';
  document.getElementById('minPower').textContent = '-';
  document.getElementById('totalConsumption').textContent = '-';
  document.getElementById('readingCount').textContent = '-';
}

function resetZoom() {
  if (instantPowerChart) instantPowerChart.resetZoom();
  if (cumulativePowerChart) cumulativePowerChart.resetZoom();
}

function updateStatus(message) {
  document.getElementById('status').textContent = message;
}

function showError(message) {
  const errorEl = document.getElementById('error');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function clearError() {
  document.getElementById('error').style.display = 'none';
}

// Carica i dati iniziali
loadData();
