import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setupTelegram } from './telegram';
import { OrdersScreen } from './screens/OrdersScreen';
import './styles.css';

setupTelegram();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OrdersScreen />
  </StrictMode>,
);
