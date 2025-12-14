import { GoogleGenAI } from "@google/genai";

// Vite usa import.meta.env em vez de process.env
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateCampaignContent = async (
  productName: string,
  audience: string,
  tone: string
): Promise<string> => {
  if (!apiKey || !ai) return "⚠️ Configure a API Key do Gemini nas variáveis de ambiente.";

  try {
    const prompt = `
      Crie uma mensagem de marketing para WhatsApp curta e persuasiva (máximo 500 caracteres).
      Produto/Serviço: ${productName}
      Público Alvo: ${audience}
      Tom de voz: ${tone}
      
      Inclua emojis relevantes. Não inclua hashtags.
      A mensagem deve incentivar o clique em um botão de ação.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Não foi possível gerar o conteúdo.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Erro ao gerar sugestão. Verifique sua conexão ou chave API.";
  }
};

export const checkMessageSentiment = async (message: string): Promise<string> => {
  if (!apiKey || !ai) return "Neutro";
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analise o sentimento da seguinte mensagem de um cliente e responda APENAS com uma das palavras: Positivo, Negativo, ou Neutro. Mensagem: "${message}"`
    });
    return response.text?.trim() || "Neutro";
  } catch (e) {
    return "Neutro";
  }
}