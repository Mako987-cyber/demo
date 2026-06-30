const state = {
  rates: {},
  previousRates: {},
  history: {},
  baseCurrency: 'USD',
  currencies: ['EUR', 'USD', 'GBP', 'JPY'],
  activePair: 'EUR/USD',
  chartType: 'line',
  timeframeDays: 7
};

async function fetchLatestRates() {
  return window.CurrencyApi.fetchLatestRates(state.baseCurrency);
}

async function fetchPreviousDayRates() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  let day = yesterday;
  if (yesterday.getDay() === 0) day.setDate(day.getDate() - 2);
  if (yesterday.getDay() === 6) day.setDate(day.getDate() - 1);
  const dateStr = day.toISOString().split('T')[0];
  return window.CurrencyApi.fetchRatesByDate(state.baseCurrency, dateStr);
}

async function fetchHistory(from, to, days) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];
  return window.CurrencyApi.fetchHistory(from, to, start, end);
}

function updateRateCards(latest, previous) {
  state.currencies.forEach(currency => {
    const rateEl = document.getElementById(`rate-${currency.toLowerCase()}`);
    const changeEl = document.getElementById(`change-${currency.toLowerCase()}`);

    if (currency === state.baseCurrency) {
      rateEl.textContent = '1.0000';
      changeEl.textContent = 'Base';
      changeEl.className = 'rate-change neutral';
      return;
    }

    const currentRate = latest.rates[currency];
    const prevRate = previous.rates ? previous.rates[currency] : currentRate;

    if (currentRate) {
      rateEl.textContent = currency === 'JPY'
        ? currentRate.toFixed(2)
        : currentRate.toFixed(4);

      const change = ((currentRate - prevRate) / prevRate) * 100;
      const sign = change >= 0 ? '+' : '';
      changeEl.textContent = `${sign}${change.toFixed(2)}%`;

      if (change > 0) {
        changeEl.className = 'rate-change positive';
      } else if (change < 0) {
        changeEl.className = 'rate-change negative';
      } else {
        changeEl.className = 'rate-change neutral';
      }
    }
  });
}

function getChartPalette(ctx, isDark, top, bottom) {
  const lineColor = isDark ? '#63aab3' : '#0a6b74';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';
  const upColor = isDark ? '#34d399' : '#10b981';
  const downColor = isDark ? '#f87171' : '#ef4444';
  const gradient = ctx.createLinearGradient(0, top, 0, bottom);
  gradient.addColorStop(0, isDark ? 'rgba(99,170,179,0.2)' : 'rgba(10,107,116,0.1)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  return { lineColor, gridColor, textColor, upColor, downColor, gradient };
}

function drawGrid(ctx, width, height, padding, gridColor) {
  const chartHeight = height - padding.top - padding.bottom;
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }
}

function getCurrencyClosePoints(historyData, to) {
  const dates = Object.keys(historyData.rates).sort();
  return dates
    .map(date => ({ date, close: historyData.rates[date][to] }))
    .filter(point => typeof point.close === 'number');
}

function getCurrencyCandles(points) {
  if (!points.length) return [];

  const dailyCandles = points.map((point, i) => {
    const prevClose = i > 0 ? points[i - 1].close : point.close;
    const open = prevClose;
    const close = point.close;
    return {
      ts: new Date(point.date).getTime(),
      open,
      close,
      high: Math.max(open, close),
      low: Math.min(open, close)
    };
  });

  const bucketSize = Math.max(1, Math.floor(dailyCandles.length / 60));
  const candles = [];

  for (let i = 0; i < dailyCandles.length; i += bucketSize) {
    const bucket = dailyCandles.slice(i, i + bucketSize);
    if (!bucket.length) continue;

    candles.push({
      ts: bucket[bucket.length - 1].ts,
      open: bucket[0].open,
      close: bucket[bucket.length - 1].close,
      high: Math.max(...bucket.map(c => c.high)),
      low: Math.min(...bucket.map(c => c.low))
    });
  }

  return candles;
}

function drawChart(historyData, to) {
  const canvas = document.getElementById('chart-canvas');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = canvas.offsetHeight * dpr;
  ctx.scale(dpr, dpr);

  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;

  ctx.clearRect(0, 0, width, height);

  const points = getCurrencyClosePoints(historyData, to);
  if (points.length < 2) return;

  const step = Math.max(1, Math.floor(points.length / 90));
  const sampled = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  const candles = getCurrencyCandles(points);
  const isCandle = state.chartType === 'candle' && candles.length > 1;

  const values = isCandle
    ? candles.flatMap(c => [c.low, c.high])
    : sampled.map(p => p.close);
  const timestamps = isCandle
    ? candles.map(c => c.ts)
    : sampled.map(p => new Date(p.date).getTime());

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = { top: 20, bottom: 30, left: 10, right: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const count = isCandle ? candles.length : sampled.length;

  if (count < 2) return;

  const getX = (i) => padding.left + (i / (count - 1)) * chartWidth;
  const getY = (v) => padding.top + chartHeight - ((v - min) / range) * chartHeight;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const palette = getChartPalette(ctx, isDark, padding.top, height - padding.bottom);

  drawGrid(ctx, width, height, padding, palette.gridColor);

  if (isCandle) {
    const bodyWidth = Math.max(3, Math.min(14, chartWidth / candles.length * 0.55));

    candles.forEach((candle, i) => {
      const x = getX(i);
      const openY = getY(candle.open);
      const closeY = getY(candle.close);
      const highY = getY(candle.high);
      const lowY = getY(candle.low);
      const isUp = candle.close >= candle.open;
      const color = isUp ? palette.upColor : palette.downColor;

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      const top = Math.min(openY, closeY);
      const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x - bodyWidth / 2, top, bodyWidth, bodyHeight);
      ctx.globalAlpha = 1;
    });
  } else {
    const lineValues = sampled.map(p => p.close);

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(lineValues[0]));
    lineValues.forEach((v, i) => {
      if (i > 0) ctx.lineTo(getX(i), getY(v));
    });
    ctx.lineTo(getX(lineValues.length - 1), height - padding.bottom);
    ctx.lineTo(getX(0), height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = palette.gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(lineValues[0]));
    lineValues.forEach((v, i) => {
      if (i > 0) ctx.lineTo(getX(i), getY(v));
    });
    ctx.strokeStyle = palette.lineColor;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    lineValues.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(getX(i), getY(v), 2.5, 0, Math.PI * 2);
      ctx.fillStyle = palette.lineColor;
      ctx.fill();
    });
  }

  ctx.fillStyle = palette.textColor;
  ctx.font = '11px General Sans, sans-serif';
  ctx.textAlign = 'center';
  const labelStep = Math.max(1, Math.floor(timestamps.length / 6));
  timestamps.forEach((ts, i) => {
    if (i % labelStep === 0 || i === timestamps.length - 1) {
      const date = new Date(ts);
      const label = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
      ctx.fillText(label, getX(i), height - 8);
    }
  });
}

