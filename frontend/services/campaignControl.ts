// Sistema de Controle e Limites ZapMaster Pro

export interface CampaignSettings {
  dailyLimit: number;
  pauseAfter: number; // Pausar após X mensagens
  pauseDuration: number; // Duração da pausa em minutos
  accountAge: 'NEW' | 'MEDIUM' | 'OLD'; // Idade da conta
  deliveryRate: number; // Taxa de entrega (%)
}

export interface CampaignStats {
  todaySent: number;
  todayFailed: number;
  deliveryRate: number;
  lastPause: Date | null;
  accountHealth: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'CRITICAL';
}

const STORAGE_KEY_SETTINGS = 'zapmaster_campaign_settings';
const STORAGE_KEY_STATS = 'zapmaster_campaign_stats';
const STORAGE_KEY_DAILY_COUNT = 'zapmaster_daily_count';

// Configurações padrão baseadas na idade da conta
export const DEFAULT_SETTINGS: Record<'NEW' | 'MEDIUM' | 'OLD', CampaignSettings> = {
  NEW: {
    dailyLimit: 100,
    pauseAfter: 30,
    pauseDuration: 15,
    accountAge: 'NEW',
    deliveryRate: 0
  },
  MEDIUM: {
    dailyLimit: 400,
    pauseAfter: 100,
    pauseDuration: 20,
    accountAge: 'MEDIUM',
    deliveryRate: 0
  },
  OLD: {
    dailyLimit: 800,
    pauseAfter: 150,
    pauseDuration: 25,
    accountAge: 'OLD',
    deliveryRate: 0
  }
};

export const ACCOUNT_AGE_INFO = {
  NEW: {
    label: 'Conta Nova',
    description: '0-30 dias ou pouco uso',
    recommendedMode: 'SLOW' as const,
    dailyLimit: 100,
    risk: 'ALTO'
  },
  MEDIUM: {
    label: 'Conta Média',
    description: '1-6 meses de uso regular',
    recommendedMode: 'MEDIUM' as const,
    dailyLimit: 400,
    risk: 'MÉDIO'
  },
  OLD: {
    label: 'Conta Antiga',
    description: '6+ meses de uso ativo',
    recommendedMode: 'MEDIUM' as const,
    dailyLimit: 800,
    risk: 'BAIXO'
  }
};

class CampaignControlService {
  // Carregar configurações
  loadSettings(): CampaignSettings {
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (saved) {
      return JSON.parse(saved);
    }
    // Padrão: Conta Média
    return DEFAULT_SETTINGS.MEDIUM;
  }

  // Salvar configurações
  saveSettings(settings: CampaignSettings) {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }

  // Carregar estatísticas do dia
  loadDailyStats(): CampaignStats {
    const saved = localStorage.getItem(STORAGE_KEY_STATS);
    const today = new Date().toDateString();

    if (saved) {
      const stats = JSON.parse(saved);
      // Se mudou o dia, resetar contadores
      if (stats.date !== today) {
        return this.resetDailyStats();
      }
      return {
        todaySent: stats.todaySent || 0,
        todayFailed: stats.todayFailed || 0,
        deliveryRate: this.calculateDeliveryRate(stats.todaySent, stats.todayFailed),
        lastPause: stats.lastPause ? new Date(stats.lastPause) : null,
        accountHealth: this.calculateHealth(stats.todaySent, stats.todayFailed)
      };
    }

    return this.resetDailyStats();
  }

