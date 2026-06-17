"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase"; 

export default function Dashboard() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  
  // Estados de Membros
  const [stats, setStats] = useState({
    total: 0,
    ativos: 0,
    inativos: 0, 
    homens: 0,
    mulheres: 0,
  });
  const [recentes, setRecentes] = useState<any[]>([]);

  // Estados de Programação
  const dataAtual = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(dataAtual.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(dataAtual.getFullYear());
  const [programacoes, setProgramacoes] = useState<any[]>([]);

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

    async function carregarDadosDashboard() {
      try {
        // Busca Membros e Programação ao mesmo tempo (Paralelo para maior velocidade)
        const [resMembros, resProg] = await Promise.all([
          supabase.from("membros").select("*").eq("igreja_id", igrejaId).order("id", { ascending: false }),
          supabase.from("programacao").select("*").eq("igreja_id", igrejaId).order("horario", { ascending: true })
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
        }

        // Processa Programações
        if (resProg.data) {
          setProgramacoes(resProg.data);
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
  }).sort((a, b) => new Date(a.data + "T00:00:00").getTime() - new Date(b.data + "T00:00:00").getTime()); // Ordena por data

  if (carregando) return <div className="flex h-screen items-center justify-center"><div className="text-xl text-gray-500 font-medium animate-pulse">Carregando painel administrativo...</div></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-10">
      
      {/* 1. CABEÇALHO DE AÇÕES */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Visão Geral</h1>
          <p className="text-gray-500 text-sm mt-1">Bem-vindo ao painel administrativo da sua Igreja.</p>
        </div>
        <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
          <Link href="/programacao" className="px-5 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 transition shadow-sm">
            Ver Programação
          </Link>
          <Link href="/escalas" className="px-5 py-2.5 bg-teal-600 text-white font-medium text-sm rounded-lg hover:bg-teal-700 transition shadow-sm">
            Ver Escalas
          </Link>
          <Link href="/membros/novo" className="px-5 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition shadow-sm">
            + Novo Membro
          </Link>
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
        
        {/* 3. QUADRO DE PROGRAMAÇÃO MODERNO (OCUPA 2/3 DA TELA) */}
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
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
                  {programacoesDoMes.map((p, idx) => {
                    const dataObj = new Date(p.data + "T00:00:00");
                    const dia = dataObj.getDate().toString().padStart(2, '0');
                    const diaSemana = dataObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
                    
                    return (
                      <div key={p.id} className="relative pl-6 group">
                        {/* Bolinha da Linha do Tempo */}
                        <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${p.tipo === 'Reunião' ? 'bg-blue-500' : 'bg-emerald-500'} group-hover:scale-125 transition-transform`} />
                        
                        <div className="flex items-start gap-4">
                          {/* Bloco de Data */}
                          <div className="flex flex-col items-center pt-0.5">
                            <span className="text-lg font-black text-gray-800 leading-none">{dia}</span>
                            <span className="text-[10px] uppercase font-bold text-gray-500">{diaSemana}</span>
                          </div>
                          
                          {/* Conteúdo */}
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

        {/* 4. TABELA ÚLTIMOS CADASTRADOS (OCUPA 1/3 DA TELA) */}
        <div className="xl:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-5 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h2 className="text-lg font-bold text-gray-800">Últimos Membros</h2>
            <Link href="/membros" className="text-blue-600 hover:text-blue-800 text-sm font-semibold">Ver Todos</Link>
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

      </div>
    </div>
  );
}