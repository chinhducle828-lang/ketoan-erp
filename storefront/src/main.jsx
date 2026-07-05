import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Initialize WebSocket on app start
import wsService from './services/websocket';

// Get company ID from localStorage or context
const companyId = localStorage.getItem('companyId');
const userId = localStorage.getItem('userId');

if (companyId && userId) {
  wsService.connect(companyId, userId);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);