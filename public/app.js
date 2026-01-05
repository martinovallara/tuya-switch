const form = document.getElementById("energy-form");
const statusEl = document.getElementById("status");
const downloadBtn = document.getElementById("download-csv");
const chartCanvas = document.getElementById("energy-chart");

const DEFAULT_DATE = "2025-12-17";
const dateInput = form.elements.namedItem("date");
dateInput.value = DEFAULT_DATE;

let chartInstance = null;
let latestCsv = "";

function formatStatus(message, tone = "info") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function toLocalDayRange(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day, 23, 59, 59, 999);
  return {
    startTime: start.getTime(),
    endTime: end.getTime()
  };
}

function normalizeTuyaResult(result) {
  if (!result) {
    return [];
  }
  if (Array.isArray(result)) {
    return result;
  }
  if (Array.isArray(result.data)) {
    return result.data;
  }
  if (Array.isArray(result.list)) {
    return result.list;
  }
  return [];
}

function toChartData(points) {
  return points.map((item) => ({
    time: item.time || item.t || item.timestamp,
    value: Number(item.value ?? item.val ?? item.v ?? 0)
  }));
}

function renderChart(points) {
  const labels = points.map((p) => new Date(p.time).toLocaleTimeString());
  const values = points.map((p) => p.value);

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(chartCanvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Consumo (kWh)",
          data: values,
          borderColor: "#f8b400",
          backgroundColor: "rgba(248, 180, 0, 0.2)",
          tension: 0.25,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          title: {
            display: true,
            text: "kWh"
          }
        }
      }
    }
  });
}

function buildCsv(points) {
  const header = "timestamp_iso, value_kwh";
  const rows = points.map((p) => `${new Date(p.time).toISOString()}, ${p.value}`);
  return [header, ...rows].join("\n");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formatStatus("Caricamento dati...", "info");
  downloadBtn.disabled = true;

  const formData = new FormData(form);
  const { startTime, endTime } = toLocalDayRange(formData.get("date"));

  const payload = {
    deviceId: formData.get("deviceId"),
    region: formData.get("region"),
    startTime,
    endTime,
    dpCode: formData.get("dpCode"),
    statType: formData.get("statType"),
    unit: "minute",
    interval: Number(formData.get("interval") || 5)
  };

  try {
    const res = await fetch("/api/energy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Errore API");
    }
    const rawPoints = normalizeTuyaResult(json.data);
    const points = toChartData(rawPoints).filter((p) => Number.isFinite(p.value));
    if (!points.length) {
      formatStatus("Nessun dato disponibile. Verifica device/DP code.", "warn");
      return;
    }
    renderChart(points);
    latestCsv = buildCsv(points);
    downloadBtn.disabled = false;
    formatStatus(`Caricati ${points.length} punti.`, "ok");
  } catch (err) {
    formatStatus(err.message || "Errore inatteso", "error");
  }
});

downloadBtn.addEventListener("click", () => {
  if (!latestCsv) {
    return;
  }
  const blob = new Blob([latestCsv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "consumi_17-12-2025.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});
