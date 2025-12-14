import { Account, SystemSettings, Contact, ContactStatus, ChatSession, ChatMessage } from '../types';

const STORAGE_KEY = 'zapmaster_settings';
const STORAGE_KEY_ACCOUNTS = 'zapmaster_accounts';
const STORAGE_KEY_CONTACTS = 'zapmaster_contacts';

// --- HELPERS ---

export const getSettings = (): SystemSettings => {
  const saved = localStorage.getItem(STORAGE_KEY);
  try {
    return saved ? JSON.parse(saved) : { apiUrl: '', apiToken: '' };
  } catch (e) {
    return { apiUrl: '', apiToken: '' };
  }
};

export const saveSettings = (settings: SystemSettings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

const cleanZApiUrl = (url: string): string => {
    if (!url) return '';
    let clean = url.trim();
    clean = clean.replace(/\/(send-text|send-image|send-document|send-audio|send-messages|send-sticker|status|qrcode|restart|disconnect|phone-exists|chats|messages)(\/?)$/i, '');
    if (clean.endsWith('/')) clean = clean.slice(0, -1);
    return clean;
};

// --- PARSER ESPECÍFICO Z-API (BAILEYS) ---
const extractTextFromZApi = (msg: any): string => {
    if (!msg) return '';
    
    // 1. Tenta campos diretos (API simplificada)
    if (typeof msg.text === 'string' && msg.text) return msg.text;
    if (typeof msg.body === 'string' && msg.body) return msg.body;
    if (typeof msg.message === 'string' && msg.message) return msg.message;
    if (typeof msg.content === 'string' && msg.content) return msg.content;
    if (typeof msg.caption === 'string' && msg.caption) return msg.caption;

    // 2. Tenta estrutura Baileys (Objeto 'message')
    // A Z-API às vezes coloca a mensagem dentro de 'message', às vezes em 'content'
    const m = msg.message || msg.content || msg; 
    
    if (m.conversation) return m.conversation;
    if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
    if (m.imageMessage?.caption) return m.imageMessage.caption;
    if (m.videoMessage?.caption) return m.videoMessage.caption;
    if (m.documentMessage?.caption) return m.documentMessage.caption;
    if (m.buttonsResponseMessage?.selectedButtonId) return m.buttonsResponseMessage.selectedButtonId;
    if (m.listResponseMessage?.title) return m.listResponseMessage.title;
    if (m.templateButtonReplyMessage?.selectedId) return m.templateButtonReplyMessage.selectedId;

    // Tenta deep search se nada foi achado
    try {
        const jsonStr = JSON.stringify(m);
        // Fallback simples para encontrar texto se a estrutura for desconhecida
        if (jsonStr.includes('"text":"')) {
            const match = jsonStr.match(/"text":"([^"]+)"/);
            if (match && match[1]) return match[1];
        }
    } catch(e) {}

    return '';
};

const normalizePhone = (phone: string) => {
    if (!phone) return '';
    let clean = phone.replace(/\D/g, '').replace(/^55/, ''); // Remove 55 se existir para padronizar
    // Retorna sem 55 para comparações internas, mas com 55 para API
    return clean;
};

// Adiciona 55 se parecer ser um número BR sem DDI
const ensureBrPrefix = (phone: string) => {
    if (!phone) return '';
    let clean = phone.replace(/\D/g, '');
    if (clean.length >= 10 && clean.length <= 11) {
        return '55' + clean;
    }
    return clean;
};

const isProduction = () => {
  const { apiUrl } = getSettings();
  return !!apiUrl && apiUrl.trim().length > 0;
};

