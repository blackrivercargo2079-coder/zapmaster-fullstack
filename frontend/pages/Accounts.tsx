
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Smartphone, Trash2, ScanLine, Code, Check, RefreshCw, Loader2, AlertCircle, Link as LinkIcon, Lock } from 'lucide-react';
import { Account } from '../types';
import { apiService, getSettings } from '../services/api';

const STORAGE_KEY_ACCOUNTS = 'zapmaster_accounts';

const Accounts: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  
  // Inputs temporários para as URLs da Z-API
  const [zApiInputs, setZApiInputs] = useState<Record<string, string>>({});
  const [zApiClientTokenInputs, setZApiClientTokenInputs] = useState<Record<string, string>>({});
  
  const [activeTab, setActiveTab] = useState<Record<string, 'QR' | 'API'>>({});
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Load from Storage on Mount
  useEffect(() => {
      const savedAccounts = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
      if (savedAccounts) {
          const parsed: Account[] = JSON.parse(savedAccounts);
          setAccounts(parsed);
          
          // Restaurar abas corretas e inputs
          const tabs: Record<string, 'QR' | 'API'> = {};
          const inputs: Record<string, string> = {};
          const tokenInputs: Record<string, string> = {};
          
          parsed.forEach(acc => {
              tabs[acc.id] = acc.connectionType === 'API' ? 'API' : 'QR';
              if (acc.zApiUrl) inputs[acc.id] = acc.zApiUrl;
              if (acc.zApiClientToken) tokenInputs[acc.id] = acc.zApiClientToken;
          });
          setActiveTab(tabs);
          setZApiInputs(inputs);
          setZApiClientTokenInputs(tokenInputs);
      } else {
          // Initialize with one account if empty
          const initial: Account[] = [{ id: '1', name: 'Conexão Principal', instanceName: 'principal', phoneNumber: '', status: 'DISCONNECTED', connectionType: 'QR_CODE' }];
          setAccounts(initial);
          saveAccounts(initial);
      }
      return () => Object.values(pollingRef.current).forEach(clearInterval);
  }, []);

  const saveAccounts = (newAccounts: Account[]) => {
      setAccounts(newAccounts);
      localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(newAccounts));
  };

  // Lógica original para Evolution/QR Code
  const handleCreateInstance = async (account: Account) => {
      const instanceName = account.instanceName || `instancia_${account.id}`;
      setErrorMap(prev => ({...prev, [account.id]: ''}));
      setLoadingMap(prev => ({...prev, [account.id]: true}));

      try {
          await apiService.createInstance(instanceName);
          startPolling(account.id, instanceName);
      } catch (error: any) {
          console.error(error);
          setErrorMap(prev => ({
              ...prev, 
              [account.id]: error.message || "Erro ao conectar com a API. Verifique Configurações."
          }));
          setLoadingMap(prev => ({...prev, [account.id]: false}));
      }
  };

  const startPolling = (accountId: string, instanceName: string) => {
      if (pollingRef.current[accountId]) clearInterval(pollingRef.current[accountId]);

      pollingRef.current[accountId] = setInterval(async () => {
          const data = await apiService.connectInstance(instanceName);
          
          if (data.status === 'open' || data.status === 'CONNECTED') {
              clearInterval(pollingRef.current[accountId]);
              const updated = accounts.map(a => a.id === accountId ? { ...a, status: 'CONNECTED' as const, phoneNumber: 'Online' } : a);
              saveAccounts(updated);
              setLoadingMap(prev => ({...prev, [accountId]: false}));
          } else if (data.base64) {
              setQrCodes(prev => ({ ...prev, [accountId]: data.base64! }));
              setLoadingMap(prev => ({...prev, [accountId]: false}));
          }
      }, 2000);
  };

  // Nova lógica para Z-API com Sanitização e Client Token
  const handleConnectZApi = async (accountId: string) => {
      const url = zApiInputs[accountId];
      const token = zApiClientTokenInputs[accountId] ? zApiClientTokenInputs[accountId].trim() : undefined;
      
      if (!url) {
          setErrorMap(prev => ({...prev, [accountId]: "Cole a URL da instância da Z-API."}));
          return;
      }

      setLoadingMap(prev => ({...prev, [accountId]: true}));
      setErrorMap(prev => ({...prev, [accountId]: ''}));

      // Passa o token para a validação também
      const result = await apiService.validateZApiConnection(url, token);

      if (result.success) {
          // Usa a URL LIMPA retornada pelo validador para salvar
          const cleanUrl = result.cleanedUrl || url.trim();
          
          const updated = accounts.map(a => a.id === accountId ? { 
              ...a, 
              status: 'CONNECTED' as const, 
              connectionType: 'API' as const,
              phoneNumber: result.phone || 'Z-API Vinculada',
              zApiUrl: cleanUrl,
              zApiClientToken: token // Salva o token de segurança se existir (e não for vazio)
          } : a);
          
          saveAccounts(updated);
          // Atualiza o input com a versão limpa visualmente também
          setZApiInputs(prev => ({...prev, [accountId]: cleanUrl}));
          if (token) setZApiClientTokenInputs(prev => ({...prev, [accountId]: token}));

      } else {
          setErrorMap(prev => ({...prev, [accountId]: result.error || "Falha ao conectar."}));
      }
      setLoadingMap(prev => ({...prev, [accountId]: false}));
  };

  const handleAddAccount = () => {
    if (accounts.length >= 5) {
      alert("Limite de 5 contas atingido.");
      return;
    }
    const newId = Date.now().toString();
    const newAccount: Account = {
      id: newId,
      name: `Conexão ${accounts.length + 1}`,
      instanceName: `zap_${newId}`,
      phoneNumber: '',
      status: 'DISCONNECTED',
      connectionType: 'QR_CODE'
    };
    const updated = [...accounts, newAccount];
    saveAccounts(updated);
    setActiveTab(prev => ({...prev, [newId]: 'QR'}));
  };

  const removeAccount = async (id: string, instanceName?: string) => {
    if(confirm('Tem certeza que deseja remover esta conexão?')) {
        if (instanceName) {
            await apiService.logoutInstance(instanceName);
        }
        if (pollingRef.current[id]) clearInterval(pollingRef.current[id]);
        const updated = accounts.filter(a => a.id !== id);
        saveAccounts(updated);
    }
  };

  const updateAccountName = (id: string, newName: string) => {
      const updated = accounts.map(a => a.id === id ? {...a, name: newName} : a);
      saveAccounts(updated);
  };

  const disconnectAccount = (id: string) => {
      const updated = accounts.map(a => a.id === id ? { ...a, status: 'DISCONNECTED' as const, zApiUrl: undefined, zApiClientToken: undefined } : a);
      saveAccounts(updated);
  };

  const isRealMode = !!getSettings().apiUrl;

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">Gerenciamento de Contas</h2>
          <p className="text-gray-400 text-sm mt-1">
              Gerencie suas instâncias da Evolution API ou Z-API.
          </p>
        </div>
        
        <button 
            onClick={handleAddAccount}
            className="flex items-center space-x-2 px-6 py-3 bg-primary text-white rounded-lg font-bold shadow-lg hover:bg-primary/90 transition-all"
        >
            <Plus size={20} />
            <span>Nova Conexão</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((account) => (
          <div key={account.id} className="bg-card border border-gray-700 rounded-2xl flex flex-col min-h-[500px] relative overflow-hidden shadow-lg">
            
            {/* Header */}
            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800/30">
                <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${account.status === 'CONNECTED' ? 'bg-green-500/20 text-green-500' : 'bg-gray-700 text-gray-400'}`}>
                        <Smartphone size={20} />
                    </div>
                    <div className="flex flex-col">
                        <input 
                            type="text" 
                            value={account.name}
                            onChange={(e) => updateAccountName(account.id, e.target.value)}
                            className="bg-transparent text-white text-sm font-bold focus:outline-none border-b border-transparent focus:border-primary transition-colors w-32"
                        />
                        <span className="text-[10px] text-gray-500">{account.zApiUrl ? 'Via Z-API' : (account.instanceName || 'Local')}</span>
                    </div>
                </div>
                <button onClick={() => removeAccount(account.id, account.instanceName)} className="text-gray-500 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded transition-colors">
                    <Trash2 size={18} />
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 p-6 flex flex-col items-center justify-center">
              
              {account.status === 'CONNECTED' ? (
                <div className="text-center space-y-4 animate-in zoom-in duration-300">
                  <div className="bg-green-500/10 rounded-full p-6 border-4 border-green-500/20 inline-block">
                    <Check size={48} className="text-green-500" />
                  </div>
                  <div>
                      <h3 className="text-xl font-bold text-white">Conectado!</h3>
                      <p className="text-green-400 text-sm font-mono mt-1">{account.phoneNumber || 'Sessão Ativa'}</p>
                      {account.zApiUrl && <span className="text-xs text-gray-500 block mt-1 bg-gray-800 rounded px-2 py-1">Z-API Integrada</span>}
                  </div>
                  <button 
                    onClick={() => disconnectAccount(account.id)}
                    className="text-sm text-red-400 hover:underline mt-4 block"
                  >
                    Desconectar
                  </button>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center h-full">
                    {/* Tabs */}
                    <div className="flex w-full bg-gray-800 rounded-lg p-1 mb-6">
                         <button 
                            onClick={() => setActiveTab(prev => ({...prev, [account.id]: 'QR'}))}
                            className={`flex-1 py-2 text-xs font-bold rounded flex justify-center items-center gap-2 transition-all ${activeTab[account.id] !== 'API' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}
                         >
                            <ScanLine size={14} /> QR Code
                         </button>
                         <button 
                            onClick={() => setActiveTab(prev => ({...prev, [account.id]: 'API'}))}
                            className={`flex-1 py-2 text-xs font-bold rounded flex justify-center items-center gap-2 transition-all ${activeTab[account.id] === 'API' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}
                         >
                            <Code size={14} /> Z-API / Key
                         </button>
                    </div>

                    {/* Error Message */}
                    {errorMap[account.id] && (
                        <div className="w-full bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 flex items-start gap-2 text-left animate-in fade-in">
                            <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-300 break-words">{errorMap[account.id]}</p>
                        </div>
                    )}

                    {activeTab[account.id] === 'API' ? (
                        <div className="w-full space-y-4 animate-in fade-in flex flex-col h-full justify-center">
                            <div className="text-center mb-2">
                                <p className="text-sm text-white font-bold">Integração Z-API</p>
                                <p className="text-xs text-gray-400 mt-1">Copie a "API da instância" do seu painel.</p>
                            </div>
                            
                            {/* URL Input */}
                            <div className="relative">
                                <LinkIcon size={16} className="absolute left-3 top-3 text-gray-500" />
                                <input 
                                    type="text" 
                                    placeholder="https://api.z-api.io/instances/..." 
                                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 pl-10 text-xs text-white focus:border-primary focus:outline-none"
                                    value={zApiInputs[account.id] || ''}
                                    onChange={(e) => setZApiInputs({...zApiInputs, [account.id]: e.target.value})}
                                />
                            </div>

                            {/* Client Token Input (Optional) */}
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-3 text-gray-500" />
                                <input 
                                    type="text" 
                                    placeholder="Client Token (Apenas se configurado)" 
                                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 pl-10 text-xs text-white focus:border-primary focus:outline-none"
                                    value={zApiClientTokenInputs[account.id] || ''}
                                    onChange={(e) => setZApiClientTokenInputs({...zApiClientTokenInputs, [account.id]: e.target.value})}
                                />
                            </div>
                            <p className="text-[10px] text-gray-500 text-center -mt-2">Se sua instância tem proteção por Client Token, preencha acima.</p>
                            
                            <button 
                                onClick={() => handleConnectZApi(account.id)}
                                disabled={loadingMap[account.id]}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded font-bold text-sm disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {loadingMap[account.id] ? <Loader2 className="animate-spin" size={16}/> : 'Validar Integração'}
                            </button>
                        </div>
                    ) : (
                        // Lógica QR Code (Genérica)
                        <div className="flex flex-col items-center justify-center animate-in fade-in w-full flex-1">
                            {!qrCodes[account.id] && !loadingMap[account.id] ? (
                                <div className="text-center space-y-4">
                                    <p className="text-sm text-gray-400">Clique para gerar nova sessão</p>
                                    <button 
                                        onClick={() => handleCreateInstance(account)}
                                        className="bg-primary hover:bg-emerald-600 text-white px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 mx-auto transition-transform active:scale-95"
                                    >
                                        <RefreshCw size={20} />
                                        <span>Gerar QR Code</span>
                                    </button>
                                </div>
                            ) : loadingMap[account.id] ? (
                                <div className="flex flex-col items-center text-primary">
                                    <Loader2 className="animate-spin mb-2" size={40} />
                                    <span className="text-xs animate-pulse">Aguardando API...</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <div className="bg-white p-2 rounded-lg shadow-xl relative group mb-4">
                                        {qrCodes[account.id].startsWith('http') ? (
                                            <img src={qrCodes[account.id]} className="w-48 h-48 object-contain" alt="QR" />
                                        ) : (
                                            <img src={`data:image/png;base64,${qrCodes[account.id]}`} className="w-48 h-48 object-contain" alt="QR" />
                                        )}
                                    </div>
                                    <p className="text-xs text-green-400 animate-pulse">Escaneie com seu WhatsApp</p>
                                </div>
                            )}
                            
                            {(!isRealMode) && (
                                <button 
                                    onClick={() => {
                                        const updated = accounts.map(a => a.id === account.id ? { ...a, status: 'CONNECTED' as const, phoneNumber: 'Simulado' } : a);
                                        saveAccounts(updated);
                                    }}
                                    className="mt-6 w-full py-2 border border-gray-600 rounded text-gray-500 text-xs hover:bg-gray-800 hover:text-white transition-colors"
                                >
                                    Simular Conexão (Demo)
                                </button>
                            )}
                        </div>
                    )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Accounts;
