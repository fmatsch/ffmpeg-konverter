import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './styles/global.css';
import App from './App';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root-Element nicht gefunden');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
