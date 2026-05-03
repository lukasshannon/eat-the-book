import { initGame } from './game-core.js';

initGame().catch((error) => {
  const errorBox = document.getElementById('errorBox');
  if (errorBox) {
    errorBox.style.display = 'block';
    errorBox.textContent = `Error: ${error.message}`;
  }
});
