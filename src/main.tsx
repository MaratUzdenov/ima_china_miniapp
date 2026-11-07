import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setupTelegram } from './telegram';
import { checkForUpdate } from './version';
import { OrdersScreen } from './screens/OrdersScreen';
import './styles.css';

setupTelegram();
void checkForUpdate();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OrdersScreen />
  </StrictMode>,
);
