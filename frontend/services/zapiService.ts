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
  }
};
