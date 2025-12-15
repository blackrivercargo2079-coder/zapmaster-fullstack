import React, { useState, useEffect } from 'react';
import {
  Upload,
  CheckCircle,
  XCircle,
  Download,
  Search,
  Loader2,
  Trash2,
  Edit2,
  X,
  Save,
  Plus,
  RefreshCw,
  Ban,
  Phone,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Contact, ContactStatus } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

const Contacts: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState<string | null>(null);

  // Seleção Múltipla
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Estado de Visualização (Abas)
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'BLACKLIST'>('ACTIVE');

  // Estado para Edição
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editData, setEditData] = useState({ name: '', phone: '', tags: '' });

  // Estado para Criação Manual
  const [isCreating, setIsCreating] = useState(false);
  const [newContactData, setNewContactData] = useState({
    name: '',
    phone: '',
    tags: '',
  });

  // Busca e Filtro
  const [searchTerm, setSearchTerm] = useState('');

  // ============================================
  // FUNÇÃO AUXILIAR - NORMALIZAR TELEFONE
  // ============================================
  const normalizePhone = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    
    // Se já tem 13 dígitos (55 + DDD + número), retorna como está
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      return cleaned;
    }
    
    // Se tem 11 dígitos (DDD + número), adiciona 55
    if (cleaned.length === 11) {
      return '55' + cleaned;
    }
    
    // Se tem 10 dígitos (DDD + número sem o 9), adiciona 55
    if (cleaned.length === 10) {
      return '55' + cleaned;
    }
    
    // Caso contrário, tenta adicionar 55 se não tiver
    if (!cleaned.startsWith('55') && cleaned.length > 0) {
      return '55' + cleaned;
    }
    
    return cleaned;
  };

  // ============================================
  // CARREGAR CONTATOS DO MONGODB
  // ============================================
  const loadContacts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts`);
      if (response.ok) {
        const data = await response.json();
        const formatted = data.map((c: any) => ({
          id: c._id,
          name: c.name,
          phone: c.phone,
          tags: c.tags || [],
          status: c.status,
          lastInteraction: c.lastInteraction ? new Date(c.lastInteraction) : undefined,
        }));
        setContacts(formatted);
        console.log(`✅ ${formatted.length} contatos carregados do MongoDB`);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar contatos:', error);
      alert('Erro ao carregar contatos. Verifique se o backend está rodando.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  // ============================================
  // CRIAR CONTATO
  // ============================================
  const handleCreateContact = async () => {
    if (!newContactData.name.trim() || !newContactData.phone.trim()) {
      alert('⚠️ Preencha nome e telefone!');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newContactData.name.trim(),
          phone: normalizePhone(newContactData.phone),
          tags: newContactData.tags ? newContactData.tags.split(',').map(t => t.trim()) : [],
          status: ContactStatus.UNKNOWN,
        }),
      });

      if (response.ok) {
        alert('✅ Contato criado com sucesso!');
        setIsCreating(false);
        setNewContactData({ name: '', phone: '', tags: '' });
        await loadContacts();
      } else {
        const error = await response.json();
        alert(`❌ Erro: ${error.error || 'Não foi possível criar o contato'}`);
      }
    } catch (error) {
      console.error('Erro ao criar contato:', error);
      alert('❌ Erro ao criar contato');
    }
  };

  // ============================================
  // ATUALIZAR CONTATO
  // ============================================
  const handleUpdateContact = async () => {
    if (!editingContact) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts/${editingContact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editData.name.trim(),
          phone: normalizePhone(editData.phone),
          tags: editData.tags ? editData.tags.split(',').map(t => t.trim()) : [],
        }),
      });

      if (response.ok) {
        alert('✅ Contato atualizado!');
        setEditingContact(null);
        await loadContacts();
      } else {
        alert('❌ Erro ao atualizar contato');
      }
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      alert('❌ Erro ao atualizar contato');
    }
  };

  // ============================================
  // DELETAR CONTATO
  // ============================================
  const handleDeleteContact = async (contactId: string, contactName: string) => {
    if (!confirm(`🗑️ Deseja realmente excluir "${contactName}"?`)) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts/${contactId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('✅ Contato excluído!');
        await loadContacts();
      } else {
        alert('❌ Erro ao excluir contato');
      }
    } catch (error) {
      console.error('Erro ao deletar:', error);
      alert('❌ Erro ao excluir contato');
    }
  };

  // ============================================
  // DELETAR CONTATOS SELECIONADOS
  // ============================================
  const handleDeleteSelected = async () => {
    if (selectedContacts.size === 0) {
      alert('⚠️ Nenhum contato selecionado!');
      return;
    }

    if (
      !confirm(
        `🗑️ Deseja excluir ${selectedContacts.size} contato(s) selecionado(s)?\n\nEsta ação não pode ser desfeita!`,
      )
    ) {
      return;
    }

    let deleted = 0;
    for (const contactId of selectedContacts) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/contacts/${contactId}`, {
          method: 'DELETE',
        });
        if (response.ok) deleted++;
      } catch (error) {
        console.error('Erro ao deletar:', error);
      }
    }

    alert(`✅ ${deleted} contato(s) excluído(s)!`);
    setSelectedContacts(new Set());
    setSelectAll(false);
    await loadContacts();
  };

  // ============================================
  // BLOQUEAR/DESBLOQUEAR CONTATO
  // ============================================
  const handleToggleBlock = async (contact: Contact) => {
    const newStatus =
      contact.status === ContactStatus.BLOCKED ? ContactStatus.UNKNOWN : ContactStatus.BLOCKED;
    const action = newStatus === ContactStatus.BLOCKED ? 'bloquear' : 'desbloquear';

    if (!confirm(`Deseja ${action} "${contact.name}"?`)) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        alert(`✅ Contato ${action === 'bloquear' ? 'bloqueado' : 'desbloqueado'}!`);
        await loadContacts();
      } else {
        alert(`❌ Erro ao ${action} contato`);
      }
    } catch (error) {
      console.error('Erro:', error);
      alert(`❌ Erro ao ${action} contato`);
    }
  };

  // ============================================
  // DELETAR INVÁLIDOS
  // ============================================
  const handleDeleteInvalidContacts = async () => {
    const invalidContacts = contacts.filter(c => c.status === ContactStatus.INVALID);

    if (invalidContacts.length === 0) {
      alert('✅ Não há contatos inválidos para excluir!');
      return;
    }

    if (
      !confirm(
        `🗑️ Deseja excluir ${invalidContacts.length} contato(s) inválido(s)?\n\nEsta ação não pode ser desfeita!`,
      )
    ) {
      return;
    }

    let deleted = 0;
    for (const contact of invalidContacts) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/contacts/${contact.id}`, {
          method: 'DELETE',
        });
        if (response.ok) deleted++;
      } catch (error) {
        console.error('Erro ao deletar:', error);
      }
    }

    alert(`✅ ${deleted} contato(s) excluído(s)!`);
    await loadContacts();
  };

  // ============================================
  // VERIFICAR WHATSAPP EM LOTE
  // ============================================
  const handleCheckWhatsApp = async () => {
    const unknownContacts = contacts.filter(c => c.status === ContactStatus.UNKNOWN);

    if (unknownContacts.length === 0) {
      alert('✅ Não há contatos pendentes de verificação!');
      return;
    }

    if (
      !confirm(
        `📱 Deseja verificar ${unknownContacts.length} número(s) no WhatsApp?\n\nIsso pode levar alguns minutos.`,
      )
    ) {
      return;
    }

    setIsChecking(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts/check-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: unknownContacts.map(c => ({ id: c.id, phone: c.phone })),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(
          `✅ Verificação concluída!\n\n` +
            `✓ Válidos: ${result.valid || 0}\n` +
            `✗ Inválidos: ${result.invalid || 0}`,
        );
        await loadContacts();
      } else {
        alert('❌ Erro ao verificar números no WhatsApp');
      }
    } catch (error) {
      console.error('Erro ao verificar:', error);
      alert('❌ Erro ao verificar números no WhatsApp');
    } finally {
      setIsChecking(false);
    }
  };

  // ============================================
  // VERIFICAR WHATSAPP INDIVIDUAL
  // ============================================
  const handleCheckSingleWhatsApp = async (contact: Contact) => {
    if (
      !confirm(
        `📱 Deseja verificar se o número ${contact.phone} tem WhatsApp?`,
      )
    ) {
      return;
    }

    setCheckingPhone(contact.id);

    try {
      const response = await fetch(`${API_BASE_URL}/api/contacts/check-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: [{ id: contact.id, phone: contact.phone }],
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const status = result.valid > 0 ? 'válido' : 'inválido';
        alert(`✅ Verificação concluída!\n\nO número está ${status}.`);
        await loadContacts();
      } else {
        alert('❌ Erro ao verificar número no WhatsApp');
      }
    } catch (error) {
      console.error('Erro ao verificar:', error);
      alert('❌ Erro ao verificar número no WhatsApp');
    } finally {
      setCheckingPhone(null);
    }
  };

  // ============================================
  // IMPORTAR CONTATOS (CSV, XLS, XLSX)
  // Colunas obrigatórias: nome, telefone, segmento
  // ============================================
  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();

      let contactsToImport: {
        name: string;
        phone: string;
        tags: string[];
        status: ContactStatus;
      }[] = [];

      // ---------- CSV/TXT ----------
      if (ext === 'csv' || ext === 'txt') {
        const arrayBuffer = await file.arrayBuffer();
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(arrayBuffer);
        const lines = text.split(/\r?\n/).filter(line => line.trim());

        if (lines.length < 2) {
          alert('❌ Arquivo vazio ou inválido');
          return;
        }

        const headerRow = lines[0];
        const header =
          headerRow.split(';').length > 1 ? headerRow.split(';') : headerRow.split(',');
        const lowerHeader = header.map(h => h.toLowerCase().trim());

        const idxNome = lowerHeader.indexOf('nome');
        const idxTelefone = lowerHeader.indexOf('telefone');
        const idxSegmento = lowerHeader.indexOf('segmento');

        if (idxNome === -1 || idxTelefone === -1 || idxSegmento === -1) {
          alert('❌ Arquivo deve ter as colunas: nome, telefone e segmento');
          return;
        }

        const dataLines = lines.slice(1);

        contactsToImport = dataLines
          .map(line => {
            const cols =
              line.split(';').length > 1 ? line.split(';') : line.split(',');

            const nome = (cols[idxNome] || '').trim();
            const telefone = (cols[idxTelefone] || '').trim();
            const segmento = (cols[idxSegmento] || '').trim();

            if (!telefone) return null;

            return {
              name: nome || 'Sem Nome',
              phone: normalizePhone(telefone),
              tags: segmento ? [segmento] : [],
              status: ContactStatus.UNKNOWN,
            };
          })
          .filter(
            (
              c,
            ): c is {
              name: string;
              phone: string;
              tags: string[];
              status: ContactStatus;
            } => !!c,
          );
      }
      // ---------- XLS / XLSX ----------
      else if (ext === 'xls' || ext === 'xlsx') {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array', codepage: 65001 }); // UTF-8
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

        if (json.length < 2) {
          alert('❌ Arquivo vazio ou inválido');
          return;
        }

        const header = json[0].map((h: any) => String(h || '').toLowerCase().trim());
        const idxNome = header.indexOf('nome');
        const idxTelefone = header.indexOf('telefone');
        const idxSegmento = header.indexOf('segmento');

        if (idxNome === -1 || idxTelefone === -1 || idxSegmento === -1) {
          alert('❌ Arquivo deve ter as colunas: nome, telefone e segmento');
          return;
        }

        const dataRows = json.slice(1);

        contactsToImport = dataRows
          .map((row: any[]) => {
            const nome = (row[idxNome] || '').toString().trim();
            const telefone = (row[idxTelefone] || '').toString().trim();
            const segmento = (row[idxSegmento] || '').toString().trim();

            if (!telefone) return null;

            return {
              name: nome || 'Sem Nome',
              phone: normalizePhone(telefone),
              tags: segmento ? [segmento] : [],
              status: ContactStatus.UNKNOWN,
            };
          })
          .filter(
            (
              c,
            ): c is {
              name: string;
              phone: string;
              tags: string[];
              status: ContactStatus;
            } => !!c,
          );
      } else {
        alert('❌ Formato de arquivo não suportado. Use CSV, XLS ou XLSX.');
        return;
      }

      if (contactsToImport.length === 0) {
        alert('❌ Nenhum contato válido encontrado no arquivo');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/contacts/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: contactsToImport }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(
          `✅ ${result.count} contato(s) importado(s)!${
            result.duplicates ? `\n⚠️ ${result.duplicates} duplicado(s) ignorado(s)` : ''
          }\n\n📱 Use o botão "Verificar WhatsApp" para validar os números.`,
        );
        await loadContacts();
      } else {
        alert('❌ Erro ao importar contatos');
      }
    } catch (error) {
      console.error('Erro ao importar:', error);
      alert('❌ Erro ao processar arquivo');
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  // ============================================
  // EXPORTAR CSV
  // ============================================
  const handleExportCSV = () => {
    const filtered = filteredContacts;

    if (filtered.length === 0) {
      alert('❌ Nenhum contato para exportar');
      return;
    }

    const csvContent = [
      ['Nome', 'Telefone', 'Tags', 'Status'].join(','),
      ...filtered.map(c =>
        [c.name, c.phone, c.tags.join('|'), c.status].join(','),
      ),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contatos-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    alert(`✅ ${filtered.length} contato(s) exportado(s)!`);
  };

  // ============================================
  // SELEÇÃO MÚLTIPLA
  // ============================================
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectContact = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
    setSelectAll(newSelected.size === filteredContacts.length);
  };

  // ============================================
  // FILTROS
  // ============================================
  const filteredContacts = contacts.filter(contact => {
    if (activeTab === 'ACTIVE' && contact.status === ContactStatus.BLOCKED) return false;
    if (activeTab === 'BLACKLIST' && contact.status !== ContactStatus.BLOCKED) return false;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        contact.name.toLowerCase().includes(search) ||
        contact.phone.includes(search) ||
        contact.tags.some(tag => tag.toLowerCase().includes(search))
      );
    }

    return true;
  });

  // ============================================
  // ESTATÍSTICAS
  // ============================================
  const stats = {
    total: contacts.length,
    valid: contacts.filter(c => c.status === ContactStatus.VALID).length,
    invalid: contacts.filter(c => c.status === ContactStatus.INVALID).length,
    blocked: contacts.filter(c => c.status === ContactStatus.BLOCKED).length,
    unknown: contacts.filter(c => c.status === ContactStatus.UNKNOWN).length,
  };

  // ============================================
  // RENDER
  // ============================================
  const StatusBadge = ({ status }: { status: ContactStatus }) => {
    const styles = {
      [ContactStatus.VALID]: 'bg-green-500/20 text-green-400 border-green-500',
      [ContactStatus.INVALID]: 'bg-red-500/20 text-red-400 border-red-500',
      [ContactStatus.BLOCKED]: 'bg-orange-500/20 text-orange-400 border-orange-500',
      [ContactStatus.UNKNOWN]: 'bg-gray-500/20 text-gray-400 border-gray-500',
    };

    const labels = {
      [ContactStatus.VALID]: '✓ Válido',
      [ContactStatus.INVALID]: '✗ Inválido',
      [ContactStatus.BLOCKED]: '🚫 Bloqueado',
      [ContactStatus.UNKNOWN]: '⏳ Pendente',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs border ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-primary" size={48} />
        <span className="ml-4 text-xl text-gray-400">Carregando contatos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white">Gerenciar Contatos</h2>
          <p className="text-gray-400 mt-1">
            Base de clientes e lista de bloqueio (descadastrados).
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={loadContacts}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>

          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Plus size={16} />
            Novo
          </button>

          <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer">
            <Upload size={16} />
            {isImporting ? 'Importando...' : 'Importar'}
            <input
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={handleImportFile}
              disabled={isImporting}
              className="hidden"
            />
          </label>

          <button
            onClick={handleExportCSV}
            disabled={filteredContacts.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            Exportar
          </button>

          <button
            onClick={handleCheckWhatsApp}
            disabled={isChecking || stats.unknown === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <CheckCircle size={16} className={isChecking ? 'animate-spin' : ''} />
            {isChecking ? 'Verificando...' : `Verificar WhatsApp (${stats.unknown})`}
          </button>
        </div>
      </header>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-green-500/10 border border-green-500 rounded-xl p-4">
          <div className="text-3xl font-bold text-green-400">{stats.valid}</div>
          <div className="text-sm text-gray-400 mt-1">✓ VÁLIDOS</div>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500 rounded-xl p-4">
          <div className="text-3xl font-bold text-yellow-400">{stats.unknown}</div>
          <div className="text-sm text-gray-400 mt-1">⏳ PENDENTES</div>
        </div>

        <div className="bg-red-500/10 border border-red-500 rounded-xl p-4">
          <div className="text-3xl font-bold text-red-400">{stats.invalid}</div>
          <div className="text-sm text-gray-400 mt-1">✗ INVÁLIDOS</div>
        </div>

        <div className="bg-orange-500/10 border border-orange-500 rounded-xl p-4">
          <div className="text-3xl font-bold text-orange-400">{stats.blocked}</div>
          <div className="text-sm text-gray-400 mt-1">🚫 BLOQUEADOS</div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500 rounded-xl p-4">
          <div className="text-3xl font-bold text-blue-400">{stats.total}</div>
          <div className="text-sm text-gray-400 mt-1">📊 TOTAL</div>
        </div>
      </div>

      {/* Abas e Ações */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('ACTIVE')}
            className={`px-6 py-2 rounded-lg transition-colors ${
              activeTab === 'ACTIVE'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <CheckCircle size={16} className="inline mr-2" />
            Base Ativa
          </button>

          <button
            onClick={() => setActiveTab('BLACKLIST')}
            className={`px-6 py-2 rounded-lg transition-colors ${
              activeTab === 'BLACKLIST'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <Ban size={16} className="inline mr-2" />
            Blacklist
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDeleteSelected}
            disabled={selectedContacts.size === 0}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 size={16} className="inline mr-2" />
            Excluir Selecionados ({selectedContacts.size})
          </button>

          <button
            onClick={handleDeleteInvalidContacts}
            disabled={stats.invalid === 0}
            className="px-4 py-2 bg-gray-800 hover:bg-red-600 text-gray-400 hover:text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 size={16} className="inline mr-2" />
            Excluir Inválidos ({stats.invalid})
          </button>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          size={20}
        />
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou tag..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
        />
      </div>

      {/* Tabela */}
      <div className="bg-card border border-gray-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="p-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="p-4 text-left text-gray-400 font-medium">NOME</th>
                <th className="p-4 text-left text-gray-400 font-medium">TELEFONE</th>
                <th className="p-4 text-left text-gray-400 font-medium">STATUS</th>
                <th className="p-4 text-left text-gray-400 font-medium">TAGS</th>
                <th className="p-4 text-center text-gray-400 font-medium">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    {searchTerm
                      ? '🔍 Nenhum contato encontrado'
                      : '📋 Nenhum contato cadastrado'}
                  </td>
                </tr>
              ) : (
                filteredContacts.map(contact => (
                  <tr
                    key={contact.id}
                    className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedContacts.has(contact.id)}
                        onChange={() => handleSelectContact(contact.id)}
                        className="rounded"
                      />
                    </td>

                    <td className="p-4 text-white font-medium">{contact.name}</td>

                    <td className="p-4 text-gray-300 font-mono">{contact.phone}</td>

                    <td className="p-4">
                      <StatusBadge status={contact.status} />
                    </td>

                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs border border-blue-500/50"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        {contact.status === ContactStatus.UNKNOWN && (
                          <button
                            onClick={() => handleCheckSingleWhatsApp(contact)}
                            disabled={checkingPhone === contact.id}
                            className="p-2 text-green-400 hover:bg-green-500/20 rounded transition-colors disabled:opacity-50"
                            title="Verificar WhatsApp"
                          >
                            {checkingPhone === contact.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Phone size={16} />
                            )}
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setEditingContact(contact);
                            setEditData({
                              name: contact.name,
                              phone: contact.phone,
                              tags: contact.tags.join(', '),
                            });
                          }}
                          className="p-2 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>

                        <button
                          onClick={() => handleToggleBlock(contact)}
                          className={`p-2 rounded transition-colors ${
                            contact.status === ContactStatus.BLOCKED
                              ? 'text-green-400 hover:bg-green-500/20'
                              : 'text-orange-400 hover:bg-orange-500/20'
                          }`}
                          title={
                            contact.status === ContactStatus.BLOCKED
                              ? 'Desbloquear'
                              : 'Bloquear'
                          }
                        >
                          <Ban size={16} />
                        </button>

                        <button
                          onClick={() => handleDeleteContact(contact.id, contact.name)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Criação */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Novo Contato</h3>
              <button
                onClick={() => setIsCreating(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Nome</label>
                <input
                  type="text"
                  value={newContactData.name}
                  onChange={e =>
                    setNewContactData({ ...newContactData, name: e.target.value })
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  placeholder="Nome do contato"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Telefone</label>
                <input
                  type="text"
                  value={newContactData.phone}
                  onChange={e =>
                    setNewContactData({ ...newContactData, phone: e.target.value })
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  placeholder="11999999999"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Tags (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={newContactData.tags}
                  onChange={e =>
                    setNewContactData({ ...newContactData, tags: e.target.value })
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  placeholder="cliente, vip"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCreateContact}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Save size={16} className="inline mr-2" />
                  Criar
                </button>
                <button
                  onClick={() => setIsCreating(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {editingContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Editar Contato</h3>
              <button
                onClick={() => setEditingContact(null)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Nome</label>
                <input
                  type="text"
                  value={editData.name}
                  onChange={e => setEditData({ ...editData, name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Telefone</label>
                <input
                  type="text"
                  value={editData.phone}
                  onChange={e => setEditData({ ...editData, phone: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Tags (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={editData.tags}
                  onChange={e => setEditData({ ...editData, tags: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleUpdateContact}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Save size={16} className="inline mr-2" />
                  Salvar
                </button>
                <button
                  onClick={() => setEditingContact(null)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contacts;
