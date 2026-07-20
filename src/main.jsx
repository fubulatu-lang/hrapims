import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Applied here (not inside a component) so the correct theme is present
// for the very first paint instead of flashing the default theme first.
document.body.dataset.theme = localStorage.getItem('hrapims.theme') || 'light';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Registered after load so it never competes with the initial render for
// bandwidth/CPU. Failure here (unsupported browser, blocked, etc.) is
// silently non-fatal — the app works identically without a service
// worker, it just loses the offline-shell/install-prompt benefits.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
