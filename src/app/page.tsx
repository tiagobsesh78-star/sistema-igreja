"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase"; 
import { podeEditar, formatarPerfis } from "../lib/permissoes";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

// Função auxiliar que identifica links no texto
const renderComLinks = (texto: string) => {
  if (!texto) return null;
  const urlRegex = /((?:https?:\/\/|www\.)[^\s]+)/g;
  const partes = texto.split(urlRegex);
  return partes.map((parte, index) => {
    if (parte.match(urlRegex)) {
      const href = parte.startsWith("www.") ? `https://${parte}` : parte;
      return (
        <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all" onClick={(e) => e.stopPropagation()}>{parte}</a>
      );
    }
    return <span key={index}>{parte}</span>;
  });
};

const CORES_PIE = ['#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b'];

export default function Dashboard() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [perfisUsuario, setPerfisUsuario] = useState<string[]>([]); 
  const [usuarioInfo, setUsuarioInfo] = useState<any>(null);
  const [ehSede, setEhSede] = useState(false); 
  const [nomeSedeOficial, setNomeSedeOficial] = useState("Sede");
  
  // ==========================================
  // ESTADOS DO MULTI-TENANCY HIERÁRQUICO
  // ==========================================
  const [filtroCongregacao, setFiltroCongregacao] = useState("Sede"); 
  const [congregacoesDisponiveis, setCongregacoesDisponiveis] = useState<string[]>([]);
  const [dadosMembrosRaw, setDadosMembrosRaw] = useState<any[]>([]);
  const [programacoesRaw, setProgramacoesRaw] = useState<any[]>([]);
  const [financeiroRaw, setFinanceiroRaw] = useState<any[]>([]);
  const [visitantesRaw, setVisitantesRaw] = useState<any[]>([]);

  // Filtros de Gráficos
  const [periodoFinanceiro, setPeriodoFinanceiro] = useState(6); // 3, 6, 12

  // Estados de Membros
  const [stats, setStats] = useState({
    membros: 0, cadastrados: 0, criancas: 0, jovens: 0, ativos: 0, 
    adultos: 0, homens12Mais: 0, mulheres12Mais: 0, visitantesRecentes: 0
  });
  const [recentes, setRecentes] = useState<any[]>([]);
  const [aniversariantes, setAniversariantes] = useState<any[]>([]); 

  // Estados de Gráficos (Processados)
  const [dadosFinanceiros, setDadosFinanceiros] = useState<any[]>([]);
  const [dadosDemograficos, setDadosDemograficos] = useState<any[]>([]);

  // Estados de Programação
  const dataAtual = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(dataAtual.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(dataAtual.getFullYear());
  const [programacoes, setProgramacoes] = useState<any[]>([]);

  // Estados PIX
  const [modalPixAberto, setModalPixAberto] = useState(false);
  const [pixSede, setPixSede] = useState({ chave: "", qrCode: "" });
  const [pixFilhas, setPixFilhas] = useState<any[]>([]);
  const [chaveCopiada, setChaveCopiada] = useState(false);

  const meses = [
    { valor: 1, nome: "Janeiro" }, { valor: 2, nome: "Fevereiro" },
    { valor: 3, nome: "Março" }, { valor: 4, nome: "Abril" },
    { valor: 5, nome: "Maio" }, { valor: 6, nome: "Junho" },
    { valor: 7, nome: "Julho" }, { valor: 8, nome: "Agosto" },
    { valor: 9, nome: "Setembro" }, { valor: 10, nome: "Outubro" },
    { valor: 11, nome: "Novembro" }, { valor: 12, nome: "Dezembro" },
  ];

  // 1. BUSCA INTELIGENTE DE DADOS
  useEffect(() => {
    const userLocal = localStorage.getItem("usuarioLogado");
    if (!userLocal) { router.push("/login"); return; }

    const usuario = JSON.parse(userLocal);
    const igrejaId = usuario.igreja_id;
    setUsuarioInfo(usuario);
    setPerfisUsuario(formatarPerfis(usuario.perfis || usuario.nivel_acesso));

    async function carregarDadosDashboard() {
      try {
        const { data: resConfig } = await supabase
          .from("configuracao_igreja")
          .select("chave_pix, qr_code_pix, nome_igreja")
          .eq("igreja_id", igrejaId)
          .maybeSingle();

        const nomeOficial = resConfig?.nome_igreja?.trim() || "Sede";
        setNomeSedeOficial(nomeOficial);
        if (resConfig) setPixSede({ chave: resConfig.chave_pix || "", qrCode: resConfig.qr_code_pix || "" });

        const congUsuario = usuario.congregacao?.trim() || "";
        const congLow = congUsuario.toLowerCase();
        const isUserSede = !congLow || congLow === "sede" || congLow === "matriz" || congLow === "geral" || congLow === nomeOficial.toLowerCase();
        
        setEhSede(isUserSede);
        setFiltroCongregacao(isUserSede ? "Sede" : congUsuario);

        // Data limite para histórico financeiro e visitantes (12 meses atrás)
        const dataAnoPassado = new Date();
        dataAnoPassado.setMonth(dataAnoPassado.getMonth() - 12);
        const dataCorteISO = dataAnoPassado.toISOString().split('T')[0];

        let queryMembros = supabase.from("membros").select("*").eq("igreja_id", igrejaId).order("id", { ascending: false });
        let queryProg = supabase.from("programacao").select("*").eq("igreja_id", igrejaId).order("horario", { ascending: true });
        let queryFilhas = supabase.from("igrejas_filhas").select("nome, chave_pix, qr_code_pix").eq("igreja_id", igrejaId);
        let queryFin = supabase.from("tesouraria_lancamentos").select("data, ofertas, dizimos, oferta_especial, saidas, congregacao").eq("igreja_id", igrejaId).eq("excluido", false).gte("data", dataCorteISO);
        let queryVis = supabase.from("visitantes").select("data_visita, congregacao").eq("igreja_id", igrejaId).gte("data_visita", dataCorteISO);

        if (!isUserSede) {
          queryMembros = queryMembros.eq("congregacao", congUsuario);
          queryProg = queryProg.eq("congregacao", congUsuario);
          queryFilhas = queryFilhas.eq("nome", congUsuario);
          queryFin = queryFin.eq("congregacao", congUsuario);
          queryVis = queryVis.eq("congregacao", congUsuario);
        }

        const [resMembros, resProg, resFilhas, resFin, resVis] = await Promise.all([queryMembros, queryProg, queryFilhas, queryFin, queryVis]);

        if (resFilhas.data) setPixFilhas(resFilhas.data);
        if (resProg.data) setProgramacoesRaw(resProg.data);
        if (resFin.data) setFinanceiroRaw(resFin.data);
        if (resVis.data) setVisitantesRaw(resVis.data);

        if (resMembros.data) {
          setDadosMembrosRaw(resMembros.data);
          if (isUserSede) {
            const filiais = new Set<string>();
            resMembros.data.forEach(m => {
              const c = m.congregacao?.trim();
              if (c && c.toLowerCase() !== "sede" && c.toLowerCase() !== nomeOficial.toLowerCase()) filiais.add(c);
            });
            resFilhas.data?.forEach(f => {
              const c = f.nome?.trim();
              if (c && c.toLowerCase() !== "sede" && c.toLowerCase() !== nomeOficial.toLowerCase()) filiais.add(c);
            });
            setCongregacoesDisponiveis(Array.from(filiais).sort());
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
      } finally {
        setCarregando(false);
      }
    }
    
    if (igrejaId) carregarDadosDashboard();
    else setCarregando(false);
  }, [router]);


  // 2. PROCESSAMENTO LOCAL (Aplica Filtros na Tela)
  useEffect(() => {
    if (!dadosMembrosRaw) return;

    const isSedeItem = (c: string) => {
      const cong = c?.trim()?.toLowerCase() || "";
      return !cong || cong === "sede" || cong === "matriz" || cong === "geral" || cong === nomeSedeOficial.toLowerCase();
    };

    const membrosFiltrados = filtroCongregacao === "Todas"
      ? dadosMembrosRaw
      : dadosMembrosRaw.filter(m => filtroCongregacao === "Sede" ? isSedeItem(m.congregacao) : m.congregacao?.trim() === filtroCongregacao);

    const financeiroFiltrado = filtroCongregacao === "Todas"
      ? financeiroRaw
      : financeiroRaw.filter(f => filtroCongregacao === "Sede" ? isSedeItem(f.congregacao) : f.congregacao?.trim() === filtroCongregacao);

    const visitantesFiltrados = filtroCongregacao === "Todas"
      ? visitantesRaw
      : visitantesRaw.filter(v => filtroCongregacao === "Sede" ? isSedeItem(v.congregacao) : v.congregacao?.trim() === filtroCongregacao);

    const calcularIdade = (dataNasc: string) => {
      if (!dataNasc) return -1;
      const [ano, mes, dia] = dataNasc.split("-").map(Number);
      const hoje = new Date();
      let idade = hoje.getFullYear() - ano;
      if (hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia)) idade--;
      return idade;
    };

    let totalMembros = 0, totalCriancas = 0, totalJovens = 0, totalAdultos = 0;
    let totalHomens12Mais = 0, totalMulheres12Mais = 0;

    membrosFiltrados.forEach(m => {
      const perfis = formatarPerfis(m.perfis || m.nivel_acesso);
      if (!perfis.includes("Congregado")) totalMembros++;

      const idade = calcularIdade(m.data_nascimento);
      if (idade >= 0 && idade <= 11) totalCriancas++;
      else if (idade >= 12 && idade <= 18) totalJovens++;
      if (idade > 18) totalAdultos++;
      
      if (idade >= 12) {
        if (m.genero === "Masculino") totalHomens12Mais++;
        if (m.genero === "Feminino") totalMulheres12Mais++;
      }
    });

    const hojeData = new Date();
    const data30DiasAtras = new Date();
    data30DiasAtras.setDate(data30DiasAtras.getDate() - 30);
    
    const visRecentesCount = visitantesFiltrados.filter(v => {
      if (!v.data_visita) return false;
      const d = new Date(v.data_visita);
      // Considerando que data_visita pode não ter timezone, vamos comparar usando a data local truncada
      const dCortada = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const hojeCortada = new Date(hojeData.getFullYear(), hojeData.getMonth(), hojeData.getDate());
      const atrasCortada = new Date(data30DiasAtras.getFullYear(), data30DiasAtras.getMonth(), data30DiasAtras.getDate());
      return dCortada >= atrasCortada && dCortada <= hojeCortada;
    }).length;

    setStats({ 
      membros: totalMembros, 
      cadastrados: membrosFiltrados.length, 
      criancas: totalCriancas, 
      jovens: totalJovens, 
      ativos: membrosFiltrados.filter((m) => m.status === "Ativo").length,
      adultos: totalAdultos,
      homens12Mais: totalHomens12Mais,
      mulheres12Mais: totalMulheres12Mais,
      visitantesRecentes: visRecentesCount
    });

    // Gráfico Demográfico
    setDadosDemograficos([
      { name: 'Crianças (0-11)', value: totalCriancas },
      { name: 'Jovens (12-18)', value: totalJovens },
      { name: 'Adultos (18+)', value: totalAdultos }
    ].filter(d => d.value > 0));

    // Gráfico Financeiro
    const mesesGrafico: {ano: number, mes: number, label: string, entradas: number, saidas: number}[] = [];
    for (let i = periodoFinanceiro - 1; i >= 0; i--) {
      const d = new Date(hojeData.getFullYear(), hojeData.getMonth() - i, 1);
      mesesGrafico.push({
        ano: d.getFullYear(),
        mes: d.getMonth() + 1,
        label: `${d.toLocaleString('pt-BR', { month: 'short' })}/${d.getFullYear().toString().slice(2)}`,
        entradas: 0,
        saidas: 0
      });
    }

    financeiroFiltrado.forEach(lanc => {
      if (!lanc.data) return;
      const [anoL, mesL] = lanc.data.split('-');
      const item = mesesGrafico.find(m => m.ano === Number(anoL) && m.mes === Number(mesL));
      if (item) {
        item.entradas += Number(lanc.ofertas || 0) + Number(lanc.dizimos || 0) + Number(lanc.oferta_especial || 0);
        item.saidas += Number(lanc.saidas || 0);
      }
    });

    setDadosFinanceiros(mesesGrafico.map(m => ({
      name: m.label,
      "Entradas": m.entradas,
      "Saídas": m.saidas
    })));

    setRecentes(membrosFiltrados.slice(0, 5));

    const mesAtual = hojeData.getMonth() + 1;
    const diaAtual = hojeData.getDate();

    setAniversariantes(membrosFiltrados.filter((m) => {
      if (!m.data_nascimento) return false;
      const partes = m.data_nascimento.split('-');
      return parseInt(partes[1], 10) === mesAtual && parseInt(partes[2], 10) >= diaAtual;
    }).sort((a, b) => parseInt(a.data_nascimento.split('-')[2], 10) - parseInt(b.data_nascimento.split('-')[2], 10)));

    setProgramacoes(filtroCongregacao === "Todas" ? programacoesRaw : programacoesRaw.filter(p => filtroCongregacao === "Sede" ? isSedeItem(p.congregacao) : p.congregacao?.trim() === filtroCongregacao));

  }, [filtroCongregacao, dadosMembrosRaw, programacoesRaw, financeiroRaw, visitantesRaw, nomeSedeOficial, periodoFinanceiro]);

  // PIX Dinâmico
  let pixAtual = pixSede;
  if (filtroCongregacao !== "Sede" && filtroCongregacao !== "Todas") {
    const filha = pixFilhas.find(f => f.nome === filtroCongregacao);
    if (filha) pixAtual = { chave: filha.chave_pix || "", qrCode: filha.qr_code_pix || "" };
    else pixAtual = { chave: "", qrCode: "" };
  }

  const copiarChavePix = () => {
    if (!pixAtual.chave) return;
    navigator.clipboard.writeText(pixAtual.chave);
    setChaveCopiada(true);
    setTimeout(() => setChaveCopiada(false), 2000); 
  };

  const programacoesFixas = programacoes.filter((p) => p.tipo === "Fixa");
  const programacoesDoMes = programacoes.filter((p) => {
    if (p.tipo === "Fixa" || !p.data) return false;
    const d = new Date(p.data + "T00:00:00");
    return d.getMonth() + 1 === mesSelecionado && d.getFullYear() === anoSelecionado;
  }).sort((a, b) => new Date(a.data + "T00:00:00").getTime() - new Date(b.data + "T00:00:00").getTime());

  // Permissões
  const podeAdicionarMembro = podeEditar(perfisUsuario, 'membros');
  const ehLideranca = perfisUsuario.some(p => ["Secretário", "Pastor/Presbítero", "Líder", "Administrador"].includes(p));
  const ehPastor = perfisUsuario.some(p => ["Pastor/Presbítero", "Administrador"].includes(p));

  if (carregando) return <div className="flex h-screen items-center justify-center"><div className="text-xl text-blue-500 font-medium animate-pulse">Carregando painel de visão estratégica...</div></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-10 relative">
      
      {/* 1. CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">Visão Estratégica</h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">Acompanhe a saúde da sua igreja em tempo real.</p>
        </div>
        
        <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-3 w-full md:w-auto">
          {ehSede && congregacoesDisponiveis.length > 0 && (
            <select
              value={filtroCongregacao}
              onChange={(e) => setFiltroCongregacao(e.target.value)}
              className="px-4 py-2.5 bg-white border border-gray-200 text-gray-800 font-bold text-sm rounded-xl hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all shadow-sm cursor-pointer min-w-[200px]"
            >
              <option value="Sede">🏢 {nomeSedeOficial}</option>
              <option value="Todas">🌍 Todas Congregações</option>
              {congregacoesDisponiveis.map(c => <option key={c} value={c}>📍 {c}</option>)}
            </select>
          )}

          <Link href="/programacao" className="px-5 py-2.5 bg-indigo-50 text-indigo-700 font-bold text-sm rounded-xl hover:bg-indigo-100 transition shadow-sm border border-indigo-100">Agenda</Link>
          <Link href="/visitantes" className="px-5 py-2.5 bg-rose-50 text-rose-700 font-bold text-sm rounded-xl hover:bg-rose-100 transition shadow-sm border border-rose-100">Visitantes</Link>
          <button onClick={() => setModalPixAberto(true)} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm rounded-xl hover:from-emerald-600 hover:to-teal-600 transition shadow-md">Ofertar</button>
          
          {podeAdicionarMembro && (
            <Link href="/membros/novo" className="px-5 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition shadow-md">+ Novo Membro</Link>
          )}
        </div>
      </div>

      {/* 2. KPIs MODERNOS */}
      {ehLideranca && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-indigo-50 flex flex-col justify-center relative overflow-hidden group hover:shadow-md transition-all">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-16 h-16 rounded-full bg-indigo-100/50 group-hover:scale-150 transition-transform duration-500"></div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider relative z-10">Membros Ativos</p>
            <div className="flex items-end gap-2 mt-1 relative z-10">
              <h3 className="text-4xl font-black text-gray-800">{stats.ativos}</h3>
              <span className="text-xs font-semibold text-emerald-500 mb-1.5">/ {stats.membros} Total</span>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-blue-50 flex flex-col justify-center relative overflow-hidden group hover:shadow-md transition-all">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-16 h-16 rounded-full bg-blue-100/50 group-hover:scale-150 transition-transform duration-500"></div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider relative z-10">Pessoas Cadastradas</p>
            <h3 className="text-4xl font-black text-gray-800 mt-1 relative z-10">{stats.cadastrados}</h3>
          </div>

          <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-rose-50 flex flex-col justify-center relative overflow-hidden group hover:shadow-md transition-all">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-16 h-16 rounded-full bg-rose-100/50 group-hover:scale-150 transition-transform duration-500"></div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider relative z-10">Crianças e Jovens</p>
            <h3 className="text-4xl font-black text-gray-800 mt-1 relative z-10">{stats.criancas + stats.jovens}</h3>
          </div>

          <div className="bg-white/70 backdrop-blur-md p-5 rounded-2xl shadow-sm border border-amber-50 flex flex-col justify-center relative overflow-hidden group hover:shadow-md transition-all">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-16 h-16 rounded-full bg-amber-100/50 group-hover:scale-150 transition-transform duration-500"></div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider relative z-10">Visitantes (30 Dias)</p>
            <div className="flex items-end gap-2 mt-1 relative z-10">
              <h3 className="text-4xl font-black text-gray-800">{stats.visitantesRecentes}</h3>
              <span className="text-xs font-semibold text-amber-500 mb-1.5">Recentes</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. GRÁFICOS (DATA VIZ) */}
      {ehLideranca && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* GRÁFICO FINANCEIRO MACRO */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Saúde Financeira</h2>
                <p className="text-xs text-gray-400">Entradas e saídas agrupadas por mês</p>
              </div>
              <select 
                value={periodoFinanceiro} 
                onChange={(e) => setPeriodoFinanceiro(Number(e.target.value))}
                className="bg-gray-50 border border-gray-200 text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-100 font-medium text-gray-600"
              >
                <option value={3}>Últimos 3 meses</option>
                <option value={6}>Últimos 6 meses</option>
                <option value={12}>Últimos 12 meses</option>
              </select>
            </div>
            
            <div className="w-full h-64 relative z-0">
              {dadosFinanceiros.length > 0 && dadosFinanceiros.some(d => d.Entradas > 0 || d.Saídas > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dadosFinanceiros} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} tickFormatter={(value) => `R$${value/1000}k`} />
                    <Tooltip 
                      formatter={(value: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="Entradas" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorEntradas)" />
                    <Area type="monotone" dataKey="Saídas" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorSaidas)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                  <svg className="w-12 h-12 mb-2 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-sm">Sem movimentações no período.</span>
                </div>
              )}
            </div>
          </div>

          {/* GRÁFICO DEMOGRÁFICO */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
            <div className="mb-2">
              <h2 className="text-lg font-bold text-gray-800">Perfil Demográfico</h2>
              <p className="text-xs text-gray-400">Distribuição por faixa etária</p>
            </div>
            <div className="w-full h-64 relative z-0">
              {dadosDemograficos.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosDemograficos}
                      cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                    >
                      {dadosDemograficos.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CORES_PIE[index % CORES_PIE.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => [`${value} pessoas`, '']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                  <span className="text-sm">Dados insuficientes.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. PAINEIS INFERIORES: AGENDA E RECENTES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* AGENDA */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Agenda do Mês
            </h2>
            <div className="flex items-center gap-2">
              <select value={mesSelecionado} onChange={(e) => setMesSelecionado(Number(e.target.value))} className="border border-gray-200 bg-white rounded-lg p-1.5 text-xs text-gray-700 outline-none font-medium">
                {meses.map(m => <option key={m.valor} value={m.valor}>{m.nome}</option>)}
              </select>
              <select value={anoSelecionado} onChange={(e) => setAnoSelecionado(Number(e.target.value))} className="border border-gray-200 bg-white rounded-lg p-1.5 text-xs text-gray-700 outline-none font-medium">
                <option value={anoSelecionado - 1}>{anoSelecionado - 1}</option>
                <option value={anoSelecionado}>{anoSelecionado}</option>
                <option value={anoSelecionado + 1}>{anoSelecionado + 1}</option>
              </select>
            </div>
          </div>

          <div className="p-5 flex-1 overflow-y-auto max-h-80 custom-scrollbar">
            {programacoesDoMes.length === 0 && programacoesFixas.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">Nenhuma atividade programada.</p>
            ) : (
              <div className="space-y-4">
                {programacoesFixas.map(p => (
                  <div key={p.id} className="flex gap-4 items-start p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center w-12 h-12 bg-white rounded-lg shadow-sm text-indigo-600 shrink-0 border border-gray-100">
                      <span className="text-[9px] font-bold uppercase">{p.dia_semana?.substring(0,3)}</span>
                      <span className="text-sm font-black leading-none">{p.horario?.substring(0,5)}</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800">{p.titulo} <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded ml-1">Fixo</span></h4>
                      {p.descricao && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{renderComLinks(p.descricao)}</p>}
                    </div>
                  </div>
                ))}

                {programacoesDoMes.map(p => {
                  const dObj = new Date(p.data + "T00:00:00");
                  return (
                    <div key={p.id} className="flex gap-4 items-start p-3 bg-white border border-gray-100 rounded-xl hover:border-emerald-200 transition-colors shadow-sm">
                      <div className="flex flex-col items-center justify-center w-12 h-12 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
                        <span className="text-lg font-black leading-none">{dObj.getDate().toString().padStart(2,'0')}</span>
                        <span className="text-[9px] font-bold uppercase">{dObj.toLocaleDateString('pt-BR', { weekday:'short' }).replace('.','')}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <h4 className="text-sm font-bold text-gray-800">{p.titulo}</h4>
                          <span className="text-xs font-bold text-gray-400">{p.horario?.substring(0,5)}</span>
                        </div>
                        {p.descricao && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{renderComLinks(p.descricao)}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ÚLTIMOS MEMBROS */}
        {ehLideranca && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <h2 className="text-lg font-bold text-gray-800">Recentes</h2>
              <Link href="/membros" className="text-blue-600 hover:text-blue-800 text-xs font-bold uppercase tracking-wider">Ver Todos</Link>
            </div>
            <div className="p-0 overflow-y-auto max-h-80">
              <table className="w-full text-left">
                <tbody className="divide-y divide-gray-50">
                  {recentes.length === 0 ? (
                    <tr><td className="p-8 text-center text-gray-400 text-sm">Nenhum registro.</td></tr>
                  ) : (
                    recentes.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3">
                          <Link href={`/membros/${m.id}`} className="flex items-center gap-3 w-full">
                            {m.foto_url ? (
                              <img src={m.foto_url} alt="Foto" className="w-10 h-10 rounded-full object-cover shadow-sm" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm">
                                <span className="text-xs font-bold text-gray-500 uppercase">{m.nome_completo.charAt(0)}</span>
                              </div>
                            )}
                            <div className="overflow-hidden">
                              <p className="font-bold text-gray-800 text-sm truncate">{m.nome_completo}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-gray-400 font-semibold uppercase">{m.cargo || "Membro"}</span>
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.status === 'Ativo' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                              </div>
                            </div>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 5. ANIVERSARIANTES DO MÊS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-50 flex items-center gap-3 bg-gradient-to-r from-pink-50/50 to-white">
          <span className="text-2xl">🎉</span>
          <div>
            <h2 className="text-lg font-bold text-gray-800 tracking-tight">Aniversariantes do Mês</h2>
            <p className="text-xs font-medium text-pink-500">Próximos aniversários</p>
          </div>
        </div>

        <div className="p-6">
          {aniversariantes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sem aniversariantes próximos neste mês.</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {aniversariantes.map((membro) => {
                const partes = membro.data_nascimento.split('-');
                const ehHoje = parseInt(partes[2], 10) === dataAtual.getDate() && parseInt(partes[1], 10) === (dataAtual.getMonth() + 1);
                const primeiroNome = membro.nome_completo.split(' ')[0];

                return (
                  <div key={membro.id} className={`flex items-center gap-3 p-3 min-w-[200px] rounded-xl border transition-all ${ehHoje ? 'border-pink-200 bg-pink-50/50' : 'border-gray-100 bg-white hover:shadow-sm'}`}>
                    {membro.foto_url ? (
                      <img src={membro.foto_url} alt="Foto" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="text-sm font-bold text-gray-400 uppercase">{primeiroNome.charAt(0)}</span>
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-bold text-gray-800">{primeiroNome}</h3>
                      {ehHoje ? (
                        <span className="text-[10px] bg-pink-500 text-white font-bold px-2 py-0.5 rounded-full mt-1 inline-block">HOJE!</span>
                      ) : (
                        <span className="text-xs text-gray-500">{partes[2]}/{partes[1]}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 6. MODAL PIX (Mantido) */}
      {modalPixAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col relative overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 text-center relative">
              <button onClick={() => setModalPixAberto(false)} className="absolute top-4 right-4 text-white/80 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
              <h3 className="text-xl font-bold text-white tracking-tight">Dízimos e Ofertas</h3>
              <p className="text-emerald-100 text-sm mt-1">{filtroCongregacao === "Todas" ? nomeSedeOficial : filtroCongregacao}</p>
            </div>
            <div className="p-6 flex flex-col items-center">
              {pixAtual.chave || pixAtual.qrCode ? (
                <>
                  {pixAtual.qrCode && <img src={pixAtual.qrCode} alt="QR Code" className="w-48 h-48 mb-6 rounded-xl shadow-sm border border-gray-100" />}
                  {pixAtual.chave && (
                    <div className="w-full">
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1 text-center">Chave PIX</p>
                      <div className="bg-gray-50 rounded-xl p-3 flex flex-col items-center gap-3">
                        <span className="font-mono text-sm font-bold text-gray-700 break-all text-center">{pixAtual.chave}</span>
                        <button onClick={copiarChavePix} className={`w-full py-2.5 text-sm font-bold rounded-lg transition-colors ${chaveCopiada ? 'bg-green-100 text-green-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                          {chaveCopiada ? "Copiado!" : "Copiar Chave"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <span className="text-4xl block mb-2">💸</span>
                  <p className="text-gray-500 font-medium">PIX não configurado.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}