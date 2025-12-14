
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Send, MessageSquare, Settings, Smartphone, LogOut, Bot } from 'lucide-react';
import { autoMonitoring, MonitoringStatus } from '../services/autoMonitoring';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  const [monitoringStatus, setMonitoringStatus] = useState<MonitoringStatus>(autoMonitoring.getStatus());

  useEffect(() => {
    // Atualizar status do monitoramento
    const updateStatus = (status: MonitoringStatus) => {
      setMonitoringStatus(status);
    };

    autoMonitoring.addListener(updateStatus);

    // Atualizar a cada 10 segundos
    const interval = setInterval(() => {
      setMonitoringStatus(autoMonitoring.getStatus());
    }, 10000);

    return () => {
      autoMonitoring.removeListener(updateStatus);
      clearInterval(interval);
    };
  }, []);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'accounts', label: 'Conexões', icon: Smartphone },
    { id: 'contacts', label: 'Contatos', icon: Users },
    { id: 'campaigns', label: 'Disparos', icon: Send },
    { id: 'chat', label: 'Atendimento', icon: MessageSquare },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-card border-r border-gray-700 h-screen flex flex-col sticky top-0">
      <div className="p-6 flex items-center space-x-3">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20">
          Z
        </div>
        <span className="text-xl font-bold text-white tracking-tight">ZapMaster</span>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Indicador de Automação com Status */}
      <div className="px-6 py-4">
         <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
           monitoringStatus.isRunning 
             ? 'text-green-400 bg-green-500/10 border-green-500/20' 
             : 'text-gray-400 bg-gray-500/10 border-gray-500/20'
         }`}>
            <Bot size={14} className={monitoringStatus.isRunning ? 'animate-pulse' : ''} />
            <div className="flex-1">
              <div className="font-semibold">Monitoramento {monitoringStatus.isRunning ? 'Ativo' : 'Inativo'}</div>
              {monitoringStatus.lastCheck && (
                <div className="text-[10px] text-gray-500 mt-0.5">
                  Última: {monitoringStatus.lastCheck.toLocaleTimeString('pt-BR')}
                </div>
              )}
              {monitoringStatus.totalBlocked > 0 && (
                <div className="text-[10px] text-red-400 mt-0.5">
                  🚫 {monitoringStatus.totalBlocked} bloqueado(s)
                </div>
              )}
            </div>
         </div>
      </div>

      <div className="p-4 border-t border-gray-700">
        <button className="w-full flex items-center space-x-3 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
          <LogOut size={18} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
