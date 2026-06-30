const COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ripple', symbol: 'XRP', name: 'Ripple' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' }
];

const state = {
  prices: {},
  vsCurrency: 'eur',
  activeCoin: 'bitcoin',
  historyCache: {},
  candleCache: {},
  reversed: false,
  chartType: 'line',
  timeframeDays: 7
};

const BINANCE_SYMBOLS = {
  bitcoin: { usd: 'BTCUSDT', eur: 'BTCEUR' },
  ethereum: { usd: 'ETHUSDT', eur: 'ETHEUR' },
  solana: { usd: 'SOLUSDT', eur: 'SOLEUR' },
  ripple: { usd: 'XRPUSDT', eur: 'XRPEUR' },
  cardano: { usd: 'ADAUSDT', eur: 'ADAEUR' }
};

function formatPrice(value, currency) {
  if (value >= 1000) {
    return value.toLocaleString('it-IT', { maximumFractionDigits: 0 });
  } else if (value >= 1) {
    return value.toLocaleString('it-IT', { maximumFractionDigits: 2 });
  } else {
    return value.toLocaleString('it-IT', { maximumFractionDigits: 4 });
  }
}

function getCurrencySymbol(currency) {
  return currency === 'eur' ? '\u20AC' : '$';
}

async function fetchPrices() {
  const ids = COINS.map(c => c.id);
  return window.CryptoApi.fetchPrices(ids);
}

async function fetchHistory(coinId, vsCurrency, days) {
  const key = `${coinId}-${vsCurrency}-${days}`;
  if (state.historyCache[key]) return state.historyCache[key];

  const data = await window.CryptoApi.fetchHistory(coinId, vsCurrency, days);
  state.historyCache[key] = data;
  return data;
}

function updatePriceCards() {
  const vs = state.vsCurrency;
  const symbol = getCurrencySymbol(vs);

  COINS.forEach(coin => {
    const priceEl = document.getElementById(`price-${coin.id}`);
    const changeEl = document.getElementById(`change-${coin.id}`);
    const data = state.prices[coin.id];

    if (!data) return;

    const price = data[vs];
    const change = data[`${vs}_24h_change`];

    priceEl.textContent = `${symbol}${formatPrice(price, vs)}`;

    const sign = change >= 0 ? '+' : '';
    changeEl.textContent = `${sign}${change.toFixed(2)}%`;

    if (change > 0) {
      changeEl.className = 'rate-change positive';
    } else if (change < 0) {
      changeEl.className = 'rate-change negative';
    } else {
      changeEl.className = 'rate-change neutral';
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

function getCryptoCandles(prices) {
  if (!prices || prices.length < 2) return [];

  const bucketSize = Math.max(2, Math.floor(prices.length / 45));
  const candles = [];

  for (let i = 0; i < prices.length; i += bucketSize) {
    const bucket = prices.slice(i, i + bucketSize);
    if (!bucket.length) continue;

    const values = bucket.map(p => p[1]);
    candles.push({
      ts: bucket[bucket.length - 1][0],
      open: bucket[0][1],
      close: bucket[bucket.length - 1][1],
      high: Math.max(...values),
      low: Math.min(...values)
    });
  }

  return candles;
}

function getIntervalConfig(days) {
  if (days <= 7) return { interval: '1h', limit: days * 24 };
  if (days <= 30) return { interval: '4h', limit: days * 6 };
  if (days <= 90) return { interval: '12h', limit: days * 2 };
  return { interval: '1d', limit: days };
}

async function fetchRealCandles(coinId, vsCurrency, days) {
  const cacheKey = `${coinId}-${vsCurrency}-${days}`;
  if (state.candleCache[cacheKey]) return state.candleCache[cacheKey];

  const { interval, limit } = getIntervalConfig(days);
  const pairMap = BINANCE_SYMBOLS[coinId] || {};
  const primary = vsCurrency === 'eur' ? pairMap.eur : pairMap.usd;
  const fallback = pairMap.usd;
  const symbolsToTry = [primary, fallback].filter(Boolean);

  let lastError = null;
  for (const symbol of symbolsToTry) {
    try {
      const rows = await window.CryptoApi.fetchCandles(symbol, interval, Math.min(limit, 1000));
      const candles = rows.map(row => ({
        ts: row[0],
        open: parseFloat(row[1]),
        high: parseFloat(row[2]),
        low: parseFloat(row[3]),
        close: parseFloat(row[4])
      }));
      state.candleCache[cacheKey] = candles;
      return candles;
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError) throw lastError;
  return [];
}

function drawChart(historyData, realtimeCandles) {
  const canvas = document.getElementById('chart-canvas');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = canvas.offsetHeight * dpr;
  ctx.scale(dpr, dpr);

  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;
  ctx.clearRect(0, 0, width, height);

  const prices = historyData.prices;
  const step = Math.max(1, Math.floor(prices.length / 70));
  const sampled = prices.filter((_, i) => i % step === 0);

  if (sampled.length < 2) return;

  const syntheticCandles = getCryptoCandles(prices);
  const candles = Array.isArray(realtimeCandles) && realtimeCandles.length > 1
    ? realtimeCandles
    : syntheticCandles;
  const isCandle = state.chartType === 'candle' && candles.length > 1;
  const values = isCandle
    ? candles.flatMap(c => [c.low, c.high])
    : sampled.map(p => p[1]);
  const timestamps = isCandle
    ? candles.map(c => c.ts)
    : sampled.map(p => p[0]);

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
    const lineValues = sampled.map(p => p[1]);

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
  }

  ctx.fillStyle = palette.textColor;
  ctx.font = '11px General Sans, sans-serif';
  ctx.textAlign = 'center';
  const labelStep = Math.max(1, Math.floor(timestamps.length / 6));
  timestamps.forEach((ts, i) => {
    if (i % labelStep === 0 || i === timestamps.length - 1) {
      const date = new Date(ts);
      const label = `${date.getDate()}/${date.getMonth() + 1}`;
      ctx.fillText(label, getX(i), height - 8);
    }
  });
}

function updateHistoryTable(historyData) {
  const tbody = document.getElementById('history-body');
  const prices = historyData.prices;
  const symbol = getCurrencySymbol(state.vsCurrency);

  const dailyPrices = [];
  let lastDay = null;
  for (let i = prices.length - 1; i >= 0; i--) {
    const date = new Date(prices[i][0]);
    const dayKey = date.toDateString();
    if (dayKey !== lastDay) {
      dailyPrices.push(prices[i]);
      lastDay = dayKey;
    }
    if (dailyPrices.length >= 8) break;
  }

  tbody.innerHTML = dailyPrices.map((entry, i) => {
    const price = entry[1];
    const date = new Date(entry[0]);
    let changeHtml = '-';

    if (i < dailyPrices.length - 1) {
      const prevPrice = dailyPrices[i + 1][1];
      const change = ((price - prevPrice) / prevPrice) * 100;
      const sign = change >= 0 ? '+' : '';
      const cssClass = change > 0 ? 'change-positive' : change < 0 ? 'change-negative' : '';
      changeHtml = `<span class="${cssClass}">${sign}${change.toFixed(2)}%</span>`;
    }

    const formatted = `${symbol}${formatPrice(price, state.vsCurrency)}`;
    const dateFormatted = date.toLocaleDateString('it-IT', {
      day: '2-digit', month: 'short'
    });

    return `<tr><td>${dateFormatted}</td><td>${formatted}</td><td>${changeHtml}</td></tr>`;
  }).join('');
}

async function loadHistory() {
  const data = await fetchHistory(state.activeCoin, state.vsCurrency, state.timeframeDays);
  let realtimeCandles = [];
  if (state.chartType === 'candle') {
    try {
      realtimeCandles = await fetchRealCandles(state.activeCoin, state.vsCurrency, state.timeframeDays);
    } catch (err) {
      console.warn('Fallback su candele sintetiche:', err);
    }
  }

  drawChart(data, realtimeCandles);
  updateHistoryTable(data);
}

function setupChartControls() {
  const timeframeEl = document.getElementById('history-timeframe');
  timeframeEl.value = String(state.timeframeDays);

  timeframeEl.addEventListener('change', () => {
    state.timeframeDays = parseInt(timeframeEl.value, 10);
    loadHistory();
  });

  document.querySelectorAll('.chart-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chart-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.chartType = btn.dataset.chartType;
      loadHistory();
    });
  });
}

function setupTabs() {
  document.querySelectorAll('.history-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.history-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeCoin = tab.dataset.coin;
      loadHistory();
    });
  });
}

