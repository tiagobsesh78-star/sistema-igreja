"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase"; 
import { podeEditar, formatarPerfis } from "../lib/permissoes";

export default function Dashboard() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [perfisUsuario, setPerfisUsuario] = useState<string[]>([]); 
  
  // Estados de Membros
  const [stats, setStats] = useState({
    total: 0,
    ativos: 0,
    inativos: 0, 
    homens: 0,
    mulheres: 0,
  });
  const [recentes, setRecentes] = useState<any[]>([]);
  const [aniversariantes, setAniversariantes] = useState<any[]>([]); 

  // Estados de Programação
  const dataAtual = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(dataAtual.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(dataAtual.getFullYear());
  const [programacoes, setProgramacoes] = useState<any[]>([]);

  // Estados de Dízimos e Ofertas (PIX)
  const [modalPixAberto, setModalPixAberto] = useState(false);
  const [pixInfo, setPixInfo] = useState({ chave: "", qrCode: "" });
  const [chaveCopiada, setChaveCopiada] = useState(false);

  const meses = [
    { valor: 1, nome: "Janeiro" }, { valor: 2, nome: "Fevereiro" },
    { valor: 3, nome: "Março" }, { valor: 4, nome: "Abril" },
    { valor: 5, nome: "Maio" }, { valor: 6, nome: "Junho" },
    { valor: 7, nome: "Julho" }, { valor: 8, nome: "Agosto" },
    { valor: 9, nome: "Setembro" }, { valor: 10, nome: "Outubro" },
    { valor: 11, nome: "Novembro" }, { valor: 12, nome: "Dezembro" },
  ];

  useEffect(() => {
    // TRAVA DE SEGURANÇA: Verifica se o usuário está logado
    const userLocal = localStorage.getItem("usuarioLogado");
    if (!userLocal) {
      router.push("/login");
      return; 
    }

    const usuario = JSON.parse(userLocal);
    const igrejaId = usuario.igreja_id || usuario.id_igreja || usuario.idIgreja;
    
    // Armazena os perfis para controle de visualização no Dashboard
    setPerfisUsuario(formatarPerfis(usuario.perfis || usuario.nivel_acesso));

    async function carregarDadosDashboard() {
      try {
        // Busca Membros, Programação e PIX ao mesmo tempo (Paralelo para maior velocidade)
        const [resMembros, resProg, resPix] = await Promise.all([
          supabase.from("membros").select("*").eq("igreja_id", igrejaId).order("id", { ascending: false }),
          supabase.from("programacao").select("*").eq("igreja_id", igrejaId).order("horario", { ascending: true }),
          supabase.from("configuracao_igreja").select("chave_pix, qr_code_pix").eq("igreja_id", igrejaId).maybeSingle()
        ]);

        // Processa Membros
        if (resMembros.data) {
          const data = resMembros.data;
          const total = data.length;
          const ativos = data.filter((m) => m.status === "Ativo").length;
          const inativos = data.filter((m) => m.status === "Inativo").length; 
          const homens = data.filter((m) => m.genero === "Masculino").length;
          const mulheres = data.filter((m) => m.genero === "Feminino").length;

          setStats({ total, ativos, inativos, homens, mulheres });
          setRecentes(data.slice(0, 5));

          // LÓGICA INTELIGENTE DE ANIVERSARIANTES
          const hoje = new Date();
          const mesAtual = hoje.getMonth() + 1;
          const diaAtual = hoje.getDate();

          const aniversariantesFiltrados = data.filter((m) => {
            if (!m.data_nascimento) return false;
            
            const partesData = m.data_nascimento.split('-');
            if (partesData.length !== 3) return false;
            
            const mesNascimento = parseInt(partesData[1], 10);
            const diaNascimento = parseInt(partesData[2], 10);

            return mesNascimento === mesAtual && diaNascimento >= diaAtual;
          }).sort((a, b) => {
            const diaA = parseInt(a.data_nascimento.split('-')[2], 10);
            const diaB = parseInt(b.data_nascimento.split('-')[2], 10);
            return diaA - diaB;
          });

          setAniversariantes(aniversariantesFiltrados);
        }

        // Processa Programações
        if (resProg.data) {
          setProgramacoes(resProg.data);
        }

        // Processa Configurações de PIX
        if (resPix.data) {
          setPixInfo({
            chave: resPix.data.chave_pix || "",
            qrCode: resPix.data.qr_code_pix || ""
          });
        }

      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
      } finally {
        setCarregando(false);
      }
    }
    
    if (igrejaId) {
      carregarDadosDashboard();
    } else {
      setCarregando(false);
    }
  }, [router]);

  // Função para copiar a chave PIX
  const copiarChavePix = () => {
    if (!pixInfo.chave) return;
    navigator.clipboard.writeText(pixInfo.chave);
    setChaveCopiada(true);
    setTimeout(() => setChaveCopiada(false), 2000); // Retorna o texto original após 2 segundos
  };

  // Filtros Locais da Programação
  const programacoesFixas = programacoes.filter((p) => p.tipo === "Fixa");
  const programacoesDoMes = programacoes.filter((p) => {
    if (p.tipo === "Fixa") return false;
    if (!p.data) return false;
    const dataItem = new Date(p.data + "T00:00:00");
    return (
      dataItem.getMonth() + 1 === mesSelecionado &&
      dataItem.getFullYear() === anoSelecionado
    );
  }).sort((a, b) => new Date(a.data + "T00:00:00").getTime() - new Date(b.data + "T00:00:00").getTime());

  // Regras de Visualização e Edição Baseadas nos Perfis
  const podeAdicionarMembro = podeEditar(perfisUsuario, 'membros');
  
  const podeVerUltimosMembros = perfisUsuario.includes("Secretário") || 
                                perfisUsuario.includes("Pastor/Presbítero") || 
                                perfisUsuario.includes("Líder") ||
                                perfisUsuario.includes("Administrador");

  const podeVerTodosMembros = perfisUsuario.includes("Secretário") || 
                              perfisUsuario.includes("Pastor/Presbítero") || 
                              perfisUsuario.includes("Administrador");

  if (carregando) return <div className="flex h-screen items-center justify-center"><div className="text-xl text-gray-500 font-medium animate-pulse">Carregando painel administrativo...</div></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-10 relative">
      
      {/* 1. CABEÇALHO DE AÇÕES */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Visão Geral</h1>
          <p className="text-gray-500 text-sm mt-1">Bem-vindo ao painel administrativo da sua Igreja.</p>
        </div>
        <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
          
          <Link href="/programacao" className="px-5 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 transition shadow-sm">
            Programação
          </Link>
          <Link href="/escalas" className="px-5 py-2.5 bg-teal-600 text-white font-medium text-sm rounded-lg hover:bg-teal-700 transition shadow-sm">
            Escalas
          </Link>
          <Link href="/visitantes" className="px-5 py-2.5 bg-rose-600 text-white font-medium text-sm rounded-lg hover:bg-rose-700 transition shadow-sm">
            Visitantes
          </Link>

          {/* BOTÃO DE OFERTAS/PIX PADRONIZADO REPOSICIONADO AQUI */}
          <button 
            onClick={() => setModalPixAberto(true)}
            className="px-5 py-2.5 bg-emerald-600 text-white font-medium text-sm rounded-lg hover:bg-emerald-700 transition shadow-sm"
          >
            Ofertar
          </button>
          
          {/* TRAVA DO BOTÃO NOVO MEMBRO */}
          {podeAdicionarMembro && (
            <Link href="/membros/novo" className="px-5 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition shadow-sm">
              + Novo Membro
            </Link>
          )}
        </div>
      </div>

      {/* 2. ESTATÍSTICAS RÁPIDAS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center gap-2 hover:border-blue-200 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total</p>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 ml-1">{stats.total}</h3>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center gap-2 hover:border-green-200 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ativos</p>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 ml-1">{stats.ativos}</h3>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center gap-2 hover:border-red-200 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Inativos</p>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 ml-1">{stats.inativos}</h3>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center gap-2 hover:border-indigo-200 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Homens</p>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 ml-1">{stats.homens}</h3>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center gap-2 col-span-2 lg:col-span-1 hover:border-pink-200 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center text-pink-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mulheres</p>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 ml-1">{stats.mulheres}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* 3. QUADRO DE PROGRAMAÇÃO MODERNO (Dinamiza a largura caso o painel de membros suma) */}
        <div className={`${podeVerUltimosMembros ? "xl:col-span-2" : "xl:col-span-3"} bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col`}>
          {/* Cabeçalho do Quadro */}
          <div className="p-5 md:p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg shadow-sm text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <h2 className="text-lg font-bold text-gray-800 tracking-tight">Quadro de Programação</h2>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={mesSelecionado}
                onChange={(e) => setMesSelecionado(Number(e.target.value))}
                className="w-full sm:w-auto border border-gray-200 bg-white rounded-lg p-2 text-sm text-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
              >
                {meses.map((m) => <option key={m.valor} value={m.valor}>{m.nome}</option>)}
              </select>
              <select
                value={anoSelecionado}
                onChange={(e) => setAnoSelecionado(Number(e.target.value))}
                className="border border-gray-200 bg-white rounded-lg p-2 text-sm text-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
              >
                <option value={anoSelecionado - 1}>{anoSelecionado - 1}</option>
                <option value={anoSelecionado}>{anoSelecionado}</option>
                <option value={anoSelecionado + 1}>{anoSelecionado + 1}</option>
              </select>
            </div>
          </div>

          {/* Corpo do Quadro Dividido */}
          <div className="grid grid-cols-1 md:grid-cols-5 flex-1 divide-y md:divide-y-0 md:divide-x divide-gray-100">
            
            {/* Esquerda: Atividades Fixas */}
            <div className="md:col-span-2 p-5 bg-gray-50/30">
              <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-4 border-b border-gray-100 pb-2">
                Atividades Semanais
              </h3>
              {programacoesFixas.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-6">Nenhuma atividade fixa configurada.</p>
              ) : (
                <div className="space-y-3">
                  {programacoesFixas.map(p => (
                    <div key={p.id} className="flex gap-3 items-start bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex flex-col items-center justify-center min-w-[50px] bg-indigo-50 rounded text-indigo-700 py-1 border border-indigo-100">
                        <span className="text-[10px] font-bold uppercase leading-none">
                          {p.dia_semana ? p.dia_semana.substring(0, 3) : '---'}
                        </span>
                        <span className="text-sm font-black">
                          {p.horario ? p.horario.substring(0, 5) : '--:--'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800 leading-tight">{p.titulo}</p>
                        {p.descricao && <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{p.descricao}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Direita: Eventos e Reuniões do Mês */}
            <div className="md:col-span-3 p-5">
              <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-4 border-b border-gray-100 pb-2">
                Agenda do Mês
              </h3>
              {programacoesDoMes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center space-y-2">
                  <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <p className="text-sm text-gray-500">Sem agendamentos para este mês.</p>
                </div>
              ) : (
                <div className="relative border-l-2 border-gray-100 ml-3 space-y-6 pb-2">
                  {programacoesDoMes.map((p) => {
                    const dataObj = new Date(p.data + "T00:00:00");
                    const dia = dataObj.getDate().toString().padStart(2, '0');
                    const diaSemana = dataObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
                    
                    return (
                      <div key={p.id} className="relative pl-6 group">
                        <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${p.tipo === 'Reunião' ? 'bg-blue-500' : 'bg-emerald-500'} group-hover:scale-125 transition-transform`} />
                        
                        <div className="flex items-start gap-4">
                          <div className="flex flex-col items-center pt-0.5">
                            <span className="text-lg font-black text-gray-800 leading-none">{dia}</span>
                            <span className="text-[10px] uppercase font-bold text-gray-500">{diaSemana}</span>
                          </div>
                          
                          <div className="flex-1 bg-gray-50 group-hover:bg-gray-100 transition-colors p-3 rounded-lg border border-gray-100">
                            <div className="flex justify-between items-start gap-2">
                              <h4 className="text-sm font-bold text-gray-800 leading-tight">{p.titulo}</h4>
                              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded tracking-wide ${p.tipo === 'Reunião' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {p.tipo}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="flex items-center text-xs text-gray-500 font-medium bg-white px-1.5 py-0.5 rounded border border-gray-200">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {p.horario ? p.horario.substring(0, 5) : '--:--'}
                              </span>
                              {p.descricao && (
                                <span className="text-xs text-gray-500 truncate w-full">{p.descricao}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4. TABELA ÚLTIMOS CADASTRADOS */}
        {podeVerUltimosMembros && (
          <div className="xl:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-5 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800">Últimos Membros</h2>
              
              {/* TRAVA ESPECÍFICA DO BOTÃO VER TODOS */}
              {podeVerTodosMembros && (
                <Link href="/membros" className="text-blue-600 hover:text-blue-800 text-sm font-semibold">Ver Todos</Link>
              )}
            </div>
            
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <tbody className="divide-y divide-gray-100">
                  {recentes.length === 0 ? (
                    <tr><td className="p-8 text-center text-gray-400 text-sm">Nenhum membro registrado.</td></tr>
                  ) : (
                    recentes.map((membro) => (
                      <tr key={membro.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <Link href={`/membros/${membro.id}`} className="flex items-center gap-3 w-full">
                            {membro.foto_url ? (
                              <img src={membro.foto_url} alt="Foto" className="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-sm" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200 flex items-center justify-center shadow-sm">
                                <span className="text-xs font-bold text-gray-500 uppercase">
                                  {membro.nome_completo.charAt(0)}
                                </span>
                              </div>
                            )}
                            <div className="overflow-hidden">
                              <p className="font-bold text-gray-900 text-sm truncate">{membro.nome_completo}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-500 truncate">{membro.cargo || "Membro"}</span>
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${membro.status === 'Ativo' ? 'bg-green-500' : 'bg-red-500'}`}></span>
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

      {/* 5. QUADRO DE ANIVERSARIANTES DO MÊS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="p-5 md:p-6 border-b border-gray-100 flex items-center gap-4 bg-gradient-to-r from-pink-50/50 to-white">
          <div className="bg-pink-500 p-2.5 rounded-lg shadow-sm text-white transform -rotate-6">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z"></path></svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800 tracking-tight">Aniversariantes do Mês</h2>
            <p className="text-xs font-medium text-pink-600 mt-0.5">Celebre a vida dos seus membros!</p>
          </div>
        </div>

        <div className="p-5 md:p-6">
          {aniversariantes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
              <span className="text-4xl">🎂</span>
              <p className="text-sm text-gray-400 font-medium">Nenhum membro completando ano nos próximos dias deste mês.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {aniversariantes.map((membro) => {
                const partes = membro.data_nascimento.split('-');
                const diaAniversario = parseInt(partes[2], 10);
                const mesAniversario = parseInt(partes[1], 10);
                const ehHoje = diaAniversario === new Date().getDate() && mesAniversario === (new Date().getMonth() + 1);

                const primeiroNome = membro.nome_completo.split(' ')[0];

                return (
                  <div key={membro.id} className={`flex flex-col items-center p-3 rounded-xl border transition-all ${ehHoje ? 'border-pink-300 bg-pink-50/40 shadow-sm scale-105' : 'border-gray-100 bg-white hover:border-pink-200'}`}>
                    <div className="relative">
                      {membro.foto_url ? (
                        <img src={membro.foto_url} alt={membro.nome_completo} className={`w-14 h-14 rounded-full object-cover shadow-sm ${ehHoje ? 'ring-4 ring-pink-300 ring-offset-1' : 'border border-gray-200'}`} />
                      ) : (
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-sm ${ehHoje ? 'bg-gradient-to-br from-pink-400 to-pink-500 text-white ring-4 ring-pink-300 ring-offset-1' : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-400 border border-gray-200'}`}>
                          <span className="text-lg font-black uppercase">{primeiroNome.charAt(0)}</span>
                        </div>
                      )}
                      {ehHoje && <div className="absolute -top-3 -right-2 text-xl animate-bounce">👑</div>}
                    </div>

                    <h3 className="text-sm font-bold text-gray-800 mt-3 text-center truncate w-full" title={membro.nome_completo}>
                      {primeiroNome}
                    </h3>

                    {ehHoje ? (
                      <span className="mt-1 px-2.5 py-0.5 bg-pink-500 text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-sm animate-pulse">
                        Hoje!
                      </span>
                    ) : (
                      <span className="mt-1 text-xs font-semibold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                        {diaAniversario.toString().padStart(2, '0')}/{mesAniversario.toString().padStart(2, '0')}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 6. MODAL DE DÍZIMOS E OFERTAS (PIX) - COM TRAVA DE RESPONSIVIDADE */}
      {modalPixAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          
          {/* Container do Modal com max-h e flex-col para controle rígido do tamanho */}
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[95vh] shadow-2xl flex flex-col relative transform scale-100 transition-all">
            
            {/* Cabeçalho do Modal Fixo (shrink-0 garante que ele não será esmagado) */}
            <div className="bg-emerald-600 p-5 md:p-6 text-center relative shrink-0 rounded-t-2xl">
              <button 
                onClick={() => setModalPixAberto(false)}
                className="absolute top-4 right-4 p-1 text-emerald-200 hover:text-white transition-colors"
                title="Fechar"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
              
              <div className="w-12 h-12 md:w-14 md:h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3">
                <svg className="w-6 h-6 md:w-7 md:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
              </div>
              <h3 className="text-lg md:text-xl font-bold text-white tracking-tight">Dízimos e Ofertas</h3>
              <p className="text-emerald-100 text-xs md:text-sm mt-1">Contribua de forma rápida e segura</p>
            </div>

            {/* Corpo do Modal com Rolagem Interna Automática (overflow-y-auto) */}
            <div className="p-5 md:p-8 overflow-y-auto">
              {pixInfo.chave || pixInfo.qrCode ? (
                <div className="flex flex-col items-center">
                  
                  {pixInfo.qrCode && (
                    <div className="bg-white p-3 rounded-2xl border-2 border-gray-100 shadow-sm mb-6">
                      <img src={pixInfo.qrCode} alt="QR Code PIX" className="w-40 h-40 md:w-48 md:h-48 object-contain rounded-xl" />
                    </div>
                  )}
                  
                  {pixInfo.chave && (
                    <div className="w-full text-center">
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Chave PIX da Igreja</p>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col items-center gap-3">
                        <span className="font-mono text-sm md:text-base font-bold text-gray-800 break-all text-center px-2">
                          {pixInfo.chave}
                        </span>
                        
                        <button
                          onClick={copiarChavePix}
                          className={`w-full md:w-auto px-5 py-2.5 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm ${
                            chaveCopiada 
                              ? 'bg-green-100 text-green-700 ring-2 ring-green-500 ring-offset-1' 
                              : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          }`}
                        >
                          {chaveCopiada ? (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                              Chave Copiada!
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                              Copiar Chave
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200">
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                  </div>
                  <h4 className="text-lg font-bold text-gray-800 mb-2">Chave não configurada</h4>
                  <p className="text-sm text-gray-500 leading-relaxed px-4">
                    Sua igreja ainda não cadastrou as informações de recebimento via PIX. Em breve essa opção estará disponível!
                  </p>
                </div>
              )}
              
              <div className="mt-6 md:mt-8 pt-4 md:pt-5 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-400 font-medium italic">"Cada um contribua segundo propôs no seu coração..."<br/>— 2 Coríntios 9:7</p>
              </div>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}