'use strict';
const feedback = document.getElementById('feedback');
async function status() {
  const views = document.getElementById('views');
  try {
    const response = await fetch('/api/status');
    if (!response.ok) throw new Error('HTTP');
    const data = await response.json();
    views.textContent = data.gameWindows ? `${data.gameWindows} ventana(s) del juego conectada(s)` : 'Abre el juego para activar las pruebas';
  } catch {
    views.textContent = 'Servidor desconectado';
  }
}
async function send(type, giftName) {
  try {
    const response = await fetch('/api/command', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({type, giftName, name: 'Prueba local', text: '!manzana'})
    });
    const data = await response.json();
    feedback.textContent = data.ok ? `✓ Simulado en ${data.receivers} ventana(s)` : (data.error || 'Error');
  } catch {
    feedback.textContent = 'No se pudo enviar el evento';
  }
  status();
}
document.querySelectorAll('button[data-type]').forEach(button => {
  button.addEventListener('click', () => send(button.dataset.type, button.dataset.gift));
});
status();
setInterval(status, 5000);
