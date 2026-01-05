"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./dashboard.module.css";

const LOCALE = "it-IT";
const REFRESH_MS = 15000;
const DEBUG_ZOOM = false;

function formatNumber(value, decimals) {
  return Number(value).toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function processLogs(logs) {
  const times = [];
  const instantPowers = [];
  const cumulativePowerIntegrated = [];

  let cumulativeEnergy = 0;

  logs.forEach((log, index) => {
    const time = new Date(log.timestamp);
    times.push(time.toLocaleTimeString(LOCALE));

    const powerKey = Object.keys(log).find(
      (key) =>
        key.toLowerCase().includes("power") ||
        key.toLowerCase().includes("watts") ||
        key === "cur_power"
    );
    const powerValueRaw = powerKey ? parseFloat(log[powerKey].value) || 0 : 0;
    const instantPowerW = powerKey === "cur_power" ? powerValueRaw / 10 : powerValueRaw;
    const instantPowerKW = instantPowerW / 1000;
    instantPowers.push(instantPowerKW);

    if (index > 0) {
      const prevLog = logs[index - 1];
      const prevTime = new Date(prevLog.timestamp);
      const timeInterval = (time - prevTime) / 3600000;
      const prevRaw = powerKey ? parseFloat(prevLog[powerKey]?.value || 0) : 0;
      const prevPowerW = powerKey === "cur_power" ? prevRaw / 10 : prevRaw;
      const avgPower = (instantPowerKW + prevPowerW / 1000) / 2;
      cumulativeEnergy += avgPower * timeInterval;
    }
    cumulativePowerIntegrated.push(cumulativeEnergy);
  });

  return {
    times,
    instantPowers,
    cumulativePowerIntegrated,
    originalTimes: times.slice()
  };
}

export default function DashboardClient() {
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [status, setStatus] = useState("In attesa...");
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    avgPower: "-",
    maxPower: "-",
    minPower: "-",
    totalConsumption: "-",
    readingCount: "-",
    timeRange: "-"
  });
  const [chartsReady, setChartsReady] = useState(false);

  const chartDataRef = useRef(null);
  const zoomStateRef = useRef(null);
  const chartModuleRef = useRef(null);
  const zoomPluginRef = useRef(null);

  const instantCanvasRef = useRef(null);
  const cumulativeCanvasRef = useRef(null);
  const instantChartRef = useRef(null);
  const cumulativeChartRef = useRef(null);
  const instantSelectionBoxRef = useRef(null);
  const instantSelectionLabelRef = useRef(null);
  const cumulativeSelectionBoxRef = useRef(null);
  const cumulativeSelectionLabelRef = useRef(null);
  const cleanupInstantRef = useRef(null);
  const cleanupCumulativeRef = useRef(null);

  const updateStatistics = useCallback((data, startIndex, endIndex) => {
    if (!data) return;
    const { instantPowers, cumulativePowerIntegrated, originalTimes } = data;

    const visiblePowers = instantPowers.slice(startIndex, endIndex + 1);
    const visibleEnergy = cumulativePowerIntegrated.slice(startIndex, endIndex + 1);
    const visibleTimes = originalTimes.slice(startIndex, endIndex + 1);

    const avgPower =
      visiblePowers.length > 0
        ? formatNumber(
            visiblePowers.reduce((a, b) => a + b, 0) / visiblePowers.length,
            2
          )
        : "-";

    const maxPower =
      visiblePowers.length > 0 ? formatNumber(Math.max(...visiblePowers), 2) : "-";
    const minPower =
      visiblePowers.length > 0 ? formatNumber(Math.min(...visiblePowers), 2) : "-";

    const totalConsumption =
      visibleEnergy.length > 1
        ? formatNumber(visibleEnergy[visibleEnergy.length - 1] - visibleEnergy[0], 4)
        : visibleEnergy.length === 1
        ? formatNumber(visibleEnergy[0], 4)
        : formatNumber(0, 4);

    const timeRange =
      visibleTimes.length > 0
        ? `${visibleTimes[0]} - ${visibleTimes[visibleTimes.length - 1]}`
        : "-";

    setStats({
      avgPower,
      maxPower,
      minPower,
      totalConsumption,
      readingCount: visiblePowers.length,
      timeRange
    });
  }, []);

  const applyZoomState = useCallback((times) => {
    const zoomState = zoomStateRef.current;
    if (!zoomState || !times?.length) {
      if (DEBUG_ZOOM) {
        console.log("[zoom] no range to apply", zoomState);
      }
      zoomStateRef.current = null;
      return null;
    }
    const maxIndex = times.length - 1;
    const min = Math.max(0, Math.min(maxIndex, zoomState.min));
    const max = Math.max(0, Math.min(maxIndex, zoomState.max));
    if (max <= min) {
      zoomStateRef.current = null;
      return null;
    }

    [instantChartRef.current, cumulativeChartRef.current].forEach((chart) => {
      if (!chart) return;
      chart.options.scales.x.min = min;
      chart.options.scales.x.max = max;
      if (typeof chart.zoomScale === "function") {
        chart.zoomScale("x", { min, max });
      } else {
        chart.update();
      }
    });

    if (DEBUG_ZOOM) {
      console.log("[zoom] applied", { min, max });
    }
    return { min, max };
  }, []);

  const resetZoom = useCallback(() => {
    zoomStateRef.current = null;
    [instantChartRef.current, cumulativeChartRef.current].forEach((chart) => {
      if (!chart) return;
      chart.options.scales.x.min = undefined;
      chart.options.scales.x.max = undefined;
      if (typeof chart.resetZoom === "function") {
        chart.resetZoom();
      }
      chart.update();
    });
    if (chartDataRef.current) {
      updateStatistics(
        chartDataRef.current,
        0,
        chartDataRef.current.times.length - 1
      );
    }
  }, [updateStatistics]);

  const attachSelectionHandlers = useCallback(
    (canvas, chart, selectionBox, selectionLabel, cleanupRef) => {
      if (!canvas || !chart || !selectionBox || !selectionLabel || cleanupRef.current) {
        return;
      }

      const selectionState = {
        isSelecting: false,
        selectionStart: 0,
        selectionStartPx: 0
      };

      const getTimes = () => chartDataRef.current?.times || [];
      const clampIndex = (value) => {
        const times = getTimes();
        if (!times.length) return 0;
        return Math.max(0, Math.min(times.length - 1, value));
      };
      const timeAtX = (x, width) => {
        const times = getTimes();
        if (!times.length) return "-";
        const index = clampIndex(Math.round((x / width) * (times.length - 1)));
        return times[index];
      };

      const onMouseDown = (e) => {
        const times = getTimes();
        if (!times.length) return;
        selectionState.isSelecting = true;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const canvasWidth = canvas.offsetWidth;
        selectionState.selectionStartPx = x;
        selectionState.selectionStart = x / canvasWidth;
        selectionBox.style.left = `${x}px`;
        selectionBox.style.width = "0px";
        selectionBox.style.display = "block";
        selectionLabel.textContent = `${timeAtX(x, canvasWidth)} - ${timeAtX(
          x,
          canvasWidth
        )}`;
        selectionLabel.style.left = `${x}px`;
        selectionLabel.style.display = "block";
      };

      const onDblClick = () => {
        resetZoom();
      };

      const onMouseMove = (e) => {
        if (!selectionState.isSelecting) return;
        const times = getTimes();
        if (!times.length) return;
        canvas.style.cursor = "col-resize";
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const left = Math.min(selectionState.selectionStartPx, x);
        const width = Math.abs(x - selectionState.selectionStartPx);
        selectionBox.style.left = `${left}px`;
        selectionBox.style.width = `${width}px`;
        const startTime = timeAtX(selectionState.selectionStartPx, canvas.offsetWidth);
        const endTime = timeAtX(x, canvas.offsetWidth);
        selectionLabel.textContent = `${startTime} - ${endTime}`;
        selectionLabel.style.left = `${left}px`;
      };

      const onWheel = (e) => {
        if (selectionState.isSelecting) return;
        const currentData = chartDataRef.current;
        const times = currentData?.times || [];
        if (!times.length) return;
        const min = chart.options.scales.x.min;
        const max = chart.options.scales.x.max;
        if (typeof min !== "number" || typeof max !== "number") return;

        e.preventDefault();
        const windowSize = max - min;
        if (windowSize <= 0) return;

        const step = Math.max(1, Math.round(windowSize * 0.1));
        const direction = e.deltaY > 0 ? 1 : -1;
        const newMin = clampIndex(min + direction * step);
        const newMax = clampIndex(newMin + windowSize);

        chart.options.scales.x.min = newMin;
        chart.options.scales.x.max = newMax;
        if (typeof chart.zoomScale === "function") {
          chart.zoomScale("x", { min: newMin, max: newMax });
        } else {
          chart.update();
        }
        zoomStateRef.current = { min: newMin, max: newMax };
        if (DEBUG_ZOOM) {
          console.log("[zoom] wheel", zoomStateRef.current);
        }
        updateStatistics(currentData, newMin, newMax);
      };

      const onMouseUp = (e) => {
        if (!selectionState.isSelecting) return;
        selectionState.isSelecting = false;
        const currentData = chartDataRef.current;
        const times = currentData?.times || [];
        if (!times.length) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const canvasWidth = canvas.offsetWidth;
        const selectionEnd = x / canvasWidth;

        selectionBox.style.display = "none";
        selectionLabel.style.display = "none";

        const start = Math.min(selectionState.selectionStart, selectionEnd);
        const end = Math.max(selectionState.selectionStart, selectionEnd);

        const startIndex = Math.floor(start * times.length);
        const endIndex = Math.ceil(end * times.length);
        if (endIndex - startIndex < 2) {
          canvas.style.cursor = "default";
          return;
        }

        const minIndex = Math.max(0, startIndex);
        const maxIndex = Math.min(times.length - 1, endIndex - 1);

        chart.options.scales.x.min = minIndex;
        chart.options.scales.x.max = maxIndex;
        if (typeof chart.zoomScale === "function") {
          chart.zoomScale("x", { min: minIndex, max: maxIndex });
        } else {
          chart.update();
        }
        zoomStateRef.current = { min: minIndex, max: maxIndex };
        if (DEBUG_ZOOM) {
          console.log("[zoom] selection", zoomStateRef.current);
        }

        updateStatistics(currentData, startIndex, endIndex - 1);
        canvas.style.cursor = "default";
      };

      const onMouseLeave = () => {
        selectionState.isSelecting = false;
        selectionBox.style.display = "none";
        selectionLabel.style.display = "none";
        canvas.style.cursor = "default";
      };

      canvas.addEventListener("mousedown", onMouseDown);
      canvas.addEventListener("dblclick", onDblClick);
      canvas.addEventListener("mousemove", onMouseMove);
      canvas.addEventListener("mouseup", onMouseUp);
      canvas.addEventListener("mouseleave", onMouseLeave);
      canvas.addEventListener("wheel", onWheel, { passive: false });

      cleanupRef.current = () => {
        canvas.removeEventListener("mousedown", onMouseDown);
        canvas.removeEventListener("dblclick", onDblClick);
        canvas.removeEventListener("mousemove", onMouseMove);
        canvas.removeEventListener("mouseup", onMouseUp);
        canvas.removeEventListener("mouseleave", onMouseLeave);
        canvas.removeEventListener("wheel", onWheel);
      };
    },
    [resetZoom, updateStatistics]
  );

  const renderOrUpdateCharts = useCallback(
    (data) => {
      if (!data) return;
      const { times, instantPowers, cumulativePowerIntegrated } = data;

      const Chart = chartModuleRef.current;
      if (!Chart) return;
      Chart.defaults.locale = LOCALE;

      if (!instantChartRef.current && instantCanvasRef.current) {
        const ctx = instantCanvasRef.current.getContext("2d");
        instantChartRef.current = new Chart(ctx, {
          type: "line",
          data: {
            labels: times,
            datasets: [
              {
                label: "Potenza (kW)",
                data: instantPowers,
                borderColor: "#667eea",
                backgroundColor: "rgba(102, 126, 234, 0.05)",
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointBackgroundColor: "#667eea"
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: true },
              zoom: {
                zoom: {
                  wheel: { enabled: true, speed: 0.1, modifierKey: "ctrl" },
                  pinch: { enabled: true },
                  mode: "x"
                },
                pan: {
                  enabled: true,
                  mode: "x",
                  modifierKey: "shift"
                }
              },
              tooltip: {
                callbacks: {
                  label: (context) =>
                    `Potenza: ${formatNumber(context.parsed.y, 3)} kW`
                }
              }
            },
            scales: {
              x: { type: "category" },
              y: {
                beginAtZero: true,
                title: { display: true, text: "Potenza (kW)" },
                ticks: {
                  callback: (value) => formatNumber(value, 2)
                }
              }
            }
          }
        });

        attachSelectionHandlers(
          instantCanvasRef.current,
          instantChartRef.current,
          instantSelectionBoxRef.current,
          instantSelectionLabelRef.current,
          cleanupInstantRef
        );
      } else if (instantChartRef.current) {
        instantChartRef.current.data.labels = times;
        instantChartRef.current.data.datasets[0].data = instantPowers;
        instantChartRef.current.update();
      }

      if (!cumulativeChartRef.current && cumulativeCanvasRef.current) {
        const ctx = cumulativeCanvasRef.current.getContext("2d");
        cumulativeChartRef.current = new Chart(ctx, {
          type: "line",
          data: {
            labels: times,
            datasets: [
              {
                label: "Energia (kWh) - Integrata da Potenza",
                data: cumulativePowerIntegrated,
                borderColor: "#764ba2",
                backgroundColor: "rgba(118, 75, 162, 0.05)",
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointBackgroundColor: "#764ba2"
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: true },
              zoom: {
                zoom: {
                  wheel: { enabled: true, speed: 0.1, modifierKey: "ctrl" },
                  pinch: { enabled: true },
                  mode: "x"
                },
                pan: {
                  enabled: true,
                  mode: "x",
                  modifierKey: "shift"
                }
              },
              tooltip: {
                callbacks: {
                  label: (context) =>
                    `Energia: ${formatNumber(context.parsed.y, 4)} kWh`
                }
              }
            },
            scales: {
              x: { type: "category" },
              y: {
                beginAtZero: true,
                title: { display: true, text: "Energia (kWh)" },
                ticks: {
                  callback: (value) => formatNumber(value, 4)
                }
              }
            }
          }
        });

        attachSelectionHandlers(
          cumulativeCanvasRef.current,
          cumulativeChartRef.current,
          cumulativeSelectionBoxRef.current,
          cumulativeSelectionLabelRef.current,
          cleanupCumulativeRef
        );
      } else if (cumulativeChartRef.current) {
        cumulativeChartRef.current.data.labels = times;
        cumulativeChartRef.current.data.datasets[0].data = cumulativePowerIntegrated;
        cumulativeChartRef.current.update();
      }
    },
    [attachSelectionHandlers]
  );

  const loadData = useCallback(
    async (dateOverride) => {
      if (!chartModuleRef.current) {
        return;
      }
      const date = dateOverride || selectedDate;
      setStatus("Caricamento...");
      setError("");

      try {
        const response = await fetch(`/api/logs/${date}`);
        if (!response.ok) throw new Error("Errore nel caricamento dei dati");
        const logs = await response.json();

        if (!logs.length) {
          setStatus("Nessun dato");
          setStats({
            avgPower: "-",
            maxPower: "-",
            minPower: "-",
            totalConsumption: "-",
            readingCount: "-",
            timeRange: "-"
          });
          zoomStateRef.current = null;
          if (instantChartRef.current) {
            instantChartRef.current.data.labels = [];
            instantChartRef.current.data.datasets[0].data = [];
            instantChartRef.current.update();
          }
          if (cumulativeChartRef.current) {
            cumulativeChartRef.current.data.labels = [];
            cumulativeChartRef.current.data.datasets[0].data = [];
            cumulativeChartRef.current.update();
          }
          return;
        }

        const processed = processLogs(logs);
        chartDataRef.current = processed;

        if (DEBUG_ZOOM) {
          console.log("[zoom] refresh", { logs: logs.length, zoomState: zoomStateRef.current });
        }

        renderOrUpdateCharts(processed);

        const zoomRange = applyZoomState(processed.times);
        if (zoomRange) {
          updateStatistics(processed, zoomRange.min, zoomRange.max);
        } else {
          updateStatistics(processed, 0, processed.times.length - 1);
        }

        setStatus(`${logs.length} letture caricate`);
      } catch (err) {
        setError(`Errore: ${err.message || "Errore inatteso"}`);
        setStatus("Errore");
      }
    },
    [applyZoomState, renderOrUpdateCharts, selectedDate, updateStatistics]
  );

  useEffect(() => {
    let cancelled = false;
    async function setupCharts() {
      const [{ default: Chart }, { default: zoomPlugin }] = await Promise.all([
        import("chart.js/auto"),
        import("chartjs-plugin-zoom")
      ]);

      if (cancelled) return;
      chartModuleRef.current = Chart;
      zoomPluginRef.current = zoomPlugin;
      Chart.register(zoomPlugin);
      setChartsReady(true);
    }

    setupCharts();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!chartsReady) return;
    loadData(selectedDate);
  }, [chartsReady, loadData, selectedDate]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!chartModuleRef.current) {
        return;
      }
      const today = new Date().toISOString().split("T")[0];
      if (selectedDate === today) {
        loadData(selectedDate);
      }
    }, REFRESH_MS);

    return () => clearInterval(interval);
  }, [loadData, selectedDate]);

  useEffect(() => {
    return () => {
      if (cleanupInstantRef.current) cleanupInstantRef.current();
      if (cleanupCumulativeRef.current) cleanupCumulativeRef.current();
      if (instantChartRef.current) instantChartRef.current.destroy();
      if (cumulativeChartRef.current) cumulativeChartRef.current.destroy();
    };
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Tuya Energy Dashboard</h1>
          <div className={styles.controls}>
            <div className={styles.controlGroup}>
              <label className={styles.label} htmlFor="dateInput">
                Data:
              </label>
              <input
                id="dateInput"
                className={styles.dateInput}
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <button className={styles.button} type="button" onClick={resetZoom}>
              Reset Zoom
            </button>
            <span
              className={`${styles.status} ${error ? styles.statusError : ""}`}
            >
              {status}
            </span>
          </div>
        </header>

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.chartsGrid}>
          <section className={styles.chartCard}>
            <h2 className={styles.chartTitle}>Potenza Istantanea</h2>
            <div className={styles.chartContainer}>
              <canvas ref={instantCanvasRef} />
              <div className={styles.selectionBox} ref={instantSelectionBoxRef} />
              <div className={styles.selectionLabel} ref={instantSelectionLabelRef} />
            </div>
          </section>

          <section className={styles.chartCard}>
            <h2 className={styles.chartTitle}>Potenza Cumulata</h2>
            <div className={styles.chartContainer}>
              <canvas ref={cumulativeCanvasRef} />
              <div className={styles.selectionBox} ref={cumulativeSelectionBoxRef} />
              <div
                className={styles.selectionLabel}
                ref={cumulativeSelectionLabelRef}
              />
            </div>
          </section>
        </div>

        <section className={styles.infoPanel}>
          <h2 className={styles.infoHeader}>Statistiche</h2>
          <div className={styles.infoRange}>Intervallo: {stats.timeRange}</div>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Potenza Media</div>
              <div className={styles.infoValue}>
                {stats.avgPower}
                <span className={styles.infoUnit}>kW</span>
              </div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Potenza Max</div>
              <div className={styles.infoValue}>
                {stats.maxPower}
                <span className={styles.infoUnit}>kW</span>
              </div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Potenza Min</div>
              <div className={styles.infoValue}>
                {stats.minPower}
                <span className={styles.infoUnit}>kW</span>
              </div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Consumo Intervallo</div>
              <div className={styles.infoValue}>
                {stats.totalConsumption}
                <span className={styles.infoUnit}>kWh</span>
              </div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Letture</div>
              <div className={styles.infoValue}>{stats.readingCount}</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
