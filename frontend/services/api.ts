import { Account, SystemSettings, Contact, ContactStatus, ChatSession, ChatMessage } from '../types';

const STORAGE_KEY = 'zapmaster_settings';
const STORAGE_KEY_ACCOUNTS = 'zapmaster_accounts';
const STORAGE_KEY_CONTACTS = 'zapmaster_contacts';

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

const extractTextFromZApi = (msg: any): string => {
  if (!msg) return '';
  if (typeof msg.text === 'string' && msg.text) return msg.text;
  if (typeof msg.body === 'string' && msg.body) return msg.body;
  if (typeof msg.message === 'string' && msg.message) return msg.message;
  if (typeof msg.content === 'string' && msg.content) return msg.content;
  if (typeof msg.caption === 'string' && msg.caption) return msg.caption;

  const m = msg.message || msg.content || msg;
  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  if (m.imageMessage?.caption) return m.imageMessage.caption;
  if (m.videoMessage?.caption) return m.videoMessage.caption;
  if (m.documentMessage?.caption) return m.documentMessage.caption;
  if (m.buttonsResponseMessage?.selectedButtonId) return m.buttonsResponseMessage.selectedButtonId;
  if (m.listResponseMessage?.title) return m.listResponseMessage.title;
  if (m.templateButtonReplyMessage?.selectedId) return m.templateButtonReplyMessage.selectedId;

  try {
    const jsonStr = JSON.stringify(m);
    if (jsonStr.includes('"text":"')) {
      const match = jsonStr.match(/"text":"([^"]+)"/);
      if (match && match[1]) return match[1];
    }
  } catch(e) {}

  return '';
};

const normalizePhone = (phone: string) => {
  if (!phone) return '';
  let clean = phone.replace(/\D/g, '').replace(/^55/, '');
  return clean;
};

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

const WEBHOOK_SERVER = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export const apiServiceWebhook = {
  async getChatsFromWebhook(): Promise<ChatSession[]> {
    try {
      const response = await fetch(`${WEBHOOK_SERVER}/api/chats`);
      if (response.ok) {
        const chats = await response.json();
        console.log('Chats carregados do webhook:', chats.length);
        return chats;
      }
    } catch (e) {
      console.log('Servidor webhook offline');
    }
    return [];
  },

  async getMessagesFromWebhook(phone: string): Promise<ChatMessage[]> {
    if (!phone || typeof phone !== 'string') {
      console.warn('Phone inválido:', phone);
      return [];
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) {
      console.warn('Phone vazio após limpeza');
      return [];
    }

    try {
      const response = await fetch(`${WEBHOOK_SERVER}/api/messages/${cleanPhone}`);
      if (response.ok) {
        const messages = await response.json();
        console.log('Mensagens carregadas:', messages.length);
        return messages;
      }
    } catch (e) {
      console.log('Servidor webhook offline');
    }

    return [];
  }
};

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
      return { success: false, message: "Erro de Rede/CORS." };
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
        return { success: false, error: 'URL deve apontar para /status', cleanedUrl: cleanUrl };
      }

      return { success: false, error: `Erro ${response.status}`, cleanedUrl: cleanUrl };
    } catch (e: any) {
      return { success: false, error: e.message, cleanedUrl: cleanUrl };
    }
  },

  async sendMessage(account: Account, phone: string, message?: string, imageBase64?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!phone) {
      return { success: false, error: 'Telefone não fornecido' };
    }

    const cleanPhone = ensureBrPrefix(phone.replace(/\D/g, ''));

    try {
      const response = await fetch(`${WEBHOOK_SERVER}/api/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          message: message || ''
        })
      });

      const resData = await response.json();

      if (response.ok && resData.success) {
        return {
          success: true,
          messageId: resData.messageId
        };
      }

      return {
        success: false,
        error: resData.error || 'Erro ao enviar'
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  async getChatMessages(account: Account, chatId: string): Promise<ChatMessage[]> {
    if (!chatId || typeof chatId !== 'string') {
      return [];
    }

    const webhookMessages = await apiServiceWebhook.getMessagesFromWebhook(chatId);
    if (webhookMessages.length > 0) {
      return webhookMessages;
    }

    if (!account || !account.zApiUrl) {
      return [];
    }

    let targetId = chatId.replace('@s.whatsapp.net', '').replace('@c.us', '');
    targetId = ensureBrPrefix(targetId);

    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (account.zApiClientToken?.trim()) headers['Client-Token'] = account.zApiClientToken.trim();

      const url = `${account.zApiUrl}/chats/${targetId}/messages?page=1&pageSize=50&_t=${Date.now()}`;
      const response = await fetch(url, { method: 'GET', headers });

      if (response.ok) {
        const data = await response.json();
        const msgs = Array.isArray(data) ? data : (data.messages || []);

        return msgs.map((m: any) => {
          let text = extractTextFromZApi(m);
          const isAgent = m.fromMe === true || m.fromMe === 'true';

          return {
            id: m.id || m.messageId || Math.random().toString(),
            sender: isAgent ? 'agent' : 'user',
            text: text.length > 0 ? text : '[Mídia/Arquivo]',
            timestamp: new Date(m.timestamp || m.messageTimestamp * 1000 || Date.now())
          };
        }).reverse();
      }
    } catch (e) {
      console.error('Erro ao buscar mensagens:', e);
    }

    return [];
  },

  async getChats(account: Account): Promise<ChatSession[]> {
    const webhookChats = await apiServiceWebhook.getChatsFromWebhook();
    if (webhookChats.length > 0) {
      return webhookChats;
    }

    if (!account || !account.zApiUrl) {
      return [];
    }

    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (account.zApiClientToken?.trim()) headers['Client-Token'] = account.zApiClientToken.trim();

      const url = `${account.zApiUrl}/chats?page=1&pageSize=20&_t=${Date.now()}`;
      const response = await fetch(url, { method: 'GET', headers });

      if (response.ok) {
        const data = await response.json();
        const items = Array.isArray(data) ? data : (data.chats || []);

        return items.map((chat: any) => ({
          id: chat.phone || chat.id,
          contactId: chat.phone || chat.id,
          contactName: chat.name || chat.phone || 'Desconhecido',
          lastMessage: '...',
          unreadCount: chat.unreadCount || 0,
          messages: []
        }));
      }
    } catch (e) {
      console.error('Erro ao buscar chats:', e);
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

      for (const chat of chats.slice(0, 3)) {
        await new Promise(r => setTimeout(r, 100));

        if (!chat.id || typeof chat.id !== 'string') {
          continue;
        }

        const messages = await apiService.getChatMessages(connectedAccount, chat.id);
        const lastUserMsg = messages.filter(m => m.sender === 'user').pop();

        if (lastUserMsg) {
          const text = lastUserMsg.text.toLowerCase().trim();

          if (['sair', 'pare', 'stop', 'cancelar', 'não quero'].some(w => text === w || text.startsWith(w))) {
            const chatPhoneNorm = normalizePhone(chat.id);
            const contactToBlock = contacts.find(c => normalizePhone(c.phone) === chatPhoneNorm);

            if (contactToBlock && contactToBlock.status !== ContactStatus.BLOCKED) {
              contactToBlock.status = ContactStatus.BLOCKED;
              blockedNames.push(contactToBlock.name);
              hasUpdates = true;
              await apiService.sendMessage(connectedAccount, chat.id, "Você foi descadastrado com sucesso.");
            }
          }
        }
      }
    } catch (e) {
      console.error('Erro ao verificar blacklist:', e);
    }

    if (hasUpdates) {
      localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(contacts));
    }

    return { updated: hasUpdates, blockedNames };
  }
};
