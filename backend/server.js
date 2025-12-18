const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// ============================================
// CORS ATUALIZADO PARA PRODUÇÃO
// ============================================
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5174',
    ];
    
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// MONGODB CONNECTION (LAZY)
// ============================================
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log('✅ MongoDB conectado');
  } catch (error) {
    console.error('❌ Erro MongoDB:', error.message);
    throw error;
  }
};

// ============================================
// SCHEMAS
// ============================================
const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  tags: [String],
  status: { type: String, enum: ['VALID', 'INVALID', 'UNKNOWN', 'BLOCKED'], default: 'VALID' },
  lastInteraction: Date
}, { timestamps: true });

const accountSchema = new mongoose.Schema({
  name: String,
  instanceName: String,
  phoneNumber: { type: String, unique: true, sparse: true },
  status: { type: String, enum: ['CONNECTED', 'DISCONNECTED', 'SCANNING'], default: 'DISCONNECTED' },
  connectionType: String,
  zApiUrl: String,
  zApiClientToken: String,
  zApiId: String,
  zApiToken: String,
  battery: Number,
  avatarUrl: String
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  messageId: { type: String, unique: true, sparse: true },
  phone: { type: String, required: true },
  sender: { type: String, enum: ['user', 'agent', 'system'], default: 'user' },
  text: String,
  timestamp: { type: Date, default: Date.now },
  fromMe: { type: Boolean, default: false },
  accountId: mongoose.Schema.Types.ObjectId,
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

messageSchema.index({ phone: 1, timestamp: -1 });

const chatSchema = new mongoose.Schema({
  chatId: { type: String, unique: true },
  contactId: mongoose.Schema.Types.ObjectId,
  contactName: String,
  phone: String,
  lastMessage: String,
  unreadCount: { type: Number, default: 0 },
  accountId: mongoose.Schema.Types.ObjectId,
  lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true });

const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  status: {
    type: String,
    enum: ['DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'PAUSED', 'CANCELLED'],
    default: 'DRAFT'
  },
  message: String,
  banners: [String],
  ctaText: String,
  ctaLink: String,
  unsubscribeEnabled: { type: Boolean, default: true },
  sent: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  delivered: { type: Number, default: 0 },
  sendMode: { type: String, enum: ['IMMEDIATE', 'SCHEDULED'], default: 'IMMEDIATE' },
  delayBetweenMessages: { type: Number, default: 3000 },
  targetTags: [String],
  excludeBlocked: { type: Boolean, default: true },
  accountId: mongoose.Schema.Types.ObjectId,
  scheduledFor: Date,
  startedAt: Date,
  completedAt: Date
}, { timestamps: true });

campaignSchema.index({ status: 1, createdAt: -1 });

const Contact = mongoose.model('Contact', contactSchema);
const Account = mongoose.model('Account', accountSchema);
const Message = mongoose.model('Message', messageSchema);
const Chat = mongoose.model('Chat', chatSchema);
const Campaign = mongoose.model('Campaign', campaignSchema);

// ============================================
// ROUTES - CONTACTS
// ============================================
app.get('/api/contacts', async (req, res) => {
  try {
    await connectDB();
    const { status, tag, search } = req.query;
    let query = {};
    
    if (status) query.status = status;
    if (tag) query.tags = tag;
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') }
      ];
    }
    
    const contacts = await Contact.find(query).sort({ createdAt: -1 });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/contacts', async (req, res) => {
  try {
    await connectDB();
    const contact = new Contact(req.body);
    await contact.save();
    res.status(201).json(contact);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Telefone já cadastrado' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.post('/api/contacts/bulk', async (req, res) => {
  try {
    await connectDB();
    const { contacts } = req.body;
    const results = await Contact.insertMany(contacts, { ordered: false });
    res.json({ count: results.length, contacts: results });
  } catch (error) {
    if (error.code === 11000) {
      const inserted = error.insertedDocs?.length || 0;
      res.json({ count: inserted, duplicates: error.writeErrors?.length || 0 });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.put('/api/contacts/:id', async (req, res) => {
  try {
    await connectDB();
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!contact) return res.status(404).json({ error: 'Contato não encontrado' });
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/contacts/:id', async (req, res) => {
  try {
    await connectDB();
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contato não encontrado' });
    res.json({ message: 'Contato excluído' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ROUTES - ACCOUNTS
// ============================================
app.get('/api/accounts', async (req, res) => {
  try {
    await connectDB();
    const accounts = await Account.find().sort({ createdAt: -1 });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    await connectDB();
    
    const accountData = { ...req.body };
    
    // EXTRAÇÃO AUTOMÁTICA DE DADOS DA URL
    if (accountData.zApiUrl && !accountData.zApiId && !accountData.zApiToken) {
      console.log('🔍 Extraindo dados da URL Z-API...');
      console.log('📋 URL recebida:', accountData.zApiUrl);
      
      const urlMatch = accountData.zApiUrl.match(/instances\/([A-Z0-9]+)\/token\/([A-Z0-9]+)/i);
      
      if (urlMatch && urlMatch.length >= 3) {
        accountData.zApiId = urlMatch[1];
        accountData.zApiToken = urlMatch[2];
        accountData.instanceName = urlMatch[1];
        
        console.log('✅ Instance ID extraído:', accountData.zApiId);
        console.log('✅ Token extraído:', accountData.zApiToken.substring(0, 10) + '...');
      } else {
        console.warn('⚠️ Não foi possível extrair dados da URL');
      }
    }
    
    if (!accountData.name) {
      accountData.name = accountData.phoneNumber || accountData.instanceName || 'Conexão 1';
    }
    
    if (!accountData.status) {
      accountData.status = 'CONNECTED';
    }
    
    if (!accountData.connectionType) {
      accountData.connectionType = 'Z-API';
    }
    
    console.log('💾 Salvando conta com dados:', {
      name: accountData.name,
      instanceName: accountData.instanceName,
      zApiId: accountData.zApiId,
      hasClientToken: !!accountData.zApiClientToken
    });
    
    const account = new Account(accountData);
    await account.save();
    
    console.log('✅ CONTA CADASTRADA COM SUCESSO:', account.name);
    res.status(201).json(account);
  } catch (error) {
    console.error('❌ Erro ao cadastrar conta:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/accounts/:id', async (req, res) => {
  try {
    await connectDB();
    const account = await Account.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!account) return res.status(404).json({ error: 'Conta não encontrada' });
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/accounts/:id', async (req, res) => {
  try {
    await connectDB();
    const account = await Account.findByIdAndDelete(req.params.id);
    if (!account) return res.status(404).json({ error: 'Conta não encontrada' });
    res.json({ message: 'Conta excluída' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ROUTES - MESSAGES
// ============================================
app.get('/api/messages/:phone', async (req, res) => {
  try {
    await connectDB();
    const messages = await Message.find({ phone: req.params.phone })
      .sort({ timestamp: -1 })
      .limit(100);
    
    const sanitizedMessages = messages.map(msg => ({
      ...msg.toObject(),
      text: msg.text || '',
      messageId: msg.messageId || `msg_${Date.now()}`,
      sender: msg.sender || 'user',
      fromMe: msg.fromMe || false
    }));
    
    res.json(sanitizedMessages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/messages/:phone', async (req, res) => {
  try {
    await connectDB();
    
    // Verifica se é um ObjectId (mensagem individual) ou telefone (todas as mensagens)
    if (mongoose.Types.ObjectId.isValid(req.params.phone)) {
      // É um ID de mensagem - deletar uma mensagem
      const message = await Message.findByIdAndDelete(req.params.phone);
      
      if (!message) {
        return res.status(404).json({ error: 'Mensagem não encontrada' });
      }
      
      console.log('✅ Mensagem excluída:', req.params.phone);
      res.json({ message: 'Mensagem excluída com sucesso', deletedId: req.params.phone });
    } else {
      // É um telefone - deletar todas as mensagens
      await Message.deleteMany({ phone: req.params.phone });
      console.log('✅ Mensagens excluídas para:', req.params.phone);
      res.json({ message: 'Mensagens excluídas' });
    }
  } catch (error) {
    console.error('❌ Erro ao excluir mensagem(ns):', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ROUTES - CHATS
// ============================================
app.get('/api/chats', async (req, res) => {
  try {
    await connectDB();
    const chats = await Chat.find()
      .sort({ lastMessageAt: -1 })
      .limit(50);
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE CHAT (CONVERSA INTEIRA)
app.delete('/api/chats/:phone', async (req, res) => {
  try {
    await connectDB();
    
    const phone = req.params.phone.replace(/\D/g, '');
    
    // Deletar chat
    const chat = await Chat.findOneAndDelete({ phone });
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat não encontrado' });
    }
    
    console.log('✅ Chat excluído:', phone);
    res.json({ message: 'Chat excluído com sucesso', phone });
  } catch (error) {
    console.error('❌ Erro ao excluir chat:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ROUTES - CAMPAIGNS
// ============================================
app.get('/api/campaigns', async (req, res) => {
  try {
    await connectDB();
    const campaigns = await Campaign.find()
      .populate('accountId')
      .sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campaigns', async (req, res) => {
  try {
    await connectDB();
    const campaign = new Campaign(req.body);
    await campaign.save();
    res.status(201).json(campaign);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/campaigns/:id', async (req, res) => {
  try {
    await connectDB();
    const campaign = await Campaign.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!campaign) return res.status(404).json({ error: 'Campanha não encontrada' });
    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ROTA DE DEBUG - TESTE Z-API
// ============================================
app.post('/api/test-zapi', async (req, res) => {
  try {
    await connectDB();
    
    const { phone, message } = req.body;
    
    console.log('🔍 DEBUG - Buscando conta...');
    
    const account = await Account.findOne({ 
      zApiUrl: { $exists: true, $ne: '' }
    }).sort({ createdAt: -1 });
    
    const totalAccounts = await Account.countDocuments();
    
    console.log(`📊 Total de contas no banco: ${totalAccounts}`);
    
    if (!account) {
      console.log('❌ Nenhuma conta encontrada com zApiUrl');
      return res.json({ 
        error: 'Nenhuma conta encontrada',
        totalAccounts: totalAccounts,
        debug: 'Nenhuma conta tem zApiUrl configurado'
      });
    }
    
    console.log('✅ Conta encontrada:', account.name);
    console.log('📋 URL:', account.zApiUrl);
    
    const instanceMatch = account.zApiUrl.match(/instances\/([A-Z0-9]+)\/token\/([A-Z0-9]+)/i);
    
    if (!instanceMatch) {
      console.log('❌ URL mal formatada');
      return res.json({
        error: 'URL inválida - regex não deu match',
        accountName: account.name,
        url: account.zApiUrl,
        totalAccounts
      });
    }
    
    const [, instanceId, token] = instanceMatch;
    const sendUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
    
    console.log('🔑 Instance:', instanceId);
    console.log('🔐 Token:', token.substring(0, 10) + '...');
    console.log('🌐 Send URL:', sendUrl);
    
    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': account.zApiClientToken || ''
      },
      body: JSON.stringify({
        phone: phone.replace(/\D/g, ''),
        message: message || 'Teste debug'
      })
    });
    
    const data = await response.json();
    
    console.log('📨 Status HTTP:', response.status);
    console.log('📨 Resposta Z-API:', data);
    
    res.json({
      success: true,
      accountFound: account.name,
      totalAccounts,
      instanceId,
      token: token.substring(0, 10) + '...',
      sendUrl,
      zapiStatus: response.status,
      zapiResponse: data,
      sentSuccess: response.ok && data.messageId ? true : false
    });
    
  } catch (error) {
    console.error('❌ Erro no debug:', error);
    res.json({ error: error.message, stack: error.stack });
  }
});

// ============================================
// SEND MESSAGE VIA Z-API
// ============================================
app.post('/api/send-message', async (req, res) => {
  try {
    await connectDB();
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone e message são obrigatórios' });
    }
    
    console.log('📤 Tentando enviar mensagem para:', phone);
    console.log('💬 Mensagem:', message);
    
    const connectedAccount = await Account.findOne({
      zApiUrl: { $exists: true, $ne: '' }
    }).sort({ createdAt: -1 });
    
    let messageId = `msg_${Date.now()}`;
    let sentViaZapi = false;
    let zapiData = null;
    
    if (connectedAccount && connectedAccount.zApiUrl) {
      try {
        console.log('✅ Conta encontrada:', connectedAccount.name);
        console.log('📋 URL original:', connectedAccount.zApiUrl);
        
        const urlPattern = /instances\/([A-Z0-9]+)\/token\/([A-Z0-9]+)/i;
        const urlMatch = connectedAccount.zApiUrl.match(urlPattern);
        
        if (!urlMatch || urlMatch.length < 3) {
          console.error('❌ ERRO: URL Z-API inválida!');
          throw new Error('URL Z-API mal formatada');
        }
        
        const instanceId = urlMatch[1];
        const token = urlMatch[2];
        
        console.log('🔑 Instance ID extraído:', instanceId);
        console.log('🔐 Token extraído:', token.substring(0, 10) + '...');
        
        const sendUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
        console.log('🌐 URL de envio:', sendUrl);
        
        const headers = {
          'Content-Type': 'application/json'
        };
        
        if (connectedAccount.zApiClientToken) {
          headers['Client-Token'] = connectedAccount.zApiClientToken;
          console.log('🔐 Client-Token adicionado aos headers');
        }
        
        const cleanPhone = phone.replace(/\D/g, '');
        console.log('📞 Telefone limpo:', cleanPhone);
        
        const payload = {
          phone: cleanPhone,
          message: message
        };
        
        console.log('📦 Payload:', JSON.stringify(payload));
        console.log('📡 Enviando requisição para Z-API...');
        
        const zapiResponse = await fetch(sendUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload)
        });
        
        zapiData = await zapiResponse.json();
        
        console.log('📨 Status da resposta:', zapiResponse.status);
        console.log('📨 Resposta completa:', JSON.stringify(zapiData, null, 2));
        
        if (zapiResponse.ok && (zapiData.messageId || zapiData.success)) {
          messageId = zapiData.messageId || messageId;
          sentViaZapi = true;
          console.log('✅ SUCESSO! Mensagem enviada via Z-API');
          console.log('✅ Message ID:', messageId);
        } else {
          console.error('❌ Resposta Z-API indicou erro:', zapiData);
        }
        
      } catch (zapiError) {
        console.error('⚠️ Erro ao comunicar com Z-API:', zapiError.message);
      }
    } else {
      console.warn('⚠️ Nenhuma conta Z-API configurada no banco');
    }
    
    const newMessage = new Message({
      messageId: messageId,
      phone: phone.replace(/\D/g, ''),
      sender: 'agent',
      text: message,
      fromMe: true,
      timestamp: new Date(),
      accountId: connectedAccount?._id,
      metadata: {
        source: 'web-interface',
        zapiResponse: zapiData,
        accountUsed: connectedAccount?.name,
        sentViaZapi: sentViaZapi
      }
    });
    
    await newMessage.save();
    console.log('💾 Mensagem salva no MongoDB');
    
    await Chat.findOneAndUpdate(
      { phone: phone.replace(/\D/g, '') },
      {
        phone: phone.replace(/\D/g, ''),
        lastMessage: message,
        lastMessageAt: new Date(),
        accountId: connectedAccount?._id
      },
      { upsert: true, new: true }
    );
    
    console.log('💾 Chat atualizado');
    
    const response = {
      success: true,
      messageId: messageId,
      sentViaZapi: sentViaZapi,
      accountUsed: connectedAccount?.name || 'Nenhuma',
      zapiResponse: zapiData
    };
    
    console.log('📤 Resposta final:', JSON.stringify(response, null, 2));
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ ERRO CRÍTICO:', error.message);
    res.status(500).json({ 
      success: false,
      error: error.message,
      sentViaZapi: false
    });
  }
});

// ============================================
// WEBHOOK - Z-API
// ============================================
app.post('/webhook', async (req, res) => {
  try {
    await connectDB();
    console.log('📨 Webhook recebido:', JSON.stringify(req.body, null, 2));

    const { phone, text, fromMe, messageId, message, senderName, pushName, notifyName } = req.body;

    let messageText = '';
    if (typeof text === 'string') {
      messageText = text;
    } else if (typeof text === 'object' && text !== null) {
      if (text.message) messageText = text.message;
      else if (text.text) messageText = text.text;
    } else if (typeof message === 'string') {
      messageText = message;
    } else if (typeof message === 'object' && message !== null) {
      if (message.text) messageText = message.text;
      else if (message.message) messageText = message.message;
      else if (message.conversation) messageText = message.conversation;
    }

    if (!messageText && req.body.data && req.body.data.message) {
      if (typeof req.body.data.message === 'string') {
        messageText = req.body.data.message;
      } else if (req.body.data.message.text) {
        messageText = req.body.data.message.text;
      }
    }

    if (phone && messageText) {
      const normalizedPhone = phone.replace(/\D/g, '');
      const contactName = senderName || pushName || notifyName ||
                         req.body.data?.senderName ||
                         req.body.data?.pushName ||
                         req.body.data?.notifyName ||
                         normalizedPhone;

      // ✅ DESCADASTRO AUTOMÁTICO
      const unsubscribeWords = ['sair', 'parar', 'cancelar', 'descadastrar', 'remover'];
      const isUnsubscribe = !fromMe && unsubscribeWords.some(word => 
        messageText.toLowerCase().includes(word)
      );

      if (isUnsubscribe) {
        console.log('🚫 DESCADASTRO detectado para:', normalizedPhone);

        // Atualizar contato para BLOCKED
        await Contact.findOneAndUpdate(
          { phone: normalizedPhone },
          { 
            status: 'BLOCKED',
            lastInteraction: new Date()
          },
          { upsert: true }
        );

        // Enviar confirmação automática
        const connectedAccount = await Account.findOne({
          status: 'CONNECTED',
          zApiUrl: { $exists: true, $ne: null }
        });

        if (connectedAccount) {
          try {
            const urlMatch = connectedAccount.zApiUrl.match(/instances\/([A-Z0-9]+)\/token\/([A-Z0-9]+)/i);
            if (urlMatch && urlMatch.length >= 3) {
              const [, instanceId, token] = urlMatch;
              const sendUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

              await fetch(sendUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Client-Token': connectedAccount.zApiClientToken || ''
                },
                body: JSON.stringify({
                  phone: normalizedPhone,
                  message: '✅ Você foi removido da nossa lista. Não receberá mais mensagens.'
                })
              });

              console.log('✅ Confirmação de descadastro enviada');
            }
          } catch (error) {
            console.error('❌ Erro ao enviar confirmação:', error.message);
          }
        }
      }

      // Salvar mensagem
      const newMessage = new Message({
        messageId: messageId || `msg_${Date.now()}`,
        phone: normalizedPhone,
        sender: fromMe ? 'agent' : 'user',
        text: messageText,
        fromMe: fromMe || false,
        timestamp: new Date(),
        metadata: req.body
      });

      await newMessage.save();

      // Atualizar chat
      await Chat.findOneAndUpdate(
        { phone: normalizedPhone },
        {
          phone: normalizedPhone,
          contactName: contactName,
          lastMessage: messageText,
          lastMessageAt: new Date(),
          $inc: { unreadCount: fromMe ? 0 : 1 }
        },
        { upsert: true, new: true }
      );

      console.log('✅ Mensagem salva:', normalizedPhone, '-', messageText);
    } else {
      console.log('⚠️ Webhook sem phone ou text válido');
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ROUTE - SEND MESSAGE (Z-API) - OTIMIZADO
// ============================================
app.post('/api/send-message', async (req, res) => {
  try {
    const { phone, message, image } = req.body;
    
    if (!phone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone é obrigatório' 
      });
    }
    
    if (!message && !image) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message ou image são obrigatórios' 
      });
    }
    
    const activeAccount = await Account.findOne({ 
      status: 'CONNECTED',
      zApiUrl: { $exists: true, $ne: null }
    });
    
    if (!activeAccount || !activeAccount.zApiUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nenhuma conta Z-API conectada' 
      });
    }
    
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Limpar URL da Z-API
    let baseUrl = activeAccount.zApiUrl;
    if (baseUrl.includes('/token/')) {
      baseUrl = baseUrl.substring(0, baseUrl.indexOf('/token/'));
    }
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    
    let endpoint = `${baseUrl}/send-text`;
    const body = { phone: cleanPhone };
    
    if (image) {
      endpoint = `${baseUrl}/send-image`;
      
      // ✅ GARANTIR que tem prefixo data:image
      let imageToSend = image.trim();
      if (!imageToSend.startsWith('data:image')) {
        imageToSend = 'data:image/jpeg;base64,' + imageToSend;
      }
      
      body.image = imageToSend;
      
      if (message) {
        body.caption = message;
      }
      
      console.log('📷 Tamanho da imagem:', imageToSend.length, 'bytes');
    } else {
      body.message = message;
    }
    
    const headers = { 'Content-Type': 'application/json' };
    if (activeAccount.zApiClientToken) {
      headers['Client-Token'] = activeAccount.zApiClientToken;
    }
    
    console.log('📤 Enviando via Z-API:', {
      endpoint,
      phone: cleanPhone,
      hasMessage: !!message,
      hasImage: !!image
    });
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    
    const resData = await response.json();
    
    if (response.ok) {
      const msgId = resData.messageId || resData.id || resData.zaapId;
      console.log('✅ Mensagem enviada via Z-API:', msgId);
      
      return res.json({
        success: true,
        messageId: msgId
      });
    }
    
    console.error('❌ Erro Z-API:', resData);
    return res.status(500).json({
      success: false,
      error: resData.message || resData.error || 'Erro ao enviar'
    });
    
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// ✅ STATS - CORRIGIDO COM GRÁFICOS
// ============================================
app.get('/api/stats', async (req, res) => {
  try {
    await connectDB();
    
    // Contadores básicos
    const [totalContacts, blockedContacts, validContacts, onlineAccounts, totalMessages, activeCampaigns] = await Promise.all([
      Contact.countDocuments(),
      Contact.countDocuments({ status: 'BLOCKED' }),
      Contact.countDocuments({ status: 'VALID' }),
      Account.countDocuments({ status: 'CONNECTED' }),
      Message.countDocuments(),
      Campaign.countDocuments({ status: { $in: ['SCHEDULED', 'SENDING'] } })
    ]);
    
    // ✅ CALCULAR ATIVIDADE SEMANAL (últimos 7 dias)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const weeklyMessages = await Message.aggregate([
      {
        $match: {
          timestamp: { $gte: sevenDaysAgo }
        }
      },
      {
        $project: {
          dayOfWeek: { $dayOfWeek: '$timestamp' }, // 1=Dom, 2=Seg, ..., 7=Sab
          sender: 1
        }
      },
      {
        $group: {
          _id: { day: '$dayOfWeek', sender: '$sender' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Mapear dias da semana
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const weeklyActivity = dayNames.map((name, index) => {
      const dayIndex = index === 0 ? 1 : index + 1; // Ajustar: MongoDB usa 1=Dom
      
      const envios = weeklyMessages.find(
        m => m._id.day === dayIndex && m._id.sender === 'agent'
      )?.count || 0;
      
      const recebidos = weeklyMessages.find(
        m => m._id.day === dayIndex && m._id.sender === 'user'
      )?.count || 0;

      return { name, envios, recebidos };
    });

    // ✅ CALCULAR TENDÊNCIA DE CADASTRO (últimos 7 dias)
    const registrationsByDay = await Contact.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $project: {
          dayOfWeek: { $dayOfWeek: '$createdAt' }
        }
      },
      {
        $group: {
          _id: '$dayOfWeek',
          count: { $sum: 1 }
        }
      }
    ]);

    const registrationTrend = dayNames.map((name, index) => {
      const dayIndex = index === 0 ? 1 : index + 1;
      const cadastros = registrationsByDay.find(r => r._id === dayIndex)?.count || 0;
      return { name, cadastros };
    });

    // ✅ RESPOSTA COMPLETA COM DADOS DOS GRÁFICOS
    res.json({
      totalContacts,
      blockedContacts,
      validContacts,
      onlineAccounts,
      totalMessages,
      activeCampaigns,
      weeklyActivity,      // ✅ Dados do gráfico de barras
      registrationTrend    // ✅ Dados do gráfico de linha
    });
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', async (req, res) => {
  try {
    await connectDB();
    const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    
    const connectedAccount = await Account.findOne({
      zApiUrl: { $exists: true, $ne: '' }
    }).sort({ createdAt: -1 });
    
    res.json({
      status: 'OK',
      mongodb: dbStatus,
      zapiAccount: connectedAccount ? connectedAccount.name : 'Nenhuma conectada',
      zapiUrl: connectedAccount ? connectedAccount.zApiUrl : null,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', error: error.message });
  }
});

// ============================================
// ROOT
// ============================================
app.get('/', (req, res) => {
  res.json({
    status: 'Ready',
    message: 'ZapMaster Backend API',
    endpoints: {
      accounts: '/api/accounts',
      contacts: '/api/contacts',
      chats: '/api/chats',
      deleteChat: '/api/chats/:phone',
      messages: '/api/messages/:phone',
      deleteMessage: '/api/messages/:id',
      sendMessage: '/api/send-message',
      testZapi: '/api/test-zapi',
      campaigns: '/api/campaigns',
      webhook: '/webhook',
      health: '/health',
      stats: '/api/stats'
    }
  });
});

// ============================================
// ============================================
// EVOLUTION API - ADICIONAR NO server.js
// ============================================
// Adicione este código ANTES do "module.exports = app;" no final do arquivo

// Configuração da Evolution API
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || '';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';

// ✅ CREATE INSTANCE
app.post('/instance/create', async (req, res) => {
  try {
    if (!EVOLUTION_API_URL) {
      return res.json({ 
        status: 'created',
        message: 'Modo demo - Configure EVOLUTION_API_URL no .env' 
      });
    }

    const { instanceName } = req.body;
    console.log('🔄 Criando instância:', instanceName);

    const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      })
    });

    const data = await response.json();
    console.log('✅ Instância criada:', data);
    res.json(data);
  } catch (error) {
    console.error('❌ Erro ao criar instância:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ CONNECT INSTANCE (GET QR CODE)
app.get('/instance/connect/:instanceName', async (req, res) => {
  try {
    if (!EVOLUTION_API_URL) {
      return res.json({ 
        base64: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=ZapMaster-Demo",
        status: 'SCANNING'
      });
    }

    const { instanceName } = req.params;
    console.log('📱 Buscando QR Code para:', instanceName);

    const response = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY
      }
    });

    const data = await response.json();
    console.log('✅ QR Code obtido');

    res.json({
      base64: data.base64 || data.qrcode || data.code,
      status: data.instance?.state || data.state || 'open',
      instance: data.instance
    });
  } catch (error) {
    console.error('❌ Erro ao buscar QR Code:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ CHECK CONNECTION STATUS
app.get('/instance/connectionState/:instanceName', async (req, res) => {
  try {
    if (!EVOLUTION_API_URL) {
      return res.json({ state: 'close' });
    }

    const { instanceName } = req.params;

    const response = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('❌ Erro ao verificar status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ LOGOUT/DISCONNECT INSTANCE
app.delete('/instance/logout/:instanceName', async (req, res) => {
  try {
    if (!EVOLUTION_API_URL) {
      return res.json({ success: true });
    }

    const { instanceName } = req.params;
    console.log('🔌 Desconectando:', instanceName);

    const response = await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: {
        'apikey': EVOLUTION_API_KEY
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('❌ Erro ao desconectar:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ FETCH INSTANCES (para o teste de conexão)
app.get('/instance/fetchInstances', async (req, res) => {
  try {
    if (!EVOLUTION_API_URL) {
      return res.json([]);
    }

    const response = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('❌ Erro ao buscar instâncias:', error);
    res.status(500).json({ error: error.message });
  }
});

// START SERVER
// ============================================
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n🚀 ZapMaster Pro Backend`);
    console.log(`📂 Servidor: http://localhost:${PORT}`);
    console.log(`🔗 Webhook: http://localhost:${PORT}/webhook`);
    console.log(`💚 Health: http://localhost:${PORT}/health`);
    console.log(`📊 Stats: http://localhost:${PORT}/api/stats\n`);
  });
}

module.exports = app;
