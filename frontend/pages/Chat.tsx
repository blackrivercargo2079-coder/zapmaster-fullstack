import React, { useState, useEffect, useRef } from 'react';
import { Send, Search, User, Loader2, RefreshCw } from 'lucide-react';

interface ChatItem {
  phone: string;
  contactName: string;
  lastMessage: string;
  unreadCount: number;
  lastMessageAt: Date;
}

interface Message {
  _id: string;
  phone: string;
  text: string;
  sender: 'user' | 'agent' | 'system';
  fromMe: boolean;
  timestamp: Date;
}

const API_URL = import.meta.env.VITE_API_URL || 'https://zapmaster-backend.vercel.app';

const Chat: React.FC = () => {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carrega chats do backend
  const loadChats = async (silent = false) => {
    try {
      if (!silent) setIsLoadingChats(true);
      const response = await fetch(`${API_URL}/api/chats`);
      const data = await response.json();
      console.log('📋 Chats carregados do webhook:', data.length);
      setChats(data);
      if (!silent) setIsLoadingChats(false);
    } catch (error) {
      console.error('❌ Erro ao carregar chats:', error);
      if (!silent) setIsLoadingChats(false);
    }
  };

  // Carrega mensagens de um chat específico
  const loadMessages = async (phone: string, silent = false) => {
    try {
      if (!silent) setIsLoadingMessages(true);
      const response = await fetch(`${API_URL}/api/messages/${phone}`);
      const data = await response.json();
      console.log('💬 Mensagens carregadas:', data.length);
      setMessages(data.reverse()); // Inverte para ordem cronológica
      if (!silent) setIsLoadingMessages(false);
    } catch (error) {
      console.error('❌ Erro ao carregar mensagens:', error);
      if (!silent) setIsLoadingMessages(false);
    }
  };

  // Carrega chats inicial
  useEffect(() => {
    loadChats();
  }, []);

  // Polling - atualiza chats e mensagens automaticamente
  useEffect(() => {
    const interval = setInterval(() => {
      loadChats(true); // Atualiza lista silenciosamente
      if (activePhone) {
        loadMessages(activePhone, true); // Atualiza mensagens silenciosamente
      }
    }, 3000); // A cada 3 segundos

    return () => clearInterval(interval);
  }, [activePhone]);

  // Scroll automático para última mensagem
  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [messages]);

  // Seleciona um chat
  const handleChatSelect = (phone: string) => {
    setActivePhone(phone);
    setMessages([]);
    loadMessages(phone);
  };

  // Envia mensagem (simulado - precisa configurar Z-API)
  const handleSend = async () => {
    if (!inputValue.trim() || !activePhone) return;

    const tempMessage: Message = {
      _id: 'temp-' + Date.now(),
      phone: activePhone,
      text: inputValue,
      sender: 'agent',
      fromMe: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, tempMessage]);
    const messageText = inputValue;
    setInputValue('');

    try {
      // TODO: Integrar com Z-API para envio real
      console.log('📤 Enviando via Z-API:', messageText, 'para:', activePhone);
      
      // Simula envio bem-sucedido
      setTimeout(() => {
        loadMessages(activePhone, true);
      }, 1000);
    } catch (error) {
      console.error('❌ Erro ao enviar:', error);
    }
  };

  // Filtra chats pela busca
  const filteredChats = chats.filter(chat =>
    chat.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.phone.includes(searchTerm)
  );

  const activeChatData = chats.find(c => c.phone === activePhone);

  return (
    <div className="flex h-screen bg-[#0a0e27]">
      {/* Sidebar - Lista de Chats */}
      <div className="w-96 bg-[#111827] border-r border-gray-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Conversas</h2>
            <button
              onClick={() => loadChats()}
              className="text-gray-400 hover:text-white transition-colors"
              title="Atualizar"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
          
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar contato..."
              className="w-full pl-10 pr-4 py-2 bg-[#1f2937] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Lista de Chats */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingChats && chats.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <User className="w-12 h-12 mb-2" />
              <p>Nenhuma conversa ainda</p>
              <p className="text-sm">Aguardando mensagens via webhook</p>
            </div>
          ) : (
            filteredChats.map(chat => (
              <div
                key={chat.phone}
                onClick={() => handleChatSelect(chat.phone)}
                className={`p-4 flex items-start space-x-3 cursor-pointer hover:bg-gray-800 transition-colors border-b border-gray-800 ${
                  activePhone === chat.phone ? 'bg-gray-800 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-white" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-white truncate">
                      {chat.contactName || chat.phone}
                    </h3>
                    {chat.unreadCount > 0 && (
                      <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full flex-shrink-0">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 truncate">{chat.phone}</p>
                  <p className="text-sm text-gray-500 truncate">{chat.lastMessage}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Área de Chat */}
      <div className="flex-1 flex flex-col">
        {activePhone && activeChatData ? (
          <>
            {/* Header do Chat */}
            <div className="bg-[#1f2937] p-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">
                    {activeChatData.contactName || 'Desconhecido'}
                  </h3>
                  <p className="text-sm text-gray-400">{activePhone}</p>
                </div>
              </div>
              
              <button
                onClick={() => loadMessages(activePhone)}
                className="text-gray-400 hover:text-white transition-colors"
                title="Atualizar mensagens"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0e27]">
              {isLoadingMessages && messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg._id}
                    className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        msg.fromMe
                          ? 'bg-blue-600 text-white'
                          : 'bg-[#1f2937] text-white'
                      }`}
                    >
                      <p className="break-words">{msg.text}</p>
                      <span className="text-xs opacity-70 mt-1 block">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de Mensagem */}
            <div className="bg-[#1f2937] p-4 border-t border-gray-800">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 bg-[#0a0e27] rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-lg transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <User className="w-20 h-20 mb-4 opacity-50" />
            <h2 className="text-2xl font-bold mb-2">ZapMaster Web</h2>
            <p>Selecione uma conversa à esquerda para iniciar o atendimento.</p>
            <p className="text-sm mt-2">Aguardando mensagens via Z-API webhook</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
