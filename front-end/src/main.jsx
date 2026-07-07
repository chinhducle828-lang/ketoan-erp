import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './context/AuthContext.jsx';
import { VoucherProvider } from './context/VoucherContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <SocketProvider>
        <VoucherProvider>
          <App />
        </VoucherProvider>
      </SocketProvider>
    </AuthProvider>
  </React.StrictMode>
);