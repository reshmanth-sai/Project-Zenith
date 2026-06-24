import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ObserverProvider } from './context/ObserverContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ObserverProvider>
      <App />
    </ObserverProvider>
  </StrictMode>,
);

