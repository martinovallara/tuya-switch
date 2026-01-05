let instantPowerChart = null;
let cumulativePowerChart = null;
let isSelecting = false;
let selectionStart = null;
let selectionStartPx = null;
let chartData = null; // Salva i dati originali
let zoomState = null;
const DEBUG_ZOOM = true;

const LOCALE = 'it-IT';

function formatNumber(value, decimals) {
  return Number(value).toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

if (window.Chart) {
  Chart.defaults.locale = LOCALE;
}

function getFreshCanvas(canvasId) {
  const existing = document.getElementById(canvasId);
  const replacement = existing.cloneNode(true);
  existing.parentNode.replaceChild(replacement, existing);
  return replacement;
}

function normalizeZoomRange(times) {
  if (!zoomState || times.length < 2) return null;
  const maxIndex = times.length - 1;
  const min = Math.max(0, Math.min(maxIndex, zoomState.min));
  const max = Math.max(0, Math.min(maxIndex, zoomState.max));
  if (max <= min) return null;
  return { min, max };
}

function applyZoomState(times) {
  const range = normalizeZoomRange(times);
  if (!range) {
    if (DEBUG_ZOOM) {
      console.log('[zoom] no range to apply', zoomState);
    }
    zoomState = null;
    return null;
  }

  [instantPowerChart, cumulativePowerChart].forEach((chart) => {
    if (!chart) return;
    chart.options.scales.x.min = range.min;
    chart.options.scales.x.max = range.max;
    if (typeof chart.zoomScale === 'function') {
      chart.zoomScale('x', { min: range.min, max: range.max });
    } else {
      chart.update();
    }
  });

  if (DEBUG_ZOOM) {
    console.log('[zoom] applied', range);
  }

  return range;
}

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
    if (DEBUG_ZOOM) {
      console.log('[zoom] refresh', {
        logs: logs.length,
        zoomState
      });
    }
    renderCharts(chartData);
    const zoomRange = applyZoomState(chartData.times);
    if (zoomRange) {
      updateStatistics(chartData, zoomRange.min, zoomRange.max);
    } else {
      updateStatistics(chartData, 0, chartData.times.length - 1);
    }
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
    const powerValueRaw = powerKey ? parseFloat(log[powerKey].value) || 0 : 0;
    const instantPowerW = powerKey === 'cur_power' ? powerValueRaw / 10 : powerValueRaw;
    const instantPowerKW = instantPowerW / 1000;
    instantPowers.push(instantPowerKW);

    // Calcola energia integrata dalla potenza (approssimazione con rettangoli)
    // Se è il primo valore, usa 0
    if (index > 0) {
      const prevLog = logs[index - 1];
      const prevTime = new Date(prevLog.timestamp);
      const timeInterval = (time - prevTime) / 3600000; // Converti millisecondi in ore
      const prevRaw = powerKey ? parseFloat(logs[index - 1][powerKey]?.value || 0) : 0;
      const prevPowerW = powerKey === 'cur_power' ? prevRaw / 10 : prevRaw;
      const avgPower = (instantPowerKW + (prevPowerW / 1000)) / 2;
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
  if (!instantPowerChart) {
    const instantCanvas = getFreshCanvas('instantPowerChart');
    const instantCtx = instantCanvas.getContext('2d');
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
          },
          tooltip: {
            callbacks: {
              label: (context) => `Potenza: ${formatNumber(context.parsed.y, 3)} kW`
            }
          }
        },
        scales: {
          x: {
            type: 'category'
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Potenza (kW)' },
            ticks: {
              callback: (value) => formatNumber(value, 2)
            }
          }
        }
      }
    });
    addChartSelectionListener(instantCanvas, instantPowerChart);
  } else {
    instantPowerChart.data.labels = times;
    instantPowerChart.data.datasets[0].data = instantPowers;
    instantPowerChart.update();
  }

  // Chart Energia Cumulata (usa integrazione)
  if (!cumulativePowerChart) {
    const cumulativeCanvas = getFreshCanvas('cumulativePowerChart');
    const cumulativeCtx = cumulativeCanvas.getContext('2d');
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
          },
          tooltip: {
            callbacks: {
              label: (context) => `Energia: ${formatNumber(context.parsed.y, 4)} kWh`
            }
          }
        },
        scales: {
          x: {
            type: 'category'
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Energia (kWh)' },
            ticks: {
              callback: (value) => formatNumber(value, 4)
            }
          }
        }
      }
    });
    addChartSelectionListener(cumulativeCanvas, cumulativePowerChart);
  } else {
    cumulativePowerChart.data.labels = times;
    cumulativePowerChart.data.datasets[0].data = cumulativePowerIntegrated;
    cumulativePowerChart.update();
  }
}

