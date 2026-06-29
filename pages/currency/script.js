const API_BASE = 'https://api.frankfurter.app';

const state = {
  rates: {},
  previousRates: {},
  history: {},
  baseCurrency: 'USD',
  currencies: ['EUR', 'USD', 'GBP', 'JPY'],
  activePair: 'EUR/USD'
};

async function fetchLatestRates() {
  const res = await fetch(`${API_BASE}/latest?from=${state.baseCurrency}`);
  const data = await res.json();
  return data;
}

async function fetchPreviousDayRates() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  let day = yesterday;
  if (yesterday.getDay() === 0) day.setDate(day.getDate() - 2);
  if (yesterday.getDay() === 6) day.setDate(day.getDate() - 1);
  const dateStr = day.toISOString().split('T')[0];
  const res = await fetch(`${API_BASE}/${dateStr}?from=${state.baseCurrency}`);
  const data = await res.json();
  return data;
}

async function fetchHistory(from, to) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 10);
  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];
  const res = await fetch(`${API_BASE}/${start}..${end}?from=${from}&to=${to}`);
  const data = await res.json();
  return data;
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

  const dates = Object.keys(historyData.rates).sort();
  const values = dates.map(d => historyData.rates[d][to]);

  if (values.length < 2) return;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = { top: 20, bottom: 30, left: 10, right: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const getX = (i) => padding.left + (i / (values.length - 1)) * chartWidth;
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

  values.forEach((v, i) => {
    ctx.beginPath();
    ctx.arc(getX(i), getY(v), 3, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
  });

  ctx.fillStyle = textColor;
  ctx.font = '11px General Sans, sans-serif';
  ctx.textAlign = 'center';
  const step = Math.max(1, Math.floor(dates.length / 5));
  dates.forEach((d, i) => {
    if (i % step === 0 || i === dates.length - 1) {
      const label = d.slice(5);
      ctx.fillText(label, getX(i), height - 8);
    }
  });
}

function updateHistoryTable(historyData, to) {
  const tbody = document.getElementById('history-body');
  const dates = Object.keys(historyData.rates).sort().reverse();

  tbody.innerHTML = dates.map((date, i) => {
    const rate = historyData.rates[date][to];
    const prevDate = dates[i + 1];
    let changeHtml = '-';

    if (prevDate) {
      const prevRate = historyData.rates[prevDate][to];
      const change = ((rate - prevRate) / prevRate) * 100;
      const sign = change >= 0 ? '+' : '';
      const cssClass = change > 0 ? 'change-positive' : change < 0 ? 'change-negative' : '';
      changeHtml = `<span class="${cssClass}">${sign}${change.toFixed(3)}%</span>`;
    }

    const formatted = to === 'JPY' ? rate.toFixed(2) : rate.toFixed(4);
    const dateFormatted = new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit', month: 'short'
    });

    return `<tr><td>${dateFormatted}</td><td>${formatted}</td><td>${changeHtml}</td></tr>`;
  }).join('');
}

async function loadHistory(pair) {
  const [from, to] = pair.split('/');
  const historyData = await fetchHistory(from, to);
  state.history[pair] = historyData;
  drawChart(historyData, to);
  updateHistoryTable(historyData, to);
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

    const res = await fetch(`${API_BASE}/latest?amount=${amount}&from=${from}&to=${to}`);
    const data = await res.json();
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
    setupConverter();
    await loadHistory(state.activePair);
  } catch (err) {
    console.error('Errore caricamento dati:', err);
    document.getElementById('update-info').textContent =
      'Errore nel caricamento dei dati. Riprova più tardi.';
  }
}

window.addEventListener('resize', () => {
  if (state.history[state.activePair]) {
    const [, to] = state.activePair.split('/');
    drawChart(state.history[state.activePair], to);
  }
});

init();
