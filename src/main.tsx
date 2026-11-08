import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setupTelegram } from './telegram';
import { checkForUpdate } from './version';
import { App } from './App';
import './styles.css';

setupTelegram();
void checkForUpdate();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
