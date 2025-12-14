import { Account, SystemSettings, Contact, ContactStatus, ChatSession, ChatMessage } from '../types';

// Backend API URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Storage keys (manter para compatibilidade com settings)
const STORAGE_KEY_SETTINGS = 'zapmaster_settings';

// --- HELPERS ---

export const getSettings = (): SystemSettings => {
  const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
  try {
    return saved ? JSON.parse(saved) : { apiUrl: '', apiToken: '' };
  } catch (e) {
    return { apiUrl: '', apiToken: '' };
  }
};

export const saveSettings = (settings: SystemSettings) => {
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
};

const cleanZApiUrl = (url: string): string => {
    if (!url) return '';
    let clean = url.trim();
    clean = clean.replace(/\/(send-text|send-image|send-document|send-audio|send-messages|send-sticker|status|qrcode|restart|disconnect|phone-exists|chats|messages)(\/?)$/i, '');
    if (clean.endsWith('/')) clean = clean.slice(0, -1);
    return clean;
};

const normalizePhone = (phone: string) => {
    if (!phone) return '';
    return phone.replace(/\D/g, '').replace(/^55/, '');
};

const ensureBrPrefix = (phone: string) => {
    let clean = phone.replace(/\D/g, '');
    if (clean.length >= 10 && clean.length <= 11) {
        return '55' + clean;
    }
    return clean;
};

// --- API SERVICE COM MONGODB ---

