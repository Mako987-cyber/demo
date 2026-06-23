document.getElementById('load').addEventListener('click', async () => {
  const city = document.getElementById('city').value || 'Milano';
  const outElement = document.getElementById('out');

  try {
    outElement.textContent = 'Caricamento...';
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
    const data = await res.json();
    outElement.textContent = JSON.stringify(data.current_condition?.[0] || data, null, 2);
  } catch (error) {
    outElement.textContent = `Errore: ${error.message}\n\nVerifica il nome della città e riprova.`;
  }
});

// Permetti di premere Enter
document.getElementById('city').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('load').click();
  }
});
