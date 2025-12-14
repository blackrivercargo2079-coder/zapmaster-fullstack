import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Contacts from './pages/Contacts';
import Campaigns from './pages/Campaigns';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import { autoMonitoring } from './services/autoMonitoring';

type PageType = 'dashboard' | 'accounts' | 'contacts' | 'campaigns' | 'chat' | 'settings';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');

  // 🤖 Iniciar monitoramento automático ao carregar o app
  useEffect(() => {
    console.log('🚀 Inicializando ZapMaster Pro...');
    
    // Aguarda 2 segundos para garantir que tudo carregou
    const timer = setTimeout(() => {
      autoMonitoring.start();
      console.log('✅ Monitoramento automático iniciado!');
    }, 2000);

    // Cleanup ao desmontar
    return () => {
      clearTimeout(timer);
      autoMonitoring.stop();
    };
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'accounts':
        return <Accounts />;
      case 'contacts':
        return <Contacts />;
      case 'campaigns':
        return <Campaigns />;
      case 'chat':
        return <Chat />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-dark overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 overflow-y-auto p-8">
        {renderPage()}
      </main>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
