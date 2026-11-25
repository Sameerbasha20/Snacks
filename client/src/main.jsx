import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './lib/auth';
import { CartProvider } from './lib/cart';
import App from './App';
import { registerAppWorker } from './lib/pwa';
import './index.css';

registerAppWorker();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <CartProvider>
            <App />
            <Toaster
              position="top-center"
              toastOptions={{
                style: { borderRadius: '0.5rem', fontWeight: 600, padding: '10px 14px', background: '#1C1A17', color: '#F5F1EA' },
                success: { iconTheme: { primary: '#E8772E', secondary: '#1C1A17' } },
                error: { iconTheme: { primary: '#F5F1EA', secondary: '#1C1A17' } },
              }}
            />
          </CartProvider>
        </AuthProvider>
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>
);
