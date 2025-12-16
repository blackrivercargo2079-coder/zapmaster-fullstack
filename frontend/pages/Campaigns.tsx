import React, { useState, useEffect } from 'react';
import { Wand2, Image as ImageIcon, X, Play, Clock, ShieldCheck, Link, Users, Loader2, CheckCircle2, AlertTriangle, Monitor, Smartphone, ShieldBan, Pause, Activity } from 'lucide-react';
import { generateCampaignContent } from '../services/geminiService';
import { apiService } from '../services/api';
import { Contact, Account, ContactStatus } from '../types';
import { campaignControl, CampaignSettings, CampaignStats, ACCOUNT_AGE_INFO } from '../services/campaignControl';

const STORAGE_KEY_CONTACTS = 'zapmaster_contacts';
const STORAGE_KEY_ACCOUNTS = 'zapmaster_accounts';

const Campaigns: React.FC = () => {
  const [banners, setBanners] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [message, setMessage] = useState('');
  const [unsubscribe, setUnsubscribe] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Segmentation
  const [availableSegments, setAvailableSegments] = useState<string[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<string>('');
  const [contactsCount, setContactsCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);

  // Campaign Status
  const [campaignStatus, setCampaignStatus] = useState<'IDLE' | 'SENDING' | 'PAUSED' | 'COMPLETED'>('IDLE');
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [currentContactName, setCurrentContactName] = useState('');
  const [delayMode, setDelayMode] = useState<'SLOW' | 'MEDIUM' | 'FAST'>('MEDIUM');

  // Sistema de Controle e Limites
  const [settings, setSettings] = useState<CampaignSettings>(campaignControl.loadSettings());
  const [stats, setStats] = useState<CampaignStats>(campaignControl.loadDailyStats());
  const [messagesSinceLastPause, setMessagesSinceLastPause] = useState(0);
  const [isPausing, setIsPausing] = useState(false);
  const [pauseTimeRemaining, setPauseTimeRemaining] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  // Error state for campaign interruption
  const [criticalError, setCriticalError] = useState<string | null>(null);

  // Form states
  const [productName, setProductName] = useState('');
  const [audience, setAudience] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [ctaLink, setCtaLink] = useState('');

  // Image Upload Loading State
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // ✅ CORRIGIDO: Buscar segmentos (tags) do MongoDB via API
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
        const response = await fetch(`${apiUrl}/api/contacts`);
        
        if (response.ok) {
          const contacts: Contact[] = await response.json();
          
          // Extrair tags únicas
          const tags = new Set<string>();
          contacts.forEach(c => {
            if (c.tags && Array.isArray(c.tags)) {
              c.tags.forEach(t => {
                if (t && typeof t === 'string' && t.trim().length > 0) {
                  tags.add(t);
                }
              });
            }
          });
          
          const tagArray = Array.from(tags);
          setAvailableSegments(tagArray);
          
          if (tagArray.length > 0) {
            setSelectedSegment(tagArray[0]);
          }
        } else {
          // Fallback para localStorage se API falhar
          console.log('API falhou, usando localStorage como fallback');
          const saved = localStorage.getItem(STORAGE_KEY_CONTACTS);
          if (saved) {
            const contacts: Contact[] = JSON.parse(saved);
            const tags = new Set<string>();
            contacts.forEach(c => {
              if (c.tags) c.tags.forEach(t => tags.add(t));
            });
            const tagArray = Array.from(tags);
            setAvailableSegments(tagArray);
            if (tagArray.length > 0) setSelectedSegment(tagArray[0]);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar contatos do MongoDB:', error);
        
        // Fallback para localStorage
        const saved = localStorage.getItem(STORAGE_KEY_CONTACTS);
        if (saved) {
          const contacts: Contact[] = JSON.parse(saved);
          const tags = new Set<string>();
          contacts.forEach(c => {
            if (c.tags) c.tags.forEach(t => tags.add(t));
          });
          const tagArray = Array.from(tags);
          setAvailableSegments(tagArray);
          if (tagArray.length > 0) setSelectedSegment(tagArray[0]);
        }
      }
    };

    fetchContacts();
  }, []);

  // ✅ CORRIGIDO: Contar contatos ativos e bloqueados do segmento selecionado
  useEffect(() => {
    const fetchSegmentCounts = async () => {
      if (!selectedSegment) return;

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
        const response = await fetch(`${apiUrl}/api/contacts`);
        
        if (response.ok) {
          const contacts: Contact[] = await response.json();
          
          // Filtrar por tag selecionada
          const segmentContacts = contacts.filter(c => 
            c.tags && c.tags.includes(selectedSegment)
          );
          
          const active = segmentContacts.filter(c => 
            c.status !== ContactStatus.BLOCKED
          ).length;
          
          const blocked = segmentContacts.filter(c => 
            c.status === ContactStatus.BLOCKED
          ).length;
          
          setContactsCount(active);
          setBlockedCount(blocked);
        } else {
          // Fallback localStorage
          const saved = localStorage.getItem(STORAGE_KEY_CONTACTS);
          if (saved) {
            const contacts: Contact[] = JSON.parse(saved);
            const segmentContacts = contacts.filter(c => c.tags?.includes(selectedSegment));
            const active = segmentContacts.filter(c => c.status !== ContactStatus.BLOCKED).length;
            const blocked = segmentContacts.filter(c => c.status === ContactStatus.BLOCKED).length;
            setContactsCount(active);
            setBlockedCount(blocked);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar contatos:', error);
        
        // Fallback localStorage
        const saved = localStorage.getItem(STORAGE_KEY_CONTACTS);
        if (saved) {
          const contacts: Contact[] = JSON.parse(saved);
          const segmentContacts = contacts.filter(c => c.tags?.includes(selectedSegment));
          const active = segmentContacts.filter(c => c.status !== ContactStatus.BLOCKED).length;
          const blocked = segmentContacts.filter(c => c.status === ContactStatus.BLOCKED).length;
          setContactsCount(active);
          setBlockedCount(blocked);
        }
      }
    };

    fetchSegmentCounts();
  }, [selectedSegment]);

  // ✅ Função para comprimir imagem (mantém prefixo para preview)
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = (MAX_WIDTH / width) * height;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = (MAX_HEIGHT / height) * width;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // ✅ MANTÉM o prefixo para funcionar no preview
          let base64 = canvas.toDataURL('image/jpeg', 0.5);
          
          console.log('📷 Imagem comprimida:', {
            originalSize: file.size,
            compressedSize: base64.length,
            reduction: Math.round((1 - base64.length / file.size) * 100) + '%'
          });
          
          // ✅ Retorna COM prefixo (para preview funcionar)
          resolve(base64);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (banners.length >= 4) {
        alert('Máximo de 4 banners permitido.');
        return;
      }
      setIsProcessingImage(true);
      try {
        const compressedBase64 = await compressImage(e.target.files[0]);
        setBanners([...banners, compressedBase64]);
      } catch (error) {
        console.error('Erro ao processar imagem:', error);
        alert('Erro ao processar imagem. Tente uma imagem menor.');
      }
      setIsProcessingImage(false);
    }
  };

  const removeBanner = (index: number) => {
    setBanners(banners.filter((_, i) => i !== index));
  };

  const handleGenerateAI = async () => {
    if (!productName || !audience) {
      alert('Preencha o Produto e Público Alvo para gerar com IA.');
      return;
    }
    setIsGenerating(true);
    const content = await generateCampaignContent(productName, audience, 'Persuasivo e Urgente');
    setMessage(content);
    setIsGenerating(false);
  };

  const getDelay = () => {
    switch (delayMode) {
      case 'FAST': return Math.floor(Math.random() * (8000 - 3000) + 3000);
      case 'MEDIUM': return Math.floor(Math.random() * (20000 - 10000) + 10000);
      case 'SLOW': return Math.floor(Math.random() * (45000 - 25000) + 25000);
      default: return 10000;
    }
  };

  const handleStartCampaign = async () => {
    console.log('--- Iniciando Disparo: CTA -> Imagens -> Descadastre ---');
    setCriticalError(null);

    const canSendCheck = campaignControl.canSend();
    if (!canSendCheck.allowed) {
      alert(`${canSendCheck.reason} Tente novamente amanhã ou aumente o limite em Configurações.`);
      return;
    }

    if (!message && banners.length === 0 && !ctaText) {
      alert('A campanha deve ter uma mensagem, CTA ou banners.');
      return;
    }

    if (!selectedSegment) {
      alert('Selecione um segmento.');
      return;
    }

    const savedAccounts = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
    const accounts: Account[] = savedAccounts ? JSON.parse(savedAccounts) : [];
    const connectedAccount = accounts.find(a => a.status === 'CONNECTED');

    if (!connectedAccount) {
      alert('ERRO: Nenhuma conta WhatsApp conectada! Vá em Conexões e conecte uma conta.');
      return;
    }

    console.log('Conta usada:', connectedAccount.name, connectedAccount.zApiUrl ? 'Z-API' : 'Evolution');

    // Buscar contatos do MongoDB
    let targetContacts: Contact[] = [];
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/api/contacts`);
      
      if (response.ok) {
        const allContacts: Contact[] = await response.json();
        targetContacts = allContacts.filter(c => 
          c.tags?.includes(selectedSegment) && c.status !== ContactStatus.BLOCKED
        );
      } else {
        // Fallback localStorage
        const savedContacts = localStorage.getItem(STORAGE_KEY_CONTACTS);
        const allContacts: Contact[] = savedContacts ? JSON.parse(savedContacts) : [];
        targetContacts = allContacts.filter(c => 
          c.tags?.includes(selectedSegment) && c.status !== ContactStatus.BLOCKED
        );
      }
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      
      // Fallback localStorage
      const savedContacts = localStorage.getItem(STORAGE_KEY_CONTACTS);
      const allContacts: Contact[] = savedContacts ? JSON.parse(savedContacts) : [];
      targetContacts = allContacts.filter(c => 
        c.tags?.includes(selectedSegment) && c.status !== ContactStatus.BLOCKED
      );
    }

    if (targetContacts.length === 0) {
      alert('Nenhum contato disponível neste segmento.');
      return;
    }

    setCampaignStatus('SENDING');
    setProgress({ sent: 0, failed: 0, total: targetContacts.length });

    const delayBetweenSteps = 1500; // 1.5s entre etapas (CTA, Imagem, Descadastro)

    for (let i = 0; i < targetContacts.length; i++) {
      const contact = targetContacts[i];
      setCurrentContactName(contact.name);

      let contactSuccess = true;
      let contactError: string | null = null;
      
      // 1. CONSTRUÇÃO DA MENSAGEM DO TOPO (Texto Principal + CTA)
      let topMessage = message || '';
      if (ctaText && ctaLink) {
          // Adiciona o CTA logo após a mensagem principal (topo)
          topMessage += `\n\n${ctaText}: ${ctaLink}`;
      }

      // 2. CONSTRUÇÃO DA MENSAGEM DO FOOTER (Descadastro)
      const footerMessage = unsubscribe ? 
          'Digite *SAIR* para não receber mais mensagens.' : ''; 
      
      console.log(`Enviando ${i + 1}/${targetContacts.length} para ${contact.phone}...`);

      try {
          // ==========================================================
          // ETAPA 1: Envio da Mensagem do TOPO (Texto Puro com CTA)
          // ==========================================================
          if (topMessage.trim()) {
              console.log('📤 Enviando Etapa 1: Texto/CTA');
              
              // apiService.sendMessage já chama o backend /api/send-message
              const textResult = await apiService.sendMessage(
                  connectedAccount, 
                  contact.phone, 
                  topMessage, // ✅ Texto + CTA (sem descadastro)
                  '' // Imagem vazia
              );
              if (!textResult.success) {
                  contactSuccess = false;
                  contactError = textResult.error || 'Erro ao enviar CTA/Texto';
              }
              // Pausa se houver mais etapas
              if (contactSuccess && (banners.length > 0 || footerMessage.trim())) {
                  await new Promise(resolve => setTimeout(resolve, delayBetweenSteps));
              }
          }
          
          if (!contactSuccess) {
              // Se houve falha no CTA, não continua
              throw new Error(contactError || 'Falha na Etapa 1'); 
          }

          // ==========================================================
          // ETAPA 2: Envio das Imagens (Banners)
          // ==========================================================
          if (banners.length > 0) {
              console.log(`📤 Enviando Etapa 2: ${banners.length} Banner(s)`);
              for (let j = 0; j < banners.length; j++) {
                  const banner = banners[j];
                  
                  // Imagens enviadas SEM legenda/caption (o backend /api/send-message ignora o message se image existir)
                  const imgResult = await apiService.sendMessage(
                      connectedAccount, 
                      contact.phone, 
                      '', // ✅ Legenda vazia
                      banner // ✅ Imagem
                  );
                  
                  if (!imgResult.success) {
                      contactSuccess = false;
                      contactError = imgResult.error || 'Erro ao enviar imagem';
                      break;
                  }
                  // Pausa entre imagens
                  if (banners.length > 1 && j < banners.length - 1) {
                      await new Promise(resolve => setTimeout(resolve, 1000)); 
                  }
              }

              // Pausa se houver mais etapas
              if (contactSuccess && footerMessage.trim()) {
                  await new Promise(resolve => setTimeout(resolve, delayBetweenSteps));
              }
          }
          
          if (!contactSuccess) {
              // Se houve falha nas Imagens, não continua
              throw new Error(contactError || 'Falha na Etapa 2');
          }


          // ==========================================================
          // ETAPA 3: Envio da Mensagem de FOOTER (Descadastro)
          // ==========================================================
          if (footerMessage.trim()) {
              console.log('📤 Enviando Etapa 3: Descadastro');
              // Envia APENAS a mensagem de descadastro como uma mensagem de texto final
              const footerResult = await apiService.sendMessage(
                  connectedAccount, 
                  contact.phone, 
                  footerMessage,
                  '' // Imagem vazia
              ); 
              if (!footerResult.success) {
                  // É um aviso, mas registramos o envio como sucesso do contato
                  console.warn('Falha ao enviar footer de descadastre:', footerResult.error); 
              }
              await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Se chegou aqui, o contato foi um sucesso
          setProgress(prev => ({ ...prev, sent: prev.sent + 1 }));
          const newStats = campaignControl.incrementSent();
          setStats(newStats);
          setMessagesSinceLastPause(prev => prev + 1);

      } catch (err: any) {
        console.error('Erro crítico no loop:', err);
        contactSuccess = false;
        contactError = err.message;
        setProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
        
        // Tratar erro crítico
        if (contactError?.includes('client-token is not configured')) {
          setCriticalError('ERRO CRÍTICO: Sua Z-API exige um Client-Token. Vá na aba Conexões e preencha.');
          setCampaignStatus('PAUSED');
          return;
        }
      }

      // ... (Lógica de Pausa Automática)
      const canContinue = campaignControl.canSend();
      if (!canContinue.allowed) {
        alert(`Campanha pausada!\n${canContinue.reason}\n\n${progress.sent + 1} enviadas de ${targetContacts.length} (${i + 1} processadas)`);
        setCampaignStatus('COMPLETED');
        return;
      }

      if (campaignControl.shouldPause(messagesSinceLastPause) && i < targetContacts.length - 1) {
        const pauseDuration = campaignControl.getPauseDuration();
        setIsPausing(true);
        setCampaignStatus('PAUSED');
        campaignControl.registerPause();
        
        console.log(`⏸ PAUSA AUTOMÁTICA: ${settings.pauseDuration} minutos após ${messagesSinceLastPause} mensagens`);
        
        const pauseEnd = Date.now() + pauseDuration;
        const pauseInterval = setInterval(() => {
          const remaining = Math.max(0, pauseEnd - Date.now());
          setPauseTimeRemaining(remaining);
          if (remaining === 0) {
            clearInterval(pauseInterval);
            setIsPausing(false);
            setPauseTimeRemaining(0);
            setCampaignStatus('SENDING');
            console.log('▶ Retomando envios...');
          }
        }, 1000);
        
        await new Promise(resolve => setTimeout(resolve, pauseDuration));
        setMessagesSinceLastPause(0);
      }
      // ... (Fim da Lógica de Pausa Automática)


      if (i < targetContacts.length - 1) {
        const delay = getDelay();
        console.log(`Aguardando ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    setCampaignStatus('COMPLETED');
    alert('Disparo finalizado!');
  };

  const aspectClass = aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16]';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-white">Criar Disparo</h2>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
        >
          <Activity size={18} />
          Configurações
        </button>
      </div>

      {/* Dashboard de Saúde da Conta */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Saúde da Conta</span>
            <span className="text-2xl">{campaignControl.getAccountStatus().icon}</span>
          </div>
          <div className={`text-lg font-bold ${campaignControl.getAccountStatus().color}`}>
            {campaignControl.getAccountStatus().health}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {campaignControl.getAccountStatus().message}
          </div>
        </div>

        <div className="bg-card border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Taxa de Entrega</span>
            <CheckCircle2 size={20} className="text-green-500" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.deliveryRate}%</div>
          <div className="text-xs text-gray-500 mt-1">{stats.todaySent} enviadas</div>
        </div>

        <div className="bg-card border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Limite Diário</span>
            <ShieldCheck size={20} className="text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-white">
            {stats.todaySent + stats.todayFailed}/{settings.dailyLimit}
          </div>
          <div className="text-xs text-gray-500 mt-1">{campaignControl.canSend().remaining} restantes</div>
        </div>

        <div className="bg-card border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Falhas</span>
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.todayFailed}</div>
          <div className="text-xs text-gray-500 mt-1">{stats.todayFailed > 0 ? 'Verificar conexão' : 'Tudo OK'}</div>
        </div>
      </div>

      {/* Modal de Configurações */}
      {showSettings && (
        <div className="bg-card border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Configurações de Proteção</h3>
            <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Idade da Conta</label>
              <select
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white"
                value={settings.accountAge}
                onChange={(e) => {
                  const age = e.target.value as 'NEW' | 'MEDIUM' | 'OLD';
                  const newSettings = { ...settings, accountAge: age };
                  const info = ACCOUNT_AGE_INFO[age];
                  newSettings.dailyLimit = info.dailyLimit;
                  setSettings(newSettings);
                  campaignControl.saveSettings(newSettings);
                  setDelayMode(info.recommendedMode);
                }}
              >
                <option value="NEW">Nova (0-30 dias) - Limite 100/dia</option>
                <option value="MEDIUM">Média (1-6 meses) - Limite 400/dia</option>
                <option value="OLD">Antiga (6+ meses) - Limite 800/dia</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">{ACCOUNT_AGE_INFO[settings.accountAge].description}</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Limite Diário (manual)</label>
              <input
                type="number"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white"
                value={settings.dailyLimit}
                onChange={(e) => {
                  const newSettings = { ...settings, dailyLimit: parseInt(e.target.value) || 100 };
                  setSettings(newSettings);
                  campaignControl.saveSettings(newSettings);
                }}
                min={10}
                max={5000}
              />
              <p className="text-xs text-gray-500 mt-1">Máximo de mensagens por dia</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Pausar Após (mensagens)</label>
              <input
                type="number"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white"
                value={settings.pauseAfter}
                onChange={(e) => {
                  const newSettings = { ...settings, pauseAfter: parseInt(e.target.value) || 50 };
                  setSettings(newSettings);
                  campaignControl.saveSettings(newSettings);
                }}
                min={10}
                max={500}
              />
              <p className="text-xs text-gray-500 mt-1">Sistema pausará automaticamente</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Duração da Pausa (minutos)</label>
              <input
                type="number"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white"
                value={settings.pauseDuration}
                onChange={(e) => {
                  const newSettings = { ...settings, pauseDuration: parseInt(e.target.value) || 15 };
                  setSettings(newSettings);
                  campaignControl.saveSettings(newSettings);
                }}
                min={5}
                max={60}
              />
              <p className="text-xs text-gray-500 mt-1">Tempo de descanso automático</p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-300">
              <strong>💡 Recomendação:</strong> {ACCOUNT_AGE_INFO[settings.accountAge].label} deve usar modo <strong>{ACCOUNT_AGE_INFO[settings.accountAge].recommendedMode}</strong> com risco <strong>{ACCOUNT_AGE_INFO[settings.accountAge].risk}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Indicador de Pausa */}
      {isPausing && (
        <div className="bg-yellow-500/20 border-l-4 border-yellow-500 p-4 rounded animate-pulse">
          <div className="flex items-center">
            <Pause className="text-yellow-500 mr-2" size={20} />
            <div className="flex-1">
              <p className="font-bold text-yellow-200">Pausa Automática Ativa</p>
              <p className="text-sm text-yellow-300">
                Tempo restante: {Math.ceil(pauseTimeRemaining / 1000)} segundos
              </p>
            </div>
          </div>
        </div>
      )}

      {criticalError && (
        <div className="bg-red-500/20 border-l-4 border-red-500 p-4 rounded animate-in slide-in-from-top mb-4">
          <div className="flex items-start">
            <AlertTriangle className="text-red-500 mr-2 flex-shrink-0" size={20} />
            <div>
              <p className="font-bold text-red-200">Disparo Interrompido</p>
              <p className="text-sm text-red-300">{criticalError}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Targeting Settings */}
          <div className="bg-card border border-gray-700 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Users className="mr-2 text-primary" size={20} />
              Segmentação e Risco
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Selecione a Lista (Segmento)</label>
                <select
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white focus:border-primary focus:outline-none"
                  value={selectedSegment}
                  onChange={(e) => setSelectedSegment(e.target.value)}
                  disabled={campaignStatus === 'SENDING'}
                >
                  {availableSegments.length === 0 ? (
                    <option value="">Nenhum segmento encontrado</option>
                  ) : (
                    availableSegments.map(seg => (
                      <option key={seg} value={seg}>{seg}</option>
                    ))
                  )}
                </select>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-green-400 flex items-center">
                    <Users size={12} className="mr-1" />
                    {contactsCount} aptos
                  </p>
                  {blockedCount > 0 && (
                    <p className="text-xs text-red-400 flex items-center font-bold" title="Estes contatos estão na Blacklist e não receberão mensagens">
                      <ShieldBan size={12} className="mr-1" />
                      {blockedCount} bloqueados (serão ignorados)
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Intervalo de Envio (Segurança)</label>
                <select
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white"
                  value={delayMode}
                  onChange={(e) => setDelayMode(e.target.value as any)}
                  disabled={campaignStatus === 'SENDING'}
                >
                  <option value="SLOW">Lento (25s - 45s) - Seguro</option>
                  <option value="MEDIUM">Médio (10s - 20s) - Padrão</option>
                  <option value="FAST">Rápido (3s - 8s) - Alto Risco</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. Banners */}
          <div className="bg-card border border-gray-700 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Mídia (Até 4 Banners)</h3>
              <span className="text-xs text-gray-400">{banners.length}/4</span>
            </div>

            <div className="flex space-x-4 mb-6">
              <button
                onClick={() => setAspectRatio('16:9')}
                disabled={campaignStatus === 'SENDING'}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm border transition-all ${
                  aspectRatio === '16:9'
                    ? 'bg-primary/20 border-primary text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <Monitor size={16} />
                <span>Horizontal (16:9)</span>
              </button>
              <button
                onClick={() => setAspectRatio('9:16')}
                disabled={campaignStatus === 'SENDING'}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm border transition-all ${
                  aspectRatio === '9:16'
                    ? 'bg-primary/20 border-primary text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <Smartphone size={16} />
                <span>Vertical (9:16)</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {banners.map((banner, index) => (
                <div key={index} className={`relative ${aspectClass} bg-gray-800 rounded-lg overflow-hidden border border-gray-600 group`}>
                  <img src={banner} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeBanner(index)}
                    disabled={campaignStatus === 'SENDING'}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                  <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-1.5 rounded">
                    {index + 1}
                  </div>
                </div>
              ))}

              {banners.length < 4 && (
                <label className={`relative ${aspectClass} border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-gray-800 transition-all text-gray-500 hover:text-primary ${
                  campaignStatus === 'SENDING' ? 'opacity-50 pointer-events-none' : ''
                }`}>
                  {isProcessingImage ? (
                    <>
                      <Loader2 className="animate-spin mb-2" size={24} />
                      <span className="text-xs text-center">Otimizando...</span>
                      <span className="text-[10px] opacity-70">Aguarde</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon size={24} className="mb-2" />
                      <span className="text-xs text-center">Adicionar Imagem</span>
                      <span className="text-[10px] opacity-70">{aspectRatio}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={campaignStatus === 'SENDING' || isProcessingImage}
                  />
                </label>
              )}
            </div>
            <p className="text-[10px] text-gray-500 mt-2">Ordem: CTA {'>'} Imagens {'>'} Descadastre.</p>
          </div>

          {/* 3. Message Content + AI */}
          <div className="bg-card border border-gray-700 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Conteúdo da Mensagem</h3>
              <button
                onClick={handleGenerateAI}
                disabled={isGenerating || campaignStatus === 'SENDING'}
                className="flex items-center space-x-1 text-xs bg-purple-600/20 text-purple-300 px-3 py-1.5 rounded-full border border-purple-500/30 hover:bg-purple-600/30 transition-colors disabled:opacity-50"
              >
                <Wand2 size={14} />
                <span>{isGenerating ? 'Gerando...' : 'Gerar com IA'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <input
                type="text"
                placeholder="Produto (ex: Tênis Corrida)"
                className="bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                disabled={campaignStatus === 'SENDING'}
              />
              <input
                type="text"
                placeholder="Público (ex: Atletas)"
                className="bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                disabled={campaignStatus === 'SENDING'}
              />
            </div>

            <textarea
              className="w-full h-40 bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-primary focus:outline-none resize-none disabled:opacity-50"
              placeholder="Digite sua mensagem aqui..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={campaignStatus === 'SENDING'}
            />

            {/* CTA + Unsubscribe */}
            <div className="mt-6 space-y-4 border-t border-gray-700 pt-6">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Botão de Ação (CTA)</label>
                <div className="flex gap-4">
                  <input
                    type="text"
                    placeholder="Texto (ex: Comprar Agora)"
                    className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm disabled:opacity-50"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    disabled={campaignStatus === 'SENDING'}
                  />
                  <input
                    type="text"
                    placeholder="Link (https://...)"
                    className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 text-white text-sm disabled:opacity-50"
                    value={ctaLink}
                    onChange={(e) => setCtaLink(e.target.value)}
                    disabled={campaignStatus === 'SENDING'}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between bg-gray-800/50 p-3 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-white text-sm font-medium">Opção de Descadastre</span>
                  <span className="text-xs text-gray-500">Enviar "Digite *SAIR* para não receber mais mensagens." no final.</span>
                </div>
                <button
                  onClick={() => setUnsubscribe(!unsubscribe)}
                  disabled={campaignStatus === 'SENDING'}
                  className={`w-12 h-6 rounded-full relative transition-colors ${
                    unsubscribe ? 'bg-primary' : 'bg-gray-600'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    unsubscribe ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Preview + Status */}
        <div className="lg:col-span-1 space-y-6">
          {/* Sending Status Overlay */}
          {(campaignStatus !== 'IDLE' && campaignStatus !== 'PAUSED') && (
            <div className="bg-card border border-gray-700 rounded-2xl p-6 shadow-xl animate-in slide-in-from-bottom">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                {campaignStatus === 'SENDING' ? (
                  <Loader2 className="animate-spin mr-2 text-primary" />
                ) : (
                  <CheckCircle2 className="mr-2 text-green-500" />
                )}
                {campaignStatus === 'SENDING' ? 'Disparando...' : 'Finalizado'}
              </h3>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Progresso</span>
                  <span>{Math.round(((progress.sent + progress.failed) / progress.total) * 100)}%</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${((progress.sent + progress.failed) / progress.total) * 100}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-center mb-4">
                <div className="bg-green-500/10 rounded-lg p-2">
                  <div className="text-xl font-bold text-green-500">{progress.sent}</div>
                  <div className="text-xs text-green-300">Enviados</div>
                </div>
                <div className="bg-red-500/10 rounded-lg p-2">
                  <div className="text-xl font-bold text-red-500">{progress.failed}</div>
                  <div className="text-xs text-red-300">Falhas</div>
                </div>
              </div>

              {campaignStatus === 'SENDING' && (
                <div className="text-xs text-center text-gray-500 animate-pulse">
                  Enviando para <span className="text-white font-bold">{currentContactName}</span>
                </div>
              )}

              {campaignStatus === 'COMPLETED' && (
                <button
                  onClick={() => setCampaignStatus('IDLE')}
                  className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                >
                  Novo Disparo
                </button>
              )}
            </div>
          )}

          {/* Preview */}
          <div className={`sticky top-6 ${campaignStatus === 'SENDING' ? 'opacity-50 pointer-events-none' : ''}`}>
            <h3 className="text-lg font-semibold text-white mb-4">Pré-visualização</h3>
            <div className="bg-[#0b141a] border-[8px] border-gray-800 rounded-[3rem] h-[600px] overflow-hidden relative shadow-2xl">
              {/* Mock Phone Header */}
              <div className="bg-[#202c33] px-4 py-3 flex items-center space-x-3 border-b border-gray-800">
                <div className="w-8 h-8 rounded-full bg-gray-500" />
                <div className="flex-1">
                  <div className="h-2 w-24 bg-gray-600 rounded mb-1" />
                  <div className="h-1.5 w-16 bg-gray-700 rounded" />
                </div>
              </div>

              {/* Mock Chat Area */}
              <div
                className="p-4 space-y-4 h-full overflow-y-auto pb-20 scrollbar-none"
                style={{
                  backgroundImage: 'url(https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png)',
                  opacity: 0.9
                }}
              >
                {/* 1. Text Bubble (Top) - CTA */}
                {(message || ctaText) && (
                  <div className="bg-[#202c33] rounded-lg p-2 max-w-[90%] ml-auto mr-0 shadow-sm mb-2">
                    <p className="text-white text-sm whitespace-pre-wrap">
                      {message || 'Teste de envio'}
                    </p>
                    {ctaText && (
                      <div className="mt-2 pt-2 border-t border-gray-600">
                        <button className="w-full bg-[#2a3942] text-[#3b82f6] text-xs font-medium py-1.5 px-3 rounded flex items-center justify-center space-x-1 hover:bg-[#32424d]">
                          <Link size={12} />
                          <span>{ctaText}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}


                {/* 2. Image Bubbles (Middle) */}
                {banners.length > 0 && (
                  <div className="flex flex-col gap-2 items-end">
                    {banners.map((b, i) => (
                      <div key={i} className="bg-[#202c33] p-1 rounded-lg max-w-[80%] shadow-sm">
                        <img src={b} className={`rounded-lg w-full object-cover ${aspectClass}`} alt="" />
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. Unsubscribe Bubble (Bottom) */}
                {unsubscribe && (
                  <div className="bg-[#202c33] rounded-lg p-2 max-w-[85%] ml-auto mr-0 shadow-sm mt-2 opacity-80">
                    <p className="text-gray-300 text-xs text-center">
                      Caso não queira receber mais mensagens, responda Sair.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {campaignStatus === 'IDLE' && (
              <div className="mt-6 space-y-3">
                <button
                  onClick={handleStartCampaign}
                  className="w-full bg-primary hover:bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center space-x-2 transition-all transform hover:scale-1.02"
                >
                  <Play size={20} />
                  <span>Iniciar Disparo</span>
                </button>

                <div className="flex items-center justify-center text-xs text-gray-500 space-x-1">
                  <Clock size={12} />
                  <span>
                    Tempo estimado: {Math.ceil(contactsCount * (delayMode === 'FAST' ? 5 : delayMode === 'MEDIUM' ? 15 : 35) / 60)} min
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Campaigns;