// --- WEBHOOK MODE (PRODUCTION SERVER) ---
// 🔥 CORRIGIDO: Usa variável de ambiente VITE_API_URL
const WEBHOOK_SERVER = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export const apiServiceWebhook = {
  async getChatsFromWebhook(): Promise<ChatSession[]> {
    try {
      const response = await fetch(`${WEBHOOK_SERVER}/api/chats`);
      if (response.ok) {
        const chats = await response.json();
        console.log('✅ Chats carregados do webhook:', chats.length);
        return chats;
      }
    } catch (e) {
      console.log('⚠️ Servidor webhook offline, usando modo normal');
    }
    return [];
  },

  async getMessagesFromWebhook(phone: string): Promise<ChatMessage[]> {
    // ✅ VALIDAÇÃO ROBUSTA
    if (!phone || typeof phone !== 'string') {
      console.warn('⚠️ Phone inválido fornecido ao webhook:', phone);
      return [];
    }
    
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) {
      console.warn('⚠️ Phone vazio após limpeza');
      return [];
    }
    
    try {
      const response = await fetch(`${WEBHOOK_SERVER}/api/messages/${cleanPhone}`);
      if (response.ok) {
        const messages = await response.json();
        console.log('✅ Mensagens carregadas do webhook:', messages.length);
        return messages;
      }
    } catch (e) {
      console.log('⚠️ Servidor webhook offline');
    }
    return [];
  }
};

// --- CORE API ---