function setupCurrencyToggle() {
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.vsCurrency = btn.dataset.vs;
      updatePriceCards();
      loadHistory();
      convert();
    });
  });
}

function setupConverter() {
  const amountEl = document.getElementById('amount-from');
  const cryptoEl = document.getElementById('crypto-from');
  const fiatEl = document.getElementById('fiat-to');
  const swapBtn = document.getElementById('swap-btn');

  function doConvert() {
    const amount = parseFloat(amountEl.value) || 0;
    const coinId = cryptoEl.value;
    const fiat = fiatEl.value;
    const symbol = getCurrencySymbol(fiat);
    const resultEl = document.getElementById('converter-result').querySelector('.result-value');

    const data = state.prices[coinId];
    if (!data) {
      resultEl.textContent = '--';
      return;
    }

    const price = data[fiat];
    const coinSymbol = COINS.find(c => c.id === coinId).symbol;

    if (state.reversed) {
      const result = amount / price;
      resultEl.textContent = `${symbol}${formatPrice(amount, fiat)} = ${result.toFixed(6)} ${coinSymbol}`;
    } else {
      const result = amount * price;
      resultEl.textContent = `${amount} ${coinSymbol} = ${symbol}${formatPrice(result, fiat)}`;
    }
  }

  window.convert = doConvert;

  amountEl.addEventListener('input', doConvert);
  cryptoEl.addEventListener('change', doConvert);
  fiatEl.addEventListener('change', doConvert);
  swapBtn.addEventListener('click', () => {
    state.reversed = !state.reversed;
    doConvert();
  });

  doConvert();
}

async function init() {
  try {
    const prices = await fetchPrices();
    state.prices = prices;

    updatePriceCards();
    setupTabs();
    setupCurrencyToggle();
    setupChartControls();
    setupConverter();
    await loadHistory();

    const now = new Date().toLocaleString('it-IT', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    document.getElementById('update-info').textContent = `Ultimo aggiornamento: ${now}`;
  } catch (err) {
    console.error('Errore caricamento dati:', err);
    document.getElementById('update-info').textContent =
      'Errore nel caricamento dei dati. Riprova più tardi.';
  }
}

window.addEventListener('resize', () => {
  const key = `${state.activeCoin}-${state.vsCurrency}-${state.timeframeDays}`;
  if (state.historyCache[key]) {
    loadHistory();
  }
});

init();