  // Resetar estatísticas diárias
  private resetDailyStats(): CampaignStats {
    const stats = {
      date: new Date().toDateString(),
      todaySent: 0,
      todayFailed: 0,
      deliveryRate: 100,
      lastPause: null,
      accountHealth: 'EXCELLENT' as const
    };
    localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats));
    return stats;
  }

  // Salvar estatísticas
  saveDailyStats(stats: CampaignStats) {
    const toSave = {
      date: new Date().toDateString(),
      todaySent: stats.todaySent,
      todayFailed: stats.todayFailed,
      lastPause: stats.lastPause,
      deliveryRate: stats.deliveryRate,
      accountHealth: stats.accountHealth
    };
    localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(toSave));
  }

  // Incrementar contador de envios
  incrementSent() {
    const stats = this.loadDailyStats();
    stats.todaySent++;
    stats.deliveryRate = this.calculateDeliveryRate(stats.todaySent, stats.todayFailed);
    stats.accountHealth = this.calculateHealth(stats.todaySent, stats.todayFailed);
    this.saveDailyStats(stats);
    return stats;
  }

  // Incrementar contador de falhas
  incrementFailed() {
    const stats = this.loadDailyStats();
    stats.todayFailed++;
    stats.deliveryRate = this.calculateDeliveryRate(stats.todaySent, stats.todayFailed);
    stats.accountHealth = this.calculateHealth(stats.todaySent, stats.todayFailed);
    this.saveDailyStats(stats);
    return stats;
  }

  // Calcular taxa de entrega
  private calculateDeliveryRate(sent: number, failed: number): number {
    const total = sent + failed;
    if (total === 0) return 100;
    return Math.round((sent / total) * 100);
  }

  // CORRIGIDO: Calcular saúde da conta com mínimo de mensagens
  private calculateHealth(sent: number, failed: number): 'EXCELLENT' | 'GOOD' | 'WARNING' | 'CRITICAL' {
    const total = sent + failed;
    
    // IMPORTANTE: Só avaliar após mínimo de 10 mensagens para evitar falsos positivos
    if (total < 10) {
      return 'EXCELLENT'; // Período de aquecimento
    }

    const deliveryRate = this.calculateDeliveryRate(sent, failed);

    // Thresholds mais realistas e tolerantes
    if (deliveryRate >= 85) return 'EXCELLENT';  // 85%+ = Excelente (era 95%)
    if (deliveryRate >= 70) return 'GOOD';       // 70-84% = Bom (era 85%)
    if (deliveryRate >= 50) return 'WARNING';    // 50-69% = Atenção (era 70%)
    return 'CRITICAL';                            // <50% = Crítico
  }

  // Verificar se pode enviar (limite diário)
  canSend(): { allowed: boolean; reason?: string; remaining: number } {
    const settings = this.loadSettings();
    const stats = this.loadDailyStats();
    const total = stats.todaySent + stats.todayFailed;
    const remaining = settings.dailyLimit - total;

    if (total >= settings.dailyLimit) {
      return {
        allowed: false,
        reason: `Limite diário atingido (${settings.dailyLimit} mensagens)`,
        remaining: 0
      };
    }

    return {
      allowed: true,
      remaining
    };
  }

  // Verificar se precisa pausar
  shouldPause(messagesSinceLastPause: number): boolean {
    const settings = this.loadSettings();
    return messagesSinceLastPause >= settings.pauseAfter;
  }

  // Registrar pausa
  registerPause() {
    const stats = this.loadDailyStats();
    stats.lastPause = new Date();
    this.saveDailyStats(stats);
  }

  // Obter duração da pausa
  getPauseDuration(): number {
    const settings = this.loadSettings();
    return settings.pauseDuration * 60 * 1000; // Converter para ms
  }

  // Obter modo recomendado baseado na idade da conta
  getRecommendedMode(accountAge: 'NEW' | 'MEDIUM' | 'OLD'): 'SLOW' | 'MEDIUM' | 'FAST' {
    return ACCOUNT_AGE_INFO[accountAge].recommendedMode;
  }

  // CORRIGIDO: Obter status da conta com informações mais detalhadas
  getAccountStatus(): {
    health: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'CRITICAL';
    color: string;
    icon: string;
    message: string;
  } {
    const stats = this.loadDailyStats();
    const total = stats.todaySent + stats.todayFailed;

    // Durante período de aquecimento (menos de 10 mensagens)
    if (total < 10) {
      return {
        health: 'EXCELLENT',
        color: 'text-green-500',
        icon: '🟢',
        message: `Iniciando envios... (${total}/10)`
      };
    }

    switch (stats.accountHealth) {
      case 'EXCELLENT':
        return {
          health: 'EXCELLENT',
          color: 'text-green-500',
          icon: '🟢',
          message: 'Conta em perfeito estado'
        };
      case 'GOOD':
        return {
          health: 'GOOD',
          color: 'text-blue-500',
          icon: '🔵',
          message: 'Conta funcionando bem'
        };
      case 'WARNING':
        return {
          health: 'WARNING',
          color: 'text-yellow-500',
          icon: '🟡',
          message: 'Atenção: Taxa de entrega baixa'
        };
      case 'CRITICAL':
        return {
          health: 'CRITICAL',
          color: 'text-red-500',
          icon: '🔴',
          message: 'CRÍTICO: Pare os envios!'
        };
    }
  }
}

export const campaignControl = new CampaignControlService();
