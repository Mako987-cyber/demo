const weatherApp = {
  elements: {
    cityInput: document.getElementById('cityInput'),
    searchBtn: document.getElementById('searchBtn'),
    errorDiv: document.getElementById('errorMessage'),
    loadingDiv: document.getElementById('loadingMessage'),
    resultDiv: document.getElementById('weatherResult')
  },

  init() {
    this.elements.searchBtn.addEventListener('click', () => this.search());
    this.elements.cityInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') this.search();
    });
  },

  async search() {
    const city = this.elements.cityInput.value.trim();

    if (!city) {
      this.showError('Inserisci il nome di una città.');
      return;
    }

    this.clearMessages();
    this.setLoading(true);

    try {
      const endpoint = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
      const response = await fetch(endpoint, {
        headers: {
          Accept: 'text/plain'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const rawText = await response.text();
      this.elements.resultDiv.textContent = rawText;
    } catch (error) {
      this.showError(`Errore durante la chiamata a wttr.in: ${error.message}`);
      this.elements.resultDiv.textContent = 'Nessun risultato disponibile.';
    } finally {
      this.setLoading(false);
    }
  },

  setLoading(isLoading) {
    this.elements.loadingDiv.hidden = !isLoading;
    this.elements.searchBtn.disabled = isLoading;
    this.elements.searchBtn.textContent = isLoading ? 'Caricamento...' : 'Esegui curl';
  },

  showError(message) {
    this.elements.errorDiv.textContent = message;
    this.elements.errorDiv.hidden = false;
  },

  clearMessages() {
    this.elements.errorDiv.hidden = true;
    this.elements.errorDiv.textContent = '';
  }
};

document.addEventListener('DOMContentLoaded', () => weatherApp.init());
