'use strict';
const feedback = document.getElementById('feedback');
async function status() {
  const views = document.getElementById('views');
  try {
    const response = await fetch('/api/status');
    if (!response.ok) throw new Error('HTTP');
    const data = await response.json();
    views.textContent = data.gameWindows ? `${data.gameWindows} game window(s) connected` : 'Open the game to enable tests';
  } catch {
    views.textContent = 'Server disconnected';
  }
}
async function send(type, giftName) {
  try {
    const response = await fetch('/api/command', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({type, giftName, name: 'Local test', text: '!apple'})
    });
    const data = await response.json();
    feedback.textContent = data.ok ? `✓ Simulated in ${data.receivers} window(s)` : (data.error || 'Error');
  } catch {
    feedback.textContent = 'Could not send the event';
  }
  status();
}
document.querySelectorAll('button[data-type]').forEach(button => {
  button.addEventListener('click', () => send(button.dataset.type, button.dataset.gift));
});
status();
setInterval(status, 5000);
