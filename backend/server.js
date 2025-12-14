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
    const account = new Account(req.body);
    await account.save();
    res.status(201).json(account);
  } catch (error) {
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
    await Message.deleteMany({ phone: req.params.phone });
    res.json({ message: 'Mensagens excluídas' });
  } catch (error) {
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
// SEND MESSAGE VIA Z-API (CORRIGIDO - SEM FILTRO DE STATUS)
// ============================================
app.post('/api/send-message', async (req, res) => {
  try {
    await connectDB();
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone e message são obrigatórios' });
    }

    console.log('📤 Enviando mensagem:', message, 'para:', phone);

    // ✅ BUSCA ÚLTIMA CONTA COM Z-API URL (INDEPENDENTE DO STATUS)
    const connectedAccount = await Account.findOne({ 
      zApiUrl: { $exists: true, $ne: '' }
    }).sort({ createdAt: -1 });

    let zapiData = null;
    let messageId = `msg_${Date.now()}`;
    let sentViaZapi = false;

    // ✅ Se encontrou conta configurada, envia via Z-API
    if (connectedAccount && connectedAccount.zApiUrl) {
      try {
        console.log('🔗 Usando conta:', connectedAccount.name);
        console.log('📍 URL Z-API:', connectedAccount.zApiUrl);

        // Extrai instance e token da URL
        // Formato esperado: https://api.z-api.io/instances/{INSTANCE}/token/{TOKEN}/...
        const urlMatch = connectedAccount.zApiUrl.match(/instances\/([^\/]+)\/token\/([^\/]+)/);
        
        if (!urlMatch) {
          console.error('❌ URL Z-API inválida. Formato esperado: https://api.z-api.io/instances/{INSTANCE}/token/{TOKEN}');
          throw new Error('URL Z-API mal formatada');
        }

        const [, instanceId, token] = urlMatch;
        console.log('🔑 Instance:', instanceId);
        console.log('🔐 Token:', token.substring(0, 10) + '...');

        // Monta URL de envio
        const sendUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
        
        const headers = { 'Content-Type': 'application/json' };
        if (connectedAccount.zApiClientToken) {
          headers['Client-Token'] = connectedAccount.zApiClientToken;
        }

        console.log('📡 Enviando para:', sendUrl);

        const zapiResponse = await fetch(sendUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            phone: phone.replace(/\D/g, ''),
            message: message
          })
        });

        zapiData = await zapiResponse.json();
        console.log('📨 Resposta Z-API:', JSON.stringify(zapiData));

        if (zapiData && (zapiData.messageId || zapiData.success)) {
          messageId = zapiData.messageId || `msg_${Date.now()}`;
          sentViaZapi = true;
        }

        if (!zapiResponse.ok) {
          console.error('❌ Erro na resposta Z-API:', zapiData);
        }

      } catch (zapiError) {
        console.error('⚠️ Erro ao enviar via Z-API:', zapiError.message);
      }
    } else {
      console.warn('⚠️ Nenhuma conta Z-API encontrada no banco');
    }

    // ✅ Salva no banco (sempre salva, independente do Z-API)
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
        accountUsed: connectedAccount?.name
      }
    });

    await newMessage.save();

    // Atualiza chat
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

    console.log(sentViaZapi ? '✅ Mensagem enviada via Z-API e salva' : '⚠️ Mensagem salva apenas no banco');

    res.json({ 
      success: true, 
      messageId: messageId,
      sentViaZapi: sentViaZapi,
      accountUsed: connectedAccount?.name || 'Nenhuma',
      zapiResponse: zapiData
    });

  } catch (error) {
    console.error('❌ Erro ao enviar:', error);
    res.status(500).json({ error: error.message });
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
      
      console.log('✅ Mensagem salva:', normalizedPhone, '-', messageText, '- Nome:', contactName);
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
// STATS
// ============================================
app.get('/api/stats', async (req, res) => {
  try {
    await connectDB();
    
    const [totalContacts, blockedContacts, validContacts, onlineAccounts, totalMessages, activeCampaigns] = await Promise.all([
      Contact.countDocuments(),
      Contact.countDocuments({ status: 'BLOCKED' }),
      Contact.countDocuments({ status: 'VALID' }),
      Account.countDocuments({ status: 'CONNECTED' }),
      Message.countDocuments(),
      Campaign.countDocuments({ status: { $in: ['SCHEDULED', 'SENDING'] } })
    ]);
    
    res.json({
      totalContacts,
      blockedContacts,
      validContacts,
      onlineAccounts,
      totalMessages,
      activeCampaigns
    });
  } catch (error) {
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
// START SERVER
// ============================================
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 ZapMaster Pro Backend`);
    console.log(`📂 Servidor: http://localhost:${PORT}`);
    console.log(`🔗 Webhook: http://localhost:${PORT}/webhook`);
    console.log(`💚 Health: http://localhost:${PORT}/health`);
    console.log(`📊 Stats: http://localhost:${PORT}/api/stats\n`);
  });
}

// Para Vercel (serverless)
module.exports = app;
