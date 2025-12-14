import { apiService } from './api';

/**
 * Serviço de Monitoramento Automático
 * Roda em background verificando mensagens para detectar pedidos de descadastro
 */
class AutoMonitoringService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private checkIntervalMinutes: number = 3; // Verificar a cada 3 minutos
  private lastCheck: Date | null = null;
  private totalBlocked: number = 0;
  private listeners: Array<(status: MonitoringStatus) => void> = [];

  /**
   * Inicia o monitoramento automático
   */
  start() {
    if (this.isRunning) {
      console.log('🤖 Monitoramento já está ativo');
      return;
    }

    console.log('🤖 Iniciando monitoramento automático de blacklist...');
    this.isRunning = true;
    this.notifyListeners();

    // Primeira verificação imediata
    this.checkBlacklist();

    // Agendar verificações periódicas
    this.intervalId = setInterval(() => {
      this.checkBlacklist();
    }, this.checkIntervalMinutes * 60 * 1000);
  }

  /**
   * Para o monitoramento automático
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🤖 Monitoramento automático parado');
    this.notifyListeners();
  }

  /**
   * Verifica blacklist (chamado automaticamente)
   */
  private async checkBlacklist() {
    try {
      console.log('🔍 [Robô] Verificando mensagens para descadastro...');
      
      const result = await apiService.autoCheckBlacklist();
      this.lastCheck = new Date();

      if (result.updated && result.blockedNames.length > 0) {
        this.totalBlocked += result.blockedNames.length;
        
        console.log(`🚫 [Robô] ${result.blockedNames.length} contato(s) bloqueado(s):`);
        result.blockedNames.forEach(name => console.log(`   - ${name}`));

        // Notificação do navegador (se permitido)
        this.sendNotification(
          'Contatos Bloqueados Automaticamente',
          `${result.blockedNames.length} contato(s) solicitou descadastro: ${result.blockedNames.join(', ')}`
        );
      } else {
        console.log('✅ [Robô] Nenhum pedido de descadastro detectado');
      }

      this.notifyListeners();
    } catch (error) {
      console.error('❌ [Robô] Erro ao verificar blacklist:', error);
    }
  }

  /**
   * Envia notificação do navegador
   */
  private sendNotification(title: string, body: string) {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.ico' });
          }
        });
      }
    }
  }

  /**
   * Retorna o status atual do monitoramento
   */
  getStatus(): MonitoringStatus {
    return {
      isRunning: this.isRunning,
      lastCheck: this.lastCheck,
      totalBlocked: this.totalBlocked,
      intervalMinutes: this.checkIntervalMinutes
    };
  }

  /**
   * Adiciona um listener para mudanças de status
   */
  addListener(callback: (status: MonitoringStatus) => void) {
    this.listeners.push(callback);
  }

  /**
   * Remove um listener
   */
  removeListener(callback: (status: MonitoringStatus) => void) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  /**
   * Notifica todos os listeners
   */
  private notifyListeners() {
    const status = this.getStatus();
    this.listeners.forEach(listener => listener(status));
  }

  /**
   * Altera o intervalo de verificação
   */
  setInterval(minutes: number) {
    this.checkIntervalMinutes = minutes;
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}

export interface MonitoringStatus {
  isRunning: boolean;
  lastCheck: Date | null;
  totalBlocked: number;
  intervalMinutes: number;
}

// Instância singleton
export const autoMonitoring = new AutoMonitoringService();
