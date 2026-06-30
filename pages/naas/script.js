const history = [];

async function fetchNo() {
  return window.NaasApi.fetchNoReason();
}

function updateDisplay(reason) {
  const textEl = document.getElementById('no-text');
  const iconEl = document.querySelector('.no-icon');

  textEl.textContent = `"${reason}"`;

  iconEl.classList.remove('shake');
  void iconEl.offsetWidth;
  iconEl.classList.add('shake');
}

function addToHistory(reason) {
  history.unshift(reason);
  if (history.length > 10) history.pop();
  renderHistory();
}

function renderHistory() {
  const listEl = document.getElementById('history-list');

  if (history.length === 0) {
    listEl.innerHTML = '<li class="empty-state">Nessun rifiuto generato ancora.</li>';
    return;
  }

  listEl.innerHTML = history.map((reason, i) =>
    `<li class="history-item">
      <span class="history-number">${i + 1}</span>
      <span class="history-text">${reason}</span>
    </li>`
  ).join('');
}

function setup() {
  const btn = document.getElementById('generate-btn');

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Caricamento...';

    try {
      const reason = await fetchNo();
      updateDisplay(reason);
      addToHistory(reason);
    } catch (err) {
      document.getElementById('no-text').textContent = 'Errore nel caricamento. Riprova.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Genera un No';
    }
  });

  renderHistory();
}

setup();
