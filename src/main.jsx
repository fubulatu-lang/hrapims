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
