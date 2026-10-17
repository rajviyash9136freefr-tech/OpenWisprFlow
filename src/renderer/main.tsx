import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/index.css';

// Production Security & Anti-Tamper Protection:
// Disable context menu (inspect element) and developer shortcut keys
if (typeof window !== 'undefined') {
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener(
    'keydown',
    (e) => {
      const isDevKey =
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) ||
        (e.ctrlKey && ['U', 'R'].includes(e.key.toUpperCase()));
      if (isDevKey) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