function updateHistoryTable(historyData, to) {
  const tbody = document.getElementById('history-body');
  const points = getCurrencyClosePoints(historyData, to).reverse();

  tbody.innerHTML = points.map((point, i) => {
    const rate = point.close;
    const prev = points[i + 1];
    let changeHtml = '-';

    if (prev) {
      const change = ((rate - prev.close) / prev.close) * 100;
      const sign = change >= 0 ? '+' : '';
      const cssClass = change > 0 ? 'change-positive' : change < 0 ? 'change-negative' : '';
      changeHtml = `<span class="${cssClass}">${sign}${change.toFixed(3)}%</span>`;
    }

    const formatted = to === 'JPY' ? rate.toFixed(2) : rate.toFixed(4);
    const dateFormatted = new Date(point.date).toLocaleDateString('it-IT', {
      day: '2-digit', month: 'short'
    });

    return `<tr><td>${dateFormatted}</td><td>${formatted}</td><td>${changeHtml}</td></tr>`;
  }).join('');
}

async function loadHistory(pair) {
  const [from, to] = pair.split('/');
  const cacheKey = `${pair}-${state.timeframeDays}`;

  if (!state.history[cacheKey]) {
    state.history[cacheKey] = await fetchHistory(from, to, state.timeframeDays);
  }

  const historyData = state.history[cacheKey];
  drawChart(historyData, to);
  updateHistoryTable(historyData, to);
}

function setupChartControls() {
  const timeframeEl = document.getElementById('history-timeframe');
  timeframeEl.value = String(state.timeframeDays);

  timeframeEl.addEventListener('change', () => {
    state.timeframeDays = parseInt(timeframeEl.value, 10);
    loadHistory(state.activePair);
  });

  document.querySelectorAll('.chart-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chart-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.chartType = btn.dataset.chartType;
      loadHistory(state.activePair);
    });
  });
}

function setupTabs() {
  document.querySelectorAll('.history-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.history-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activePair = tab.dataset.pair;
      loadHistory(state.activePair);
    });
  });
}

function setupConverter() {
  const amountEl = document.getElementById('amount-from');
  const fromEl = document.getElementById('currency-from');
  const toEl = document.getElementById('currency-to');
  const swapBtn = document.getElementById('swap-btn');
  const resultEl = document.getElementById('converter-result');

  async function convert() {
    const amount = parseFloat(amountEl.value) || 0;
    const from = fromEl.value;
    const to = toEl.value;

    if (from === to) {
      resultEl.querySelector('.result-value').textContent =
        `${amount.toFixed(2)} ${to}`;
      return;
    }

    const data = await window.CurrencyApi.convert(amount, from, to);
    const result = data.rates[to];

    const formatted = to === 'JPY'
      ? result.toFixed(0)
      : result.toFixed(2);

    resultEl.querySelector('.result-value').textContent =
      `${amount} ${from} = ${formatted} ${to}`;
  }

  amountEl.addEventListener('input', convert);
  fromEl.addEventListener('change', convert);
  toEl.addEventListener('change', convert);
  swapBtn.addEventListener('click', () => {
    const temp = fromEl.value;
    fromEl.value = toEl.value;
    toEl.value = temp;
    convert();
  });

  convert();
}

function updateTimestamp(data) {
  const el = document.getElementById('update-info');
  if (data.date) {
    const date = new Date(data.date).toLocaleDateString('it-IT', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
    el.textContent = `Ultimo aggiornamento: ${date}`;
  }
}

async function init() {
  try {
    const [latest, previous] = await Promise.all([
      fetchLatestRates(),
      fetchPreviousDayRates()
    ]);

    state.rates = latest.rates;
    state.previousRates = previous.rates;

    updateRateCards(latest, previous);
    updateTimestamp(latest);
    setupTabs();
    setupChartControls();
    setupConverter();
    await loadHistory(state.activePair);
  } catch (err) {
    console.error('Errore caricamento dati:', err);
    document.getElementById('update-info').textContent =
      'Errore nel caricamento dei dati. Riprova più tardi.';
  }
}

window.addEventListener('resize', () => {
  const cacheKey = `${state.activePair}-${state.timeframeDays}`;
  if (state.history[cacheKey]) {
    const [, to] = state.activePair.split('/');
    drawChart(state.history[cacheKey], to);
  }
});

init();
