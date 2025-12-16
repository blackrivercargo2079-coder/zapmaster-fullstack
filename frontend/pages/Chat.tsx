import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Forward, X, Check, Search } from 'lucide-react';

interface Message {
  _id: string;
  text: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  fromMe: boolean;
}

interface Chat {
  phone: string;
  contactName?: string;
  lastMessage: string;
  unreadCount: number;
  lastMessageAt: Date;
}

interface Contact {
  _id: string;
  name: string;
  phone: string;
}

export default function ChatPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Estados do modal de encaminhar
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [messageToForward, setMessageToForward] = useState<Message | null>(null);
  const [forwardSearchTerm, setForwardSearchTerm] = useState('');
  const [selectedForwardContacts, setSelectedForwardContacts] = useState<string[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const API_URL = 'https://zapmaster-backend.vercel.app/api';

  useEffect(() => {
    loadChats();
    loadAllContacts();
    const interval = setInterval(loadChats, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activePhone) {
      loadMessages(activePhone);
      const interval = setInterval(() => loadMessages(activePhone), 3000);
      return () => clearInterval(interval);
    }
  }, [activePhone]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChats = async () => {
    try {
      const response = await fetch(`${API_URL}/chats`);
      const data = await response.json();
      setChats(data);
    } catch (error) {
      console.error('Erro ao carregar chats:', error);
    }
  };

  const loadAllContacts = async () => {
    try {
      const response = await fetch(`${API_URL}/contacts`);
      const data = await response.json();
      setAllContacts(data);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
    }
  };

  const loadMessages = async (phone: string) => {
    try {
      const response = await fetch(`${API_URL}/messages/${phone}`);
      const data = await response.json();
      setMessages(data.reverse());
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activePhone) return;

    const tempMessage: Message = {
      _id: Date.now().toString(),
      text: messageInput,
      sender: 'agent',
      fromMe: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, tempMessage]);
    setMessageInput('');

    try {
      const response = await fetch(`${API_URL}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: activePhone,
          message: messageInput,
        }),
      });

      const data = await response.json();
      console.log('✅ Resposta do envio:', data);

      if (data.sentViaZapi) {
        console.log('✅ Mensagem enviada via Z-API!');
      }

      loadChats();
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
    }
  };

  // ============================================
  // FUNÇÃO: EXCLUIR MENSAGEM
  // ============================================
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Deseja realmente excluir esta mensagem?')) return;

    try {
      const response = await fetch(`${API_URL}/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessages(prev => prev.filter(msg => msg._id !== messageId));
        console.log('✅ Mensagem excluída');
      }
    } catch (error) {
      console.error('❌ Erro ao excluir mensagem:', error);
      alert('Erro ao excluir mensagem');
    }
  };

  // ============================================
  // FUNÇÃO: ABRIR MODAL DE ENCAMINHAR
  // ============================================
  const handleOpenForwardModal = (message: Message) => {
    setMessageToForward(message);
    setShowForwardModal(true);
    setSelectedForwardContacts([]);
    setForwardSearchTerm('');
  };

  // ============================================
  // FUNÇÃO: SELECIONAR/DESSELECIONAR CONTATO
  // ============================================
  const toggleSelectContact = (phone: string) => {
    setSelectedForwardContacts(prev =>
      prev.includes(phone)
        ? prev.filter(p => p !== phone)
        : [...prev, phone]
    );
  };

  // ============================================
  // FUNÇÃO: ENCAMINHAR MENSAGEM
  // ============================================
  const handleForwardMessage = async () => {
    if (selectedForwardContacts.length === 0 || !messageToForward) {
      alert('Selecione pelo menos um contato');
      return;
    }

    setLoading(true);

    try {
      const promises = selectedForwardContacts.map(phone =>
        fetch(`${API_URL}/send-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phone,
            message: `📩 Mensagem encaminhada:\n\n${messageToForward.text}`,
          }),
        })
      );

      await Promise.all(promises);

      alert(`✅ Mensagem encaminhada para ${selectedForwardContacts.length} contato(s)!`);
      setShowForwardModal(false);
      setMessageToForward(null);
      setSelectedForwardContacts([]);
    } catch (error) {
      console.error('❌ Erro ao encaminhar:', error);
      alert('Erro ao encaminhar mensagem');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // FUNÇÃO: EXCLUIR CONVERSA INTEIRA
  // ============================================
  const handleDeleteChat = async () => {
    if (!activePhone) return;
    
    if (!confirm(`Deseja realmente excluir toda a conversa com ${activePhone}?\n\nIsso irá apagar todas as mensagens.`)) {
      return;
    }

    setLoading(true);

    try {
      // Deletar todas as mensagens
      const response = await fetch(`${API_URL}/messages/${activePhone}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Deletar o chat
        await fetch(`${API_URL}/chats/${activePhone}`, {
          method: 'DELETE',
        });

        // Limpar mensagens da tela
        setMessages([]);
        
        // Atualizar lista de chats
        await loadChats();
        
        // Desselecionar conversa
        setActivePhone(null);

        alert('✅ Conversa excluída com sucesso!');
      }
    } catch (error) {
      console.error('❌ Erro ao excluir conversa:', error);
      alert('Erro ao excluir conversa');
    } finally {
      setLoading(false);
    }
  };

  const filteredForwardContacts = allContacts.filter(contact =>
    contact.name.toLowerCase().includes(forwardSearchTerm.toLowerCase()) ||
    contact.phone.includes(forwardSearchTerm)
  );

  return (
    <div className="h-screen flex bg-gray-800">
      {/* Lista de Chats */}
      <div className="w-80 bg-card border-r flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold text-white">Conversas</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-sm">Nenhuma conversa ainda</p>
              <p className="text-xs mt-2">Aguardando mensagens via webhook</p>
            </div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.phone}
                onClick={() => setActivePhone(chat.phone)}
                className={`p-4 border-b cursor-pointer hover:bg-gray-800 transition ${
                  activePhone === chat.phone ? 'bg-green-50 border-l-4 border-l-green-500' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-white">
                      {chat.contactName || chat.phone}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{chat.lastMessage}</p>
                  </div>
                  {chat.unreadCount > 0 && (
                    <span className="bg-green-500 text-white text-xs rounded-full px-2 py-1">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Área de Mensagens */}
      <div className="flex-1 flex flex-col">
        {activePhone ? (
          <>
            {/* Header com Botão de Excluir Conversa */}
            <div className="bg-card border-b p-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">{activePhone}</h3>
              </div>
              
              {/* Botão Excluir Conversa */}
              <button
                onClick={handleDeleteChat}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                title="Excluir conversa"
              >
                <Trash2 size={18} />
                <span className="text-sm font-medium">Excluir conversa</span>
              </button>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-800">
              {messages.map((msg) => (
                <div
                  key={msg._id}
                  className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'} group`}
                >
                  <div className="flex items-end gap-2">
                    {/* Botões de ação (aparecem no hover) */}
                    {msg.fromMe && (
                      <div className="opacity-0 group-hover:opacity-100 transition flex gap-1 mb-1">
                        <button
                          onClick={() => handleOpenForwardModal(msg)}
                          className="p-1.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition"
                          title="Encaminhar"
                        >
                          <Forward size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteMessage(msg._id)}
                          className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}

                    <div
                      className={`max-w-md px-4 py-2 rounded-2xl ${
                        msg.fromMe
                          ? 'bg-green-500 text-white rounded-br-none'
                          : 'bg-card text-white rounded-bl-none shadow'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                      <p
                        className={`text-xs mt-1 ${
                          msg.fromMe ? 'text-green-100' : 'text-gray-400'
                        }`}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de Mensagem */}
            <form onSubmit={handleSendMessage} className="bg-card border-t p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim()}
                  className="bg-green-500 text-white p-3 rounded-full hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <Send size={20} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-lg">Selecione uma conversa à esquerda para iniciar o atendimento.</p>
              <p className="text-sm mt-2">Aguardando mensagens via Z-API webhook</p>
            </div>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* MODAL DE ENCAMINHAR MENSAGEM */}
      {/* ============================================ */}
      {showForwardModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Encaminhar mensagem</h3>
              <button
                onClick={() => setShowForwardModal(false)}
                className="text-gray-400 hover:text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 bg-gray-800 border-b">
              <p className="text-sm text-gray-400 mb-1">Mensagem:</p>
              <p className="text-sm bg-card p-2 rounded border italic">
                "{messageToForward?.text}"
              </p>
            </div>

            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={forwardSearchTerm}
                  onChange={(e) => setForwardSearchTerm(e.target.value)}
                  placeholder="Buscar contato..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {filteredForwardContacts.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhum contato encontrado</p>
              ) : (
                filteredForwardContacts.map((contact) => (
                  <div
                    key={contact._id}
                    onClick={() => toggleSelectContact(contact.phone)}
                    className={`p-3 rounded-lg cursor-pointer transition mb-1 flex items-center justify-between ${
                      selectedForwardContacts.includes(contact.phone)
                        ? 'bg-green-100 border-2 border-green-500'
                        : 'bg-gray-800 hover:bg-gray-800'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-white">{contact.name}</p>
                      <p className="text-sm text-gray-500">{contact.phone}</p>
                    </div>
                    {selectedForwardContacts.includes(contact.phone) && (
                      <Check size={20} className="text-green-600" />
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t flex gap-2">
              <button
                onClick={() => setShowForwardModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-800 transition"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleForwardMessage}
                disabled={selectedForwardContacts.length === 0 || loading}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? 'Enviando...' : `Encaminhar (${selectedForwardContacts.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
