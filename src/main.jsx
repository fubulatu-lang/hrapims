import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Applied here (not inside a component) so the correct theme is present
// for the very first paint instead of flashing light mode first.
const theme = localStorage.getItem('hrapims.theme') || 'light';
document.body.classList.toggle('dark', theme === 'dark' || theme === 'midnight');
document.body.classList.toggle('midnight', theme === 'midnight');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
