
import React, { useState, useEffect } from 'react';
import { Save, Server, Key, Globe, AlertTriangle, CheckCircle, Wifi, WifiOff, Activity, Download, Upload, FileJson, RefreshCw, Radio, Link as LinkIcon } from 'lucide-react';
import { getSettings, saveSettings, apiService } from '../services/api';
import { SystemSettings } from '../types';

const Settings: React.FC = () => {
  const [config, setConfig] = useState<SystemSettings>({ apiUrl: '', apiToken: '', webhookUrl: '' });
  const [saved, setSaved] = useState(false);
  
  // Connection Test States
  const [testStatus, setTestStatus] = useState<'IDLE' | 'TESTING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [testMessage, setTestMessage] = useState('');
  const [isHttpsContext, setIsHttpsContext] = useState(false);

  // Backup States
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    setConfig(getSettings());
    setIsHttpsContext(window.location.protocol === 'https:');
  }, []);

  const handleSave = () => {
    const cleanUrl = config.apiUrl.replace(/\/$/, '');
    const newConfig = { ...config, apiUrl: cleanUrl };
    saveSettings(newConfig);
    setConfig(newConfig);
    setSaved(true);
    setTestStatus('IDLE'); // Reset test status on save
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTestConnection = async () => {
      if (!config.apiUrl) {
          setTestStatus('ERROR');
          setTestMessage("Preencha a URL da API antes de testar.");
          return;
      }
      
      // Save temporarily to test
      saveSettings(config);
      
      setTestStatus('TESTING');
      setTestMessage("Conectando ao servidor...");
      
      const result = await apiService.testConnection();
      
      if (result.success) {
          setTestStatus('SUCCESS');
          setTestMessage(result.message);
      } else {
          setTestStatus('ERROR');
          setTestMessage(result.message);
      }
  };

  // --- BACKUP FUNCTIONS ---

  const handleExportData = () => {
      const data = {
          settings: localStorage.getItem('zapmaster_settings'),
          accounts: localStorage.getItem('zapmaster_accounts'),
          contacts: localStorage.getItem('zapmaster_contacts'),
          timestamp: new Date().toISOString(),
          version: '2.0 (Full Data)'
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `zapmaster-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!confirm("ATENÇÃO: Restaurar um backup substituirá TODOS os contatos, conexões e configurações atuais. Deseja continuar?")) {
          e.target.value = '';
          return;
      }

      setIsImporting(true);
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const json = JSON.parse(event.target?.result as string);
              
              if (json.settings) localStorage.setItem('zapmaster_settings', json.settings);
              if (json.accounts) localStorage.setItem('zapmaster_accounts', json.accounts);
              if (json.contacts) localStorage.setItem('zapmaster_contacts', json.contacts);
              
              alert("Backup restaurado com sucesso! O sistema será reiniciado.");
              window.location.reload();
          } catch (err) {
              console.error(err);
              alert("Erro ao ler arquivo de backup. O arquivo parece corrompido ou inválido.");
              setIsImporting(false);
          }
      };
      reader.readAsText(file);
  };

  const handleResetSystem = () => {
      const confirmText = prompt("Para confirmar o reset total, digite 'RESETAR' abaixo:");
      if (confirmText === 'RESETAR') {
          localStorage.clear();
          window.location.reload();
      } else if (confirmText !== null) {
          alert("Ação cancelada. Código incorreto.");
      }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <header>
        <h2 className="text-3xl font-bold text-white">Configurações do Sistema</h2>
        <p className="text-gray-400 mt-1">Gerencie a conexão com a API e faça backup dos seus dados.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Config Form */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* API Connection Card */}
            <div className="bg-card border border-gray-700 rounded-2xl p-8 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                    <Server className="mr-2 text-primary" size={20} /> Conexão Evolution API (Opcional)
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                    Configure abaixo apenas se você utilizar a Evolution API própria. Se usar Z-API, configure diretamente na tela de Conexões.
                </p>
                
                <div className="space-y-6">
                    <div>
                        <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
                            <Globe size={16} />
                            <span>URL Base da API</span>
                        </label>
                        <input 
                            type="text" 
                            placeholder="Ex: http://localhost:8080 ou https://api.seudominio.com"
                            className={`w-full bg-gray-900 border rounded-lg p-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${
                                isHttpsContext && config.apiUrl.startsWith('http:') 
                                ? 'border-yellow-500/50' 
                                : 'border-gray-600'
                            }`}
                            value={config.apiUrl}
                            onChange={(e) => setConfig({...config, apiUrl: e.target.value})}
                        />
                        {isHttpsContext && config.apiUrl.startsWith('http:') && (
                            <p className="text-xs text-yellow-500 mt-2 flex items-center">
                                <AlertTriangle size={12} className="mr-1"/> 
                                Atenção: Site em HTTPS pode bloquear API em HTTP (Mixed Content). Use HTTPS na API se possível.
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
                            <Key size={16} />
                            <span>Global API Key</span>
                        </label>
                        <input 
                            type="password" 
                            placeholder="Sua chave de autenticação global"
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                            value={config.apiToken}
                            onChange={(e) => setConfig({...config, apiToken: e.target.value})}
                        />
                    </div>

                    <div className="pt-4 border-t border-gray-800">
                         <label className="flex items-center space-x-2 text-sm font-medium text-gray-300 mb-2">
                            <LinkIcon size={16} />
                            <span>Webhook URL (Referência)</span>
                        </label>
                        <input 
                            type="text" 
                            placeholder="Opcional: Salve aqui sua URL de webhook para consulta futura"
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm"
                            value={config.webhookUrl || ''}
                            onChange={(e) => setConfig({...config, webhookUrl: e.target.value})}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            O sistema utiliza Polling (Consulta Ativa), então o Webhook não é estritamente necessário para funcionamento básico, mas você pode salvar sua URL aqui.
                        </p>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-700 flex items-center justify-between">
                    <div className="text-sm">
                        {!config.apiUrl ? (
                            <span className="text-gray-500 flex items-center">
                                <Radio size={16} className="mr-2" /> Modo Standalone / Z-API Direto
                            </span>
                        ) : (
                            <span className="text-blue-400 flex items-center">
                                <Activity size={16} className="mr-2" /> Modo Centralizado Ativo
                            </span>
                        )}
                    </div>

                    <button 
                        onClick={handleSave}
                        className={`px-8 py-3 rounded-lg font-bold flex items-center space-x-2 transition-all transform active:scale-95 ${
                            saved ? 'bg-green-500 text-white' : 'bg-primary hover:bg-emerald-600 text-white'
                        }`}
                    >
                        {saved ? <CheckCircle size={20} /> : <Save size={20} />}
                        <span>{saved ? 'Salvo!' : 'Salvar Configurações'}</span>
                    </button>
                </div>
            </div>

            {/* Backup & Restore Section */}
            <div className="bg-card border border-gray-700 rounded-2xl p-8 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <FileJson size={120} />
                </div>
                
                <h3 className="text-lg font-bold text-white mb-6 flex items-center relative z-10">
                    <Download className="mr-2 text-purple-400" size={20} /> Backup & Migração
                </h3>
                
                <p className="text-sm text-gray-400 mb-8 max-w-lg relative z-10">
                    Exporte todos os dados do ZapMaster (Contatos, Conexões Z-API, Histórico Local) para um arquivo JSON seguro. 
                    Use isso para salvar seu progresso ou mudar de computador.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                    <button 
                        onClick={handleExportData}
                        className="flex flex-col items-center justify-center p-6 bg-gray-800 hover:bg-gray-750 border border-gray-600 rounded-xl transition-all hover:border-purple-500 group"
                    >
                        <div className="bg-purple-500/20 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                            <Download size={24} className="text-purple-400" />
                        </div>
                        <span className="font-bold text-white">Baixar Backup Completo</span>
                        <span className="text-xs text-gray-500 mt-1">Arquivo .json</span>
                    </button>

                    <label className="flex flex-col items-center justify-center p-6 bg-gray-800 hover:bg-gray-750 border border-gray-600 rounded-xl transition-all hover:border-blue-500 cursor-pointer group">
                        <div className="bg-blue-500/20 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                            {isImporting ? <RefreshCw size={24} className="text-blue-400 animate-spin" /> : <Upload size={24} className="text-blue-400" />}
                        </div>
                        <span className="font-bold text-white">Restaurar Dados</span>
                        <span className="text-xs text-gray-500 mt-1">Carregar .json</span>
                        <input type="file" className="hidden" accept=".json" onChange={handleImportData} disabled={isImporting} />
                    </label>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-red-400 mb-2 flex items-center">
                    <AlertTriangle size={16} className="mr-2" /> Zona de Perigo
                </h3>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <p className="text-xs text-red-300/70">
                        Esta ação apagará permanentemente todos os dados locais do navegador.<br/>
                        Certifique-se de ter um backup antes de prosseguir.
                    </p>
                    <button 
                        onClick={handleResetSystem}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded shadow-lg shadow-red-900/20 transition-colors whitespace-nowrap"
                    >
                        Resetar Fábrica
                    </button>
                </div>
            </div>
          </div>

          {/* Right Column: Status & Tools */}
          <div className="space-y-6">
              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 sticky top-6">
                    <h4 className="text-white font-bold mb-4 flex items-center">
                        <Activity size={18} className="mr-2 text-primary"/> Diagnóstico de Rede
                    </h4>
                    
                    {testStatus === 'IDLE' && (
                        <p className="text-xs text-gray-400 leading-relaxed">
                            Ferramenta para testar se o ZapMaster consegue alcançar sua Evolution API configurada.
                            <br/><br/>
                            Para Z-API, o teste é feito individualmente na tela de "Conexões".
                        </p>
                    )}
                    
                    {testStatus === 'TESTING' && (
                        <div className="flex items-center text-yellow-400 text-sm animate-pulse my-4">
                            <Activity size={16} className="mr-2" /> Verificando conectividade...
                        </div>
                    )}

                    {testStatus === 'SUCCESS' && (
                        <div className="bg-green-500/10 p-3 rounded-lg border border-green-500/20 animate-in fade-in my-4">
                            <div className="flex items-center text-green-400 font-bold text-sm mb-1">
                                <Wifi size={16} className="mr-2" /> Conexão Estável
                            </div>
                            <p className="text-xs text-green-200">{testMessage}</p>
                        </div>
                    )}

                    {testStatus === 'ERROR' && (
                        <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20 animate-in fade-in my-4">
                            <div className="flex items-center text-red-400 font-bold text-sm mb-1">
                                <WifiOff size={16} className="mr-2" /> Falha na Conexão
                            </div>
                            <p className="text-xs text-red-200 break-words">{testMessage}</p>
                        </div>
                    )}

                    <button 
                        onClick={handleTestConnection}
                        disabled={!config.apiUrl}
                        className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors border border-gray-600 flex justify-center items-center"
                    >
                        {testStatus === 'TESTING' ? <RefreshCw className="animate-spin" size={16} /> : 'Testar Evolution API'}
                    </button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default Settings;