export const apiService = {
  
  // ============================================
  // CONTACTS - Agora usa MongoDB
  // ============================================
  
  async getContacts(filters?: { status?: ContactStatus; tag?: string; search?: string }): Promise<Contact[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.tag) params.append('tag', filters.tag);
      if (filters?.search) params.append('search', filters.search);
      
      const response = await fetch(`${API_BASE_URL}/api/contacts?${params.toString()}`);
      if (!response.ok) throw new Error('Erro ao buscar contatos');
      
      const contacts = await response.json();
      return contacts.map((c: any) => ({
        id: c._id,
        name: c.name,
        phone: c.phone,
        tags: c.tags || [],
        status: c.status,
        lastInteraction: c.lastInteraction ? new Date(c.lastInteraction) : undefined
      }));
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      return [];
    }
  },

  async createContact(contact: Omit<Contact, 'id'>): Promise<Contact | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contact)
      });
      
      if (!response.ok) throw new Error('Erro ao criar contato');
      
      const data = await response.json();
      return {
        id: data._id,
        name: data.name,
        phone: data.phone,
        tags: data.tags || [],
        status: data.status,
        lastInteraction: data.lastInteraction ? new Date(data.lastInteraction) : undefined
      };
    } catch (error) {
      console.error('Erro ao criar contato:', error);
      return null;
    }
  },

  async createContactsBulk(contacts: Omit<Contact, 'id'>[]): Promise<{ success: boolean; count: number }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts })
      });
      
      const data = await response.json();
      return { success: data.success, count: data.count || 0 };
    } catch (error) {
      console.error('Erro ao criar contatos em massa:', error);
      return { success: false, count: 0 };
    }
  },

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) throw new Error('Erro ao atualizar contato');
      
      const data = await response.json();
      return {
        id: data._id,
        name: data.name,
        phone: data.phone,
        tags: data.tags || [],
        status: data.status,
        lastInteraction: data.lastInteraction ? new Date(data.lastInteraction) : undefined
      };
    } catch (error) {
      console.error('Erro ao atualizar contato:', error);
      return null;
    }
  },

  async deleteContact(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts/${id}`, {
        method: 'DELETE'
      });
      
      return response.ok;
    } catch (error) {
      console.error('Erro ao deletar contato:', error);
      return false;
    }
  },

  // ============================================
  // ACCOUNTS - Agora usa MongoDB
  // ============================================

  async getAccounts(): Promise<Account[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/accounts`);
      if (!response.ok) throw new Error('Erro ao buscar contas');
      
      const accounts = await response.json();
      return accounts.map((a: any) => ({
        id: a._id,
        name: a.name,
        instanceName: a.instanceName,
        phoneNumber: a.phoneNumber,
        status: a.status,
        connectionType: a.connectionType,
        zApiUrl: a.zApiUrl,
        zApiClientToken: a.zApiClientToken,
        zApiId: a.zApiId,
        zApiToken: a.zApiToken,
        battery: a.battery,
        avatarUrl: a.avatarUrl,
        updatedAt: a.updatedAt ? new Date(a.updatedAt) : undefined
      }));
    } catch (error) {
      console.error('Erro ao buscar contas:', error);
      return [];
    }
  },

  async createAccount(account: Omit<Account, 'id'>): Promise<Account | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(account)
      });
      
      if (!response.ok) throw new Error('Erro ao criar conta');
      
      const data = await response.json();
      return {
        id: data._id,
        name: data.name,
        instanceName: data.instanceName,
        phoneNumber: data.phoneNumber,
        status: data.status,
        connectionType: data.connectionType,
        zApiUrl: data.zApiUrl,
        zApiClientToken: data.zApiClientToken,
        zApiId: data.zApiId,
        zApiToken: data.zApiToken,
        battery: data.battery,
        avatarUrl: data.avatarUrl,
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined
      };
    } catch (error) {
      console.error('Erro ao criar conta:', error);
      return null;
    }
  },

  async updateAccount(id: string, updates: Partial<Account>): Promise<Account | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) throw new Error('Erro ao atualizar conta');
      
      const data = await response.json();
      return {
        id: data._id,
        name: data.name,
        instanceName: data.instanceName,
        phoneNumber: data.phoneNumber,
        status: data.status,
        connectionType: data.connectionType,
        zApiUrl: data.zApiUrl,
        zApiClientToken: data.zApiClientToken,
        zApiId: data.zApiId,
        zApiToken: data.zApiToken,
        battery: data.battery,
        avatarUrl: data.avatarUrl,
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined
      };
    } catch (error) {
      console.error('Erro ao atualizar conta:', error);
      return null;
    }
  },

  async deleteAccount(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/accounts/${id}`, {
        method: 'DELETE'
      });
      
      return response.ok;
    } catch (error) {
      console.error('Erro ao deletar conta:', error);
      return false;
    }
  },

  // ============================================
  // MESSAGES & CHATS - Agora usa MongoDB
  // ============================================

  async getChatMessages(account: Account, chatId: string): Promise<ChatMessage[]> {
      try {
          const cleanPhone = normalizePhone(chatId);
          const response = await fetch(`${API_BASE_URL}/api/messages/${cleanPhone}`);
          
          if (!response.ok) return [];
          
          const messages = await response.json();
          return messages.map((m: any) => ({
              id: m.messageId,
              sender: m.sender,
              text: m.text,
              timestamp: new Date(m.timestamp)
          }));
      } catch (error) {
          console.error('Erro ao buscar mensagens:', error);
          return [];
      }
  },

  async getChats(account: Account): Promise<ChatSession[]> {
      try {
          const response = await fetch(`${API_BASE_URL}/api/chats`);
          
          if (!response.ok) return [];
          
          const chats = await response.json();
          return chats.map((c: any) => ({
              id: c.chatId,
              contactId: c.contactId,
              contactName: c.contactName,
              lastMessage: c.lastMessage,
              unreadCount: c.unreadCount,
              messages: []
          }));
      } catch (error) {
          console.error('Erro ao buscar chats:', error);
          return [];
      }
  },

  // ============================================
  // STATS
  // ============================================

  async getStats() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/stats`);
      if (!response.ok) throw new Error('Erro ao buscar estatísticas');
      
      return await response.json();
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return {
        totalContacts: 0,
        blockedContacts: 0,
        validContacts: 0,
        onlineAccounts: 0,
        totalMessages: 0,
        activeCampaigns: 0
      };
    }
  },

  // ============================================
  // Z-API METHODS (mantidos para compatibilidade)
  // ============================================

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
          return { success: false, error: 'Falha na conexão com Z-API' };
      } catch (error: any) {
          return { success: false, error: error.message };
      }
  },

  async sendMessage(
      account: Account, 
      phone: string, 
      message: string, 
      imageBase64?: string
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
      if (!account.zApiUrl) {
          return { success: false, error: "Z-API URL não configurada" };
      }

      const cleanPhone = ensureBrPrefix(normalizePhone(phone));
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
              const msgId = resData.messageId || resData.id || resData.zaapId || (resData.value ? resData.value.id : undefined);
              return { success: true, messageId: msgId };
          }
          return { success: false, error: resData.message || resData.error || "Erro Z-API" };
      } catch (e: any) {
          return { success: false, error: e.message };
      }
  },

  async autoCheckBlacklist(): Promise<{ updated: boolean; blockedNames: string[] }> {
      try {
          // Busca contas conectadas
          const accounts = await apiService.getAccounts();
          const connectedAccount = accounts.find(a => a.status === 'CONNECTED');
          
          if (!connectedAccount || !connectedAccount.zApiUrl) {
              return { updated: false, blockedNames: [] };
          }

          // Busca todos os contatos
          const contacts = await apiService.getContacts();
          let blockedNames: string[] = [];
          let hasUpdates = false;

          // Busca chats recentes
          const chats = await apiService.getChats(connectedAccount);
          
          for (const chat of chats.slice(0, 3)) {
              await new Promise(r => setTimeout(r, 100)); 

              const messages = await apiService.getChatMessages(connectedAccount, chat.id);
              const lastUserMsg = messages.filter(m => m.sender === 'user').pop();
              
              if (lastUserMsg) {
                  const text = lastUserMsg.text.toLowerCase().trim();
                  
                  if (['sair', 'pare', 'stop', 'cancelar', 'não quero'].some(w => text === w || text.startsWith(w))) {
                      const chatPhoneNorm = normalizePhone(chat.id);
                      const contactToBlock = contacts.find(c => normalizePhone(c.phone) === chatPhoneNorm);
                      
                      if (contactToBlock && contactToBlock.status !== ContactStatus.BLOCKED) {
                          // Atualiza para BLOCKED
                          await apiService.updateContact(contactToBlock.id, { 
                              status: ContactStatus.BLOCKED 
                          });
                          
                          blockedNames.push(contactToBlock.name);
                          hasUpdates = true;
                          
                          // Envia confirmação
                          await apiService.sendMessage(
                              connectedAccount, 
                              chat.id, 
                              "Você foi descadastrado com sucesso."
                          );
                      }
                  }
              }
          }

          return { updated: hasUpdates, blockedNames };
      } catch (error) {
          console.error('Erro no autoCheckBlacklist:', error);
          return { updated: false, blockedNames: [] };
      }
  }
};