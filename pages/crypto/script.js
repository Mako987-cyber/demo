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
  reversed: false
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

async function fetchHistory(coinId, vsCurrency) {
  const key = `${coinId}-${vsCurrency}`;
  if (state.historyCache[key]) return state.historyCache[key];

  const data = await window.CryptoApi.fetchHistory(coinId, vsCurrency, 7);
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

function drawChart(historyData) {
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
  const step = Math.max(1, Math.floor(prices.length / 50));
  const sampled = prices.filter((_, i) => i % step === 0);

  if (sampled.length < 2) return;

  const values = sampled.map(p => p[1]);
  const timestamps = sampled.map(p => p[0]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = { top: 20, bottom: 30, left: 10, right: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const getX = (i) => padding.left + (i / (sampled.length - 1)) * chartWidth;
  const getY = (v) => padding.top + chartHeight - ((v - min) / range) * chartHeight;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const lineColor = isDark ? '#63aab3' : '#0a6b74';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  gradient.addColorStop(0, isDark ? 'rgba(99,170,179,0.2)' : 'rgba(10,107,116,0.1)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.beginPath();
  ctx.moveTo(getX(0), getY(values[0]));
  values.forEach((v, i) => {
    if (i > 0) ctx.lineTo(getX(i), getY(v));
  });
  ctx.lineTo(getX(values.length - 1), height - padding.bottom);
  ctx.lineTo(getX(0), height - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(getX(0), getY(values[0]));
  values.forEach((v, i) => {
    if (i > 0) ctx.lineTo(getX(i), getY(v));
  });
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = '11px General Sans, sans-serif';
  ctx.textAlign = 'center';
  const labelStep = Math.max(1, Math.floor(sampled.length / 6));
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
  const data = await fetchHistory(state.activeCoin, state.vsCurrency);
  drawChart(data);
  updateHistoryTable(data);
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
  if (state.historyCache[`${state.activeCoin}-${state.vsCurrency}`]) {
    const data = state.historyCache[`${state.activeCoin}-${state.vsCurrency}`];
    drawChart(data);
  }
});

init();