export const apiService = {
  
  async testConnection(): Promise<{ success: boolean; message: string }> {
    const { apiUrl, apiToken } = getSettings();
    if (!apiUrl) return { success: false, message: "URL não configurada." };
    
    try {
      const response = await fetch(`${apiUrl}/instance/fetchInstances`, {
        method: 'GET',
        headers: { 'apikey': apiToken, 'Content-Type': 'application/json' }
      });
      if (response.ok) return { success: true, message: "Conexão OK!" };
      if (response.status === 401) return { success: false, message: "Erro 401: Chave API inválida." };
      return { success: false, message: `Erro ${response.status}` };
    } catch (error: any) {
      return { success: false, message: "Erro de Rede/CORS. Verifique HTTPS." };
    }
  },

  async createInstance(instanceName: string): Promise<any> {
    const { apiUrl, apiToken } = getSettings();
    if (!apiUrl) {
        await new Promise(r => setTimeout(r, 500));
        return { status: 'created', instance: { instanceName } };
    }
    try {
        const response = await fetch(`${apiUrl}/instance/create`, {
            method: 'POST',
            headers: { 'apikey': apiToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceName })
        });
        return await response.json();
    } catch (e) { throw new Error("Falha ao criar instância."); }
  },

  async connectInstance(instanceName: string): Promise<{ status?: string, base64?: string }> {
      const { apiUrl, apiToken } = getSettings();
      if (!apiUrl) {
           return { 
             base64: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=ZapMaster-Demo", 
             status: 'SCANNING' 
           };
      }
      try {
          const response = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
              method: 'GET',
              headers: { 'apikey': apiToken }
          });
          const data = await response.json();
          return { base64: data.base64 || data.qrcode, status: data.instance?.state || 'SCANNING' };
      } catch (e) { return { status: 'DISCONNECTED' }; }
  },

  async logoutInstance(instanceName: string): Promise<boolean> {
      const { apiUrl, apiToken } = getSettings();
      if (!apiUrl) return true;
      try {
          await fetch(`${apiUrl}/instance/logout/${instanceName}`, { 
              method: 'DELETE', headers: { 'apikey': apiToken } 
          });
          return true;
      } catch { return false; }
  },

  async validateZApiConnection(fullUrl: string, clientToken?: string): Promise<{ success: boolean, phone?: string, error?: string, cleanedUrl?: string }> {
      const cleanUrl = cleanZApiUrl(fullUrl);
      const headers: any = { 'Content-Type': 'application/json' };
      if (clientToken?.trim()) headers['Client-Token'] = clientToken.trim();

      try {
          const response = await fetch(`${cleanUrl}/status?_t=${Date.now()}`, { method: 'GET', headers });
          if (response.ok) {
              const data = await response.json();
              return { success: true, phone: data.phone || 'Z-API Vinculada', cleanedUrl: cleanUrl };
          }
          if (cleanUrl.includes('/instances/') && cleanUrl.includes('/token/')) {
              return { success: false, error: 'URL deve apontar para /status (não para /token). Ex: https://api.z-api.io/instances/SEU_ID', cleanedUrl: cleanUrl };
          }
          return { success: false, error: `Erro ${response.status}. Verifique a URL e o Token.`, cleanedUrl: cleanUrl };
      } catch (e: any) {
          return { success: false, error: e.message, cleanedUrl: cleanUrl };
      }
  },

  async sendMessage(account: Account, phone: string, message?: string, imageBase64?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
      if (!account || !account.zApiUrl) {
          console.warn('⚠️ Conta não configurada ou sem Z-API URL');
          return { success: true, messageId: 'demo-' + Date.now() };
      }
      
      if (!phone) {
          console.warn('⚠️ Telefone não fornecido');
          return { success: false, error: 'Telefone não fornecido' };
      }
      
      const cleanPhone = ensureBrPrefix(phone.replace(/\D/g, ''));
      
      const endpoint = imageBase64 
          ? `${account.zApiUrl}/send-image`
          : `${account.zApiUrl}/send-text`;

      const headers: any = { 'Content-Type': 'application/json' };
      if (account.zApiClientToken?.trim()) headers['Client-Token'] = account.zApiClientToken.trim();

      const body: any = { phone: cleanPhone };
      
      if (imageBase64) {
          body.image = imageBase64;
          body.caption = message || " "; 
      } else {
          body.message = message;
      }

      try {
          const response = await fetch(endpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify(body)
          });
          const resData = await response.json();
          
          if (response.ok) {
              // Tenta capturar o ID da mensagem retornada pela Z-API
              const msgId = resData.messageId || resData.id || resData.zaapId || (resData.value ? resData.value.id : undefined);
              return { success: true, messageId: msgId };
          }
          return { success: false, error: resData.message || resData.error || "Erro Z-API" };
      } catch (e: any) {
          return { success: false, error: e.message };
      }
  },

  // --- CHAT & BLACKLIST LOGIC ---

  async getChatMessages(account: Account, chatId: string): Promise<ChatMessage[]> {
      // ✅ VALIDAÇÃO NO INÍCIO - ANTES DE QUALQUER OPERAÇÃO
      if (!chatId || typeof chatId !== 'string') {
          console.error('❌ chatId inválido:', chatId);
          return [];
      }
      
      // 🆕 Tenta buscar do webhook primeiro
      const webhookMessages = await apiServiceWebhook.getMessagesFromWebhook(chatId);
      if (webhookMessages.length > 0) {
          console.log('✅ Mensagens carregadas do webhook:', webhookMessages.length);
          return webhookMessages;
      }
      
      // Fallback: Z-API (não funciona em multi-device)
      if (!account || !account.zApiUrl) {
          console.warn('⚠️ Conta não configurada ou sem Z-API URL');
          return [];
      }
      
      // GARANTIA: O ID para buscar mensagens DEVE ter o DDI 55 se for número BR
      let targetId = chatId.replace('@s.whatsapp.net', '').replace('@c.us', '');
      targetId = ensureBrPrefix(targetId);
      
      console.log('📥 Buscando mensagens para:', targetId);
      
      try {
          const headers: any = { 'Content-Type': 'application/json' };
          if (account.zApiClientToken?.trim()) headers['Client-Token'] = account.zApiClientToken.trim();
          
          const url = `${account.zApiUrl}/chats/${targetId}/messages?page=1&pageSize=50&_t=${Date.now()}`;
          console.log('🌐 URL:', url);
          
          const response = await fetch(url, {
              method: 'GET', headers
          });
          
          if (response.ok) {
              const data = await response.json();
              const msgs = Array.isArray(data) ? data : (data.messages || []);
              
              console.log('✅ Mensagens recebidas:', msgs.length);
              
              return msgs.map((m: any) => {
                  let text = extractTextFromZApi(m);
                  
                  // Detecção de Sender (Agente ou Usuário)
                  // Z-API pode enviar 'fromMe' como boolean ou string "true"
                  const isAgent = m.fromMe === true || m.fromMe === 'true';

                  return {
                      id: m.id || m.messageId || Math.random().toString(),
                      sender: isAgent ? 'agent' : 'user',
                      text: text.length > 0 ? text : '[Mídia/Arquivo]',
                      timestamp: new Date(m.timestamp || m.messageTimestamp * 1000 || Date.now())
                  };
              }).reverse(); // Mais antigas primeiro para o chat
          } else {
              console.error('❌ Erro HTTP:', response.status, response.statusText);
          }
      } catch (e) { 
          console.error('❌ Erro ao buscar mensagens:', e); 
      }
      return [];
  },

  async getChats(account: Account): Promise<ChatSession[]> {
      // 🆕 Tenta buscar do webhook primeiro
      const webhookChats = await apiServiceWebhook.getChatsFromWebhook();
      if (webhookChats.length > 0) {
        console.log('✅ Chats carregados do webhook:', webhookChats.length);
        return webhookChats;
      }
      
      // Fallback: Z-API (não funciona em multi-device)
      if (!account || !account.zApiUrl) {
          console.warn('⚠️ Conta não configurada ou sem Z-API URL');
          return [];
      }
      
      try {
          const headers: any = { 'Content-Type': 'application/json' };
          if (account.zApiClientToken?.trim()) headers['Client-Token'] = account.zApiClientToken.trim();
          
          const url = `${account.zApiUrl}/chats?page=1&pageSize=20&_t=${Date.now()}`;
          console.log('📋 Buscando chats:', url);
          
          const response = await fetch(url, {
              method: 'GET', headers
          });

          if (response.ok) {
              const data = await response.json();
              const items = Array.isArray(data) ? data : (data.chats || []);
              
              console.log('✅ Chats recebidos:', items.length);
              
              return items.map((chat: any) => ({
                  id: chat.phone || chat.id,
                  contactId: chat.phone || chat.id,
                  contactName: chat.name || chat.phone || 'Desconhecido',
                  lastMessage: '...', 
                  unreadCount: chat.unreadCount || 0,
                  messages: []
              }));
          } else {
              console.error('❌ Erro HTTP ao buscar chats:', response.status);
          }
      } catch (e) { 
          console.error('❌ Erro ao buscar chats:', e);
      }
      return [];
  },

  async autoCheckBlacklist(): Promise<{ updated: boolean; blockedNames: string[] }> {
      const savedAccounts = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
      if (!savedAccounts) return { updated: false, blockedNames: [] };
      
      const accounts: Account[] = JSON.parse(savedAccounts);
      const connectedAccount = accounts.find(a => a.status === 'CONNECTED');
      
      if (!connectedAccount || !connectedAccount.zApiUrl) return { updated: false, blockedNames: [] };

      const savedContacts = localStorage.getItem(STORAGE_KEY_CONTACTS);
      if (!savedContacts) return { updated: false, blockedNames: [] };
      const contacts: Contact[] = JSON.parse(savedContacts);

      let blockedNames: string[] = [];
      let hasUpdates = false;

      try {
          const chats = await apiService.getChats(connectedAccount);
          
          // Verifica os 3 últimos chats
          for (const chat of chats.slice(0, 3)) {
              // Delay mínimo para não travar
              await new Promise(r => setTimeout(r, 100)); 

              // ✅ Adiciona verificação de nulidade/indefinição para chat.id
              if (!chat.id || typeof chat.id !== 'string') {
                  console.warn('⚠️ Chat ID ausente ou inválido. Pulando verificação de blacklist para este chat.');
                  continue; 
              }
              
              const messages = await apiService.getChatMessages(connectedAccount, chat.id);
              // Pega a última mensagem DO USUÁRIO
              const lastUserMsg = messages.filter(m => m.sender === 'user').pop();
              
              if (lastUserMsg) {
                  const text = lastUserMsg.text.toLowerCase().trim();
                  // Lista de palavras-chave para descadastro
                  if (['sair', 'pare', 'stop', 'cancelar', 'não quero'].some(w => text === w || text.startsWith(w))) {
                      
                      // Normaliza telefones para comparação (remove 55, caracteres)
                      const chatPhoneNorm = normalizePhone(chat.id);
                      
                      const contactToBlock = contacts.find(c => normalizePhone(c.phone) === chatPhoneNorm);
                      
                      if (contactToBlock && contactToBlock.status !== ContactStatus.BLOCKED) {
                          contactToBlock.status = ContactStatus.BLOCKED;
                          blockedNames.push(contactToBlock.name);
                          hasUpdates = true;
                          
                          // Envia confirmação
                          await apiService.sendMessage(connectedAccount, chat.id, "Você foi descadastrado com sucesso.");
                      }
                  }
              }
          }
      } catch (e) {
          console.error('❌ Erro ao verificar blacklist:', e);
      }

      if (hasUpdates) {
          localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(contacts));
      }

      return { updated: hasUpdates, blockedNames };
  }
};
