import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import Login from './views/auth/Login.jsx';
import Register from './views/auth/Register.jsx';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import MainContent from './components/MainContent.jsx';

export default function App() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('opening');
  const [isFirstRun, setIsFirstRun] = useState(false);

  if (!token) {
    if (isFirstRun) {
      return <Register onSwitch={() => setIsFirstRun(false)} />;
    }
    return <Login onFirstRun={() => setIsFirstRun(true)} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <MainContent activeTab={activeTab} />
        </main>
      </div>
    </div>
  );
}