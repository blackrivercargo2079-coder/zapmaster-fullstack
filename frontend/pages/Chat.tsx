import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Search, User, Loader2, RefreshCw, Clock } from 'lucide-react';
import { apiService } from '../services/api';
import { Account, ChatSession, ChatMessage } from '../types';

const STORAGE_KEY_ACCOUNTS = 'zapmaster_accounts';

const Chat: React.FC = () => {
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  
  // Estado Dividido: Histórico Real + Fila de Envio
  const [serverMessages, setServerMessages] = useState<ChatMessage[]>([]);
  const [pendingMessages, setPendingMessages] = useState<ChatMessage[]>([]);
  
  const [inputValue, setInputValue] = useState('');
  
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carrega conta inicial
  useEffect(() => {
      const savedAccounts = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
      if (savedAccounts) {
          const parsed: Account[] = JSON.parse(savedAccounts);
          const connected = parsed.find(a => a.status === 'CONNECTED');
          if (connected) {
              setActiveAccount(connected);
              loadChats(connected);
          }
      }
  }, []);

  // Polling - Busca novas mensagens automaticamente
  useEffect(() => {
      if (!activeAccount) return;
      
      console.log('🔄 Polling iniciado para conta:', activeAccount.name);
      
      const interval = setInterval(() => {
          // Atualiza lista de chats silenciosamente
          loadChats(activeAccount, true);
          // Se tiver chat aberto, atualiza mensagens
          if (activeChatId) {
              console.log('📥 Buscando novas mensagens para:', activeChatId);
              loadMessages(activeAccount, activeChatId, true);
          }
      }, 3000); // 3 segundos - mais rápido
      
      return () => {
          console.log('⏹️ Polling parado');
          clearInterval(interval);
      };
  }, [activeAccount, activeChatId]);

  // Scroll to bottom
  useEffect(() => {
      // Pequeno delay para garantir renderização antes do scroll
      setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
  }, [serverMessages.length, pendingMessages.length, activeChatId]);

  const loadChats = async (account: Account, silent = false) => {
      if (!silent) setIsLoadingChats(true);
      const data = await apiService.getChats(account);
      console.log('📋 Chats carregados:', data.length);
      
      // ✅ FILTRO DE SEGURANÇA: Remove chats sem ID válido
      const validChats = data.filter(chat => chat.id && typeof chat.id === 'string');
      setChats(validChats);
      
      if (!silent) setIsLoadingChats(false);
  };

  const loadMessages = async (account: Account, chatId: string, silent = false) => {
      if (!silent) setIsLoadingMessages(true);
      const history = await apiService.getChatMessages(account, chatId);
      console.log('💬 Mensagens carregadas:', history.length, 'para chat:', chatId);
      
      // Atualiza mensagens do servidor
      setServerMessages(history);

      // LIMPEZA DA FILA PENDENTE:
      // Se a mensagem pendente já apareceu no histórico (match por texto e timestamp próximo), remove da pendência.
      setPendingMessages(currentPending => {
          return currentPending.filter(pending => {
              const isSynced = history.some(serverMsg => 
                  // Match por ID explícito
                  serverMsg.id === pending.id || 
                  // OU Match heurístico: mesmo texto, enviado por 'agent', e tempo próximo (< 2 min de diferença)
                  (
                      serverMsg.text === pending.text && 
                      serverMsg.sender === 'agent' && 
                      Math.abs(new Date(serverMsg.timestamp).getTime() - new Date(pending.timestamp).getTime()) < 120000
                  )
              );
              return !isSynced; // Mantém apenas se NÃO estiver sincronizado ainda
          });
      });

      if (!silent) setIsLoadingMessages(false);
  };

  const handleChatSelect = (chatId: string) => {
      // ✅ VALIDAÇÃO: Só abre se chatId for válido
      if (!chatId || typeof chatId !== 'string') {
          console.error('❌ ChatId inválido:', chatId);
          return;
      }
      
      setActiveChatId(chatId);
      setPendingMessages([]); // Limpa pendentes visuais ao trocar de chat
      setServerMessages([]); // Limpa histórico anterior
      if (activeAccount) {
          loadMessages(activeAccount, chatId);
      }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !activeAccount || !activeChatId) return;
    
    // Cria mensagem temporária
    const tempId = 'temp-' + Date.now();
    const tempMsg: ChatMessage = { 
        id: tempId, 
        text: inputValue, 
        sender: 'agent', 
        timestamp: new Date() 
    };
    
    // 1. Adiciona na fila visual imediatamente
    setPendingMessages(prev => [...prev, tempMsg]);
    const msgToSend = inputValue;
    setInputValue(''); 

    // 2. Envia para API
    const result = await apiService.sendMessage(activeAccount, activeChatId, msgToSend);
    
    // 3. Se a API retornou o ID real, atualiza a mensagem pendente com o ID real
    if (result.success && result.messageId) {
        setPendingMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: result.messageId! } : m));
    }

    // 4. Força refresh do histórico após 1s para tentar pegar a mensagem oficial
    setTimeout(() => loadMessages(activeAccount, activeChatId, true), 1000);
  };

  const activeChatData = chats.find(c => c.id === activeChatId);
  const displayMessages = [...serverMessages, ...pendingMessages].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (!activeAccount) {
      return (
          <div className="flex h-[calc(100vh-2rem)] bg-card border border-gray-700 rounded-2xl items-center justify-center text-gray-400">
              <p>Nenhuma conta WhatsApp conectada. Vá em Conexões.</p>
          </div>
      );
  }

  return (
    <div className="flex h-[calc(100vh-2rem)] bg-card border border-gray-700 rounded-2xl overflow-hidden">
      {/* Sidebar List */}
      <div className="w-80 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700 bg-gray-800/50">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input 
                    type="text" 
                    placeholder="Buscar conversa..." 
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 pl-10 pr-4 text-sm text-gray-300 focus:outline-none focus:border-primary"
                />
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
            {isLoadingChats && chats.length === 0 ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary"/></div>
            ) : (
                chats.map(chat => {
                    // ✅ VALIDAÇÃO EXTRA: Garante que chat.id existe antes de renderizar
                    if (!chat.id || typeof chat.id !== 'string') {
                        console.warn('⚠️ Chat sem ID válido, pulando renderização:', chat);
                        return null;
                    }
                    
                    return (
                        <div 
                            key={chat.id} 
                            onClick={() => handleChatSelect(chat.id)}
                            className={`p-4 flex items-center space-x-3 cursor-pointer hover:bg-gray-800 transition-colors border-b border-gray-800 ${activeChatId === chat.id ? 'bg-gray-800 border-l-4 border-l-primary' : ''}`}
                        >
                            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-gray-400 shrink-0">
                                <User size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-white font-medium truncate text-sm">{chat.contactName || 'Desconhecido'}</h4>
                                </div>
                                <p className="text-xs text-gray-500 truncate mt-1">
                                    {/* ✅ CORREÇÃO PRINCIPAL: Usa optional chaining e fallback */}
                                    {chat.id?.replace(/\D/g, '') || 'Sem número'}
                                </p>
                            </div>
                            {chat.unreadCount > 0 && (
                                <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                                    {chat.unreadCount}
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-[#0b141a]">
         {activeChatId && activeChatData ? (
             <>
                {/* Header */}
                <div className="h-16 bg-[#202c33] border-b border-gray-700 px-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-gray-300">
                            <User size={20} />
                        </div>
                        <div>
                            <h3 className="text-white font-medium">{activeChatData.contactName || 'Desconhecido'}</h3>
                            <span className="text-xs text-gray-400">{activeChatData.id || 'ID não disponível'}</span>
                        </div>
                    </div>
                    <button onClick={() => loadMessages(activeAccount, activeChatId)} className="text-gray-400 hover:text-white" title="Atualizar">
                        <RefreshCw size={20} className={isLoadingMessages ? "animate-spin" : ""} />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', opacity: 0.95 }}>
                    {isLoadingMessages && serverMessages.length === 0 && pendingMessages.length === 0 ? (
                        <div className="flex justify-center mt-10"><Loader2 className="animate-spin text-white"/></div>
                    ) : (
                        displayMessages.map((msg) => {
                            const isPending = String(msg.id).startsWith('temp-');
                            return (
                                <div key={msg.id} className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] rounded-lg px-4 py-2 shadow-md ${msg.sender === 'agent' ? 'bg-[#005c4b] text-white rounded-tr-none' : 'bg-[#202c33] text-white rounded-tl-none'}`}>
                                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                                        <div className="flex justify-end items-center mt-1 space-x-1">
                                            <span className="text-[10px] text-gray-400">
                                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                            {isPending && <Clock size={10} className="text-gray-400 animate-pulse" />}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} className="h-2" />
                </div>

                {/* Input */}
                <div className="bg-[#202c33] p-4 flex items-center space-x-3">
                    <button className="text-gray-400 hover:text-gray-300">
                        <Paperclip size={22} />
                    </button>
                    <input 
                        type="text" 
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Digite uma mensagem..." 
                        className="flex-1 bg-[#2a3942] rounded-lg py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-600"
                    />
                    <button 
                        onClick={handleSend}
                        className="p-2 bg-primary hover:bg-emerald-600 rounded-full text-white transition-colors"
                    >
                        <Send size={20} />
                    </button>
                </div>
             </>
         ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-[#222e35]">
                 <div className="w-32 h-32 bg-gray-700/30 rounded-full flex items-center justify-center mb-4">
                    <User size={64} className="opacity-50" />
                 </div>
                 <h3 className="text-xl font-medium text-gray-400">ZapMaster Web</h3>
                 <p className="text-sm mt-2 max-w-md text-center">Selecione uma conversa à esquerda para iniciar o atendimento.</p>
             </div>
         )}
      </div>
    </div>
  );
};

export default Chat;