function addChartSelectionListener(canvas, chart) {
  const container = canvas.parentElement;
  container.querySelectorAll('.selection-box, .selection-label').forEach((el) => el.remove());
  const selectionBox = document.createElement('div');
  selectionBox.className = 'selection-box';
  const selectionLabel = document.createElement('div');
  selectionLabel.className = 'selection-label';
  container.appendChild(selectionBox);
  container.appendChild(selectionLabel);

  const getTimes = () => (chartData && Array.isArray(chartData.times) ? chartData.times : []);
  const clampIndex = (value) => {
    const times = getTimes();
    if (!times.length) return 0;
    return Math.max(0, Math.min(times.length - 1, value));
  };
  const timeAtX = (x, width) => {
    const times = getTimes();
    if (!times.length) return '-';
    const index = clampIndex(Math.round((x / width) * (times.length - 1)));
    return times[index];
  };

  canvas.addEventListener('mousedown', (e) => {
    const times = getTimes();
    if (!times.length) return;
    isSelecting = true;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const canvasWidth = canvas.offsetWidth;
    selectionStartPx = x;
    selectionStart = x / canvasWidth;
    selectionBox.style.left = `${x}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.display = 'block';
    selectionLabel.textContent = `${timeAtX(x, canvasWidth)} – ${timeAtX(x, canvasWidth)}`;
    selectionLabel.style.left = `${x}px`;
    selectionLabel.style.display = 'block';
  });

  canvas.addEventListener('dblclick', () => {
    resetZoom();
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isSelecting) return;
    canvas.style.cursor = 'col-resize';
    const times = getTimes();
    if (!times.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const left = Math.min(selectionStartPx, x);
    const width = Math.abs(x - selectionStartPx);
    selectionBox.style.left = `${left}px`;
    selectionBox.style.width = `${width}px`;
    const startTime = timeAtX(selectionStartPx, canvas.offsetWidth);
    const endTime = timeAtX(x, canvas.offsetWidth);
    selectionLabel.textContent = `${startTime} – ${endTime}`;
    selectionLabel.style.left = `${left}px`;
  });

  canvas.addEventListener('wheel', (e) => {
    if (isSelecting) return;
    const currentData = chartData;
    const times = currentData?.times || [];
    if (!times.length) return;
    const min = chart.options.scales.x.min;
    const max = chart.options.scales.x.max;
    if (typeof min !== 'number' || typeof max !== 'number') return;

    e.preventDefault();
    const windowSize = max - min;
    if (windowSize <= 0) return;

    const step = Math.max(1, Math.round(windowSize * 0.1));
    const direction = e.deltaY > 0 ? 1 : -1;
    const newMin = clampIndex(min + direction * step);
    const newMax = clampIndex(newMin + windowSize);

    chart.options.scales.x.min = newMin;
    chart.options.scales.x.max = newMax;
    if (typeof chart.zoomScale === 'function') {
      chart.zoomScale('x', { min: newMin, max: newMax });
    } else {
      chart.update();
    }
    zoomState = { min: newMin, max: newMax };
    if (DEBUG_ZOOM) {
      console.log('[zoom] wheel', zoomState);
    }
    updateStatistics(currentData, newMin, newMax);
  }, { passive: false });

  canvas.addEventListener('mouseup', (e) => {
    if (!isSelecting) return;
    isSelecting = false;

    const currentData = chartData;
    const times = currentData?.times || [];
    if (!times.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const canvasWidth = canvas.offsetWidth;
    const selectionEnd = x / canvasWidth;

    selectionBox.style.display = 'none';
    selectionLabel.style.display = 'none';

    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);

    const startIndex = Math.floor(start * times.length);
    const endIndex = Math.ceil(end * times.length);

    if (endIndex - startIndex < 2) {
      canvas.style.cursor = 'default';
      return;
    }

    // Zoom sull'intervallo selezionato
    const minIndex = Math.max(0, startIndex);
    const maxIndex = Math.min(times.length - 1, endIndex - 1);

    chart.options.scales.x.min = minIndex;
    chart.options.scales.x.max = maxIndex;
    if (typeof chart.zoomScale === 'function') {
      chart.zoomScale('x', { min: minIndex, max: maxIndex });
    } else {
      chart.update();
    }
    zoomState = { min: minIndex, max: maxIndex };
    if (DEBUG_ZOOM) {
      console.log('[zoom] selection', zoomState);
    }

    // Aggiorna statistiche per la finestra selezionata
    updateStatistics(currentData, startIndex, endIndex - 1);

    canvas.style.cursor = 'default';
  });

  canvas.addEventListener('mouseleave', () => {
    isSelecting = false;
    selectionBox.style.display = 'none';
    selectionLabel.style.display = 'none';
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
    ? formatNumber(visiblePowers.reduce((a, b) => a + b, 0) / visiblePowers.length, 2)
    : '-';

  const maxPower = visiblePowers.length > 0 
    ? formatNumber(Math.max(...visiblePowers), 2)
    : '-';

  const minPower = visiblePowers.length > 0 
    ? formatNumber(Math.min(...visiblePowers), 2)
    : '-';

  // Consumo = differenza tra valore finale e iniziale dell'intervallo
  const totalConsumption = visibleEnergy.length > 1
    ? formatNumber(visibleEnergy[visibleEnergy.length - 1] - visibleEnergy[0], 4)
    : visibleEnergy.length === 1
    ? formatNumber(visibleEnergy[0], 4)
    : formatNumber(0, 4);

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
  instantPowerChart = null;
  cumulativePowerChart = null;

  document.getElementById('avgPower').textContent = '-';
  document.getElementById('maxPower').textContent = '-';
  document.getElementById('minPower').textContent = '-';
  document.getElementById('totalConsumption').textContent = '-';
  document.getElementById('readingCount').textContent = '-';
}

function resetZoom() {
  zoomState = null;
  if (instantPowerChart) {
    instantPowerChart.options.scales.x.min = undefined;
    instantPowerChart.options.scales.x.max = undefined;
    if (typeof instantPowerChart.resetZoom === 'function') {
      instantPowerChart.resetZoom();
    }
    instantPowerChart.update();
  }
  if (cumulativePowerChart) {
    cumulativePowerChart.options.scales.x.min = undefined;
    cumulativePowerChart.options.scales.x.max = undefined;
    if (typeof cumulativePowerChart.resetZoom === 'function') {
      cumulativePowerChart.resetZoom();
    }
    cumulativePowerChart.update();
  }
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
