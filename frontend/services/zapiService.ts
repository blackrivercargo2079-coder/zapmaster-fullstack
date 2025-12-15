const API_URL = import.meta.env.VITE_API_URL || 'https://zapmaster-backend.vercel.app';

export const zapiService = {
  // Envia mensagem via backend (que usa Z-API)
  async sendMessage(phone: string, message: string) {
    try {
      const response = await fetch(`${API_URL}/api/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message })
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      return { success: false, error };
    }
  },

  // ✅ NOVA FUNÇÃO - Verifica WhatsApp de múltiplos contatos
  async checkWhatsApp(contacts: Array<{ id: string; phone: string }>) {
    try {
      console.log(`📱 Verificando ${contacts.length} contato(s)...`);
      
      const response = await fetch(`${API_URL}/api/contacts/check-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Resposta da verificação:', data);
      return data;
    } catch (error) {
      console.error('❌ Erro ao verificar WhatsApp:', error);
      return { success: false, error: error.message };
    }
  }
};