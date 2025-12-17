import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Send, Users, AlertCircle, Smartphone, RefreshCw } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalContacts: 0,
    blockedContacts: 0,
    validContacts: 0,
    onlineAccounts: 0,
    totalMessages: 0,
    activeCampaigns: 0
  });

  // ✅ CORRIGIDO: Estados para dados dos gráficos
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dados vazios como fallback
  const emptyWeeklyData = [
    { name: 'Seg', envios: 0, recebidos: 0 },
    { name: 'Ter', envios: 0, recebidos: 0 },
    { name: 'Qua', envios: 0, recebidos: 0 },
    { name: 'Qui', envios: 0, recebidos: 0 },
    { name: 'Sex', envios: 0, recebidos: 0 },
    { name: 'Sab', envios: 0, recebidos: 0 },
    { name: 'Dom', envios: 0, recebidos: 0 },
  ];

  const emptyTrendData = [
    { name: 'Seg', cadastros: 0 },
    { name: 'Ter', cadastros: 0 },
    { name: 'Qua', cadastros: 0 },
    { name: 'Qui', cadastros: 0 },
    { name: 'Sex', cadastros: 0 },
    { name: 'Sab', cadastros: 0 },
    { name: 'Dom', cadastros: 0 },
  ];

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/stats`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar estatísticas');
      }

      const data = await response.json();
      setStats(data);

      // ✅ CORRIGIDO: Atualizar dados dos gráficos com dados reais
      if (data.weeklyActivity && Array.isArray(data.weeklyActivity)) {
        setWeeklyData(data.weeklyActivity);
      } else {
        setWeeklyData(emptyWeeklyData);
      }

      if (data.registrationTrend && Array.isArray(data.registrationTrend)) {
        setTrendData(data.registrationTrend);
      } else {
        setTrendData(emptyTrendData);
      }

    } catch (err: any) {
      console.error('Erro ao carregar dashboard:', err);
      setError(err.message);
      // Manter dados vazios em caso de erro
      setWeeklyData(emptyWeeklyData);
      setTrendData(emptyTrendData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();

    // Atualizar a cada 30 segundos
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const StatCard = ({ title, value, icon: Icon, color, subtext, loading }: any) => (
    <div className="bg-card border border-gray-700 rounded-2xl p-6 hover:border-gray-600 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          {loading ? (
            <div className="h-8 w-16 bg-gray-700 animate-pulse rounded mt-1"></div>
          ) : (
            <h3 className="text-2xl font-bold text-white mt-1">{value.toLocaleString('pt-BR')}</h3>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
      <p className="text-xs text-gray-500">{subtext}</p>
    </div>
  );

  // ✅ Verificar se há dados reais nos gráficos
  const hasWeeklyData = weeklyData.some(d => d.envios > 0 || d.recebidos > 0);
  const hasTrendData = trendData.some(d => d.cadastros > 0);

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-white">Visão Geral</h2>
        <button
          onClick={loadStats}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-400">
          ⚠️ {error} - Verifique se o backend está rodando em {API_BASE_URL}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Contatos Ativos" 
          value={stats.totalContacts - stats.blockedContacts} 
          icon={Users} 
          color="bg-green-500" 
          subtext="Prontos para receber"
          loading={loading}
        />
        <StatCard 
          title="Blacklist (Bloqueados)" 
          value={stats.blockedContacts} 
          icon={AlertCircle} 
          color="bg-red-500" 
          subtext="Responderam 'Sair'"
          loading={loading}
        />
        <StatCard 
          title="Contas Online" 
          value={stats.onlineAccounts} 
          icon={Smartphone} 
          color="bg-blue-500" 
          subtext="Instâncias conectadas"
          loading={loading}
        />
        <StatCard 
          title="Total de Mensagens" 
          value={stats.totalMessages}
          icon={Send} 
          color="bg-purple-500" 
          subtext="Histórico completo"
          loading={loading}
        />
      </div>

      {/* Aviso quando não há dados */}
      {!loading && stats.totalContacts === 0 && stats.totalMessages === 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500 rounded-lg p-4 text-yellow-400">
          ℹ️ Ainda não há dados suficientes para gerar os gráficos. Adicione contatos e mensagens para visualizar as estatísticas.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ✅ CORRIGIDO: Usar weeklyData em vez de emptyWeeklyData */}
        <div className="bg-card border border-gray-700 rounded-2xl p-6 flex flex-col hover:border-gray-600 transition-colors">
          <h3 className="text-lg font-semibold text-white mb-6">Atividade Semanal</h3>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-gray-500">Carregando dados...</div>
            </div>
          ) : (
            <div className="flex-1 w-full min-h-[300px]">
              {!hasWeeklyData ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <p className="mb-2">📊 Nenhuma mensagem registrada</p>
                    <p className="text-sm">Os dados aparecerão quando houver atividade</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis dataKey="name" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#374151', color: '#fff' }}
                      cursor={{ fill: '#374151', opacity: 0.2 }}
                    />
                    <Bar dataKey="envios" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Enviadas" />
                    <Bar dataKey="recebidos" fill="#10b981" radius={[4, 4, 0, 0]} name="Recebidas" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>

        {/* ✅ CORRIGIDO: Usar trendData em vez de emptyTrendData */}
        <div className="bg-card border border-gray-700 rounded-2xl p-6 flex flex-col hover:border-gray-600 transition-colors">
          <h3 className="text-lg font-semibold text-white mb-6">Tendência de Cadastro</h3>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-gray-500">Carregando dados...</div>
            </div>
          ) : (
            <div className="flex-1 w-full min-h-[300px]">
              {!hasTrendData ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <p className="mb-2">📈 Nenhum contato cadastrado</p>
                    <p className="text-sm">Importe ou adicione contatos para ver a tendência</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis dataKey="name" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#374151', color: '#fff' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cadastros" 
                      stroke="#8b5cf6" 
                      strokeWidth={3} 
                      dot={{r: 4}} 
                      name="Cadastros"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cards informativos adicionais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-gray-700 rounded-2xl p-6">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Taxa de Bloqueio</h4>
          <p className="text-2xl font-bold text-white">
            {stats.totalContacts > 0 
              ? ((stats.blockedContacts / stats.totalContacts) * 100).toFixed(1) 
              : 0}%
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {stats.blockedContacts} de {stats.totalContacts} contatos
          </p>
        </div>

        <div className="bg-card border border-gray-700 rounded-2xl p-6">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Campanhas Ativas</h4>
          <p className="text-2xl font-bold text-white">{stats.activeCampaigns}</p>
          <p className="text-xs text-gray-500 mt-2">Em execução ou agendadas</p>
        </div>

        <div className="bg-card border border-gray-700 rounded-2xl p-6">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Contatos Válidos</h4>
          <p className="text-2xl font-bold text-white">{stats.validContacts}</p>
          <p className="text-xs text-gray-500 mt-2">Verificados e ativos</p>
        </div>
      </div>

      {/* Dica para começar */}
      {!loading && stats.totalContacts === 0 && (
        <div className="bg-blue-500/10 border border-blue-500 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-blue-400 mb-2">🚀 Primeiros Passos</h4>
          <p className="text-gray-300 mb-4">Seu sistema está pronto! Para começar a ver dados:</p>
          <ol className="list-decimal list-inside space-y-2 text-gray-400">
            <li>Vá em <strong className="text-white">Conexões</strong> e adicione uma conta WhatsApp</li>
            <li>Acesse <strong className="text-white">Contatos</strong> e importe ou adicione contatos manualmente</li>
            <li>Configure campanhas em <strong className="text-white">Disparos</strong></li>
            <li>Use o <strong className="text-white">Atendimento</strong> para gerenciar conversas</li>
          </ol>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
