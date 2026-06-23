"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../src/lib/supabase";
import { podeEditar, formatarPerfis } from "../../../../src/lib/permissoes";

export default function DizimistasPage() {
  const router = useRouter();

  // 1. TODOS OS STATES NO TOPO
  const [dizimistas, setDizimistas] = useState<any[]>([]);
  const [membros, setMembros] = useState<any[]>([]);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [congregacoes, setCongregacoes] = useState<string[]>([]);
  
  const [carregando, setCarregando] = useState(true);
  const [erroBanco, setErroBanco] = useState<string | null>(null);
  const [igrejaIdLogada, setIgrejaIdLogada] = useState<string | null>(null);

  const [congregacaoForm, setCongregacaoForm] = useState("");
  const [membroSelecionado, setMembroSelecionado] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [congregacaoFiltro, setCongregacaoFiltro] = useState("");

  // Estados do Multi-tenancy Hierárquico
  const [ehSede, setEhSede] = useState(false);
  const [nomeSedeOficial, setNomeSedeOficial] = useState("Sede");
  const [congregacaoUsuario, setCongregacaoUsuario] = useState("");

  // 2. EFFECT PRINCIPAL COM A TRAVA HIERÁRQUICA E ROTA DE EDIÇÃO
  useEffect(() => {
    const usuarioLocal = localStorage.getItem("usuarioLogado");
    if (!usuarioLocal) {
      router.push("/login");
      return;
    }
    
    const usuario = JSON.parse(usuarioLocal);
    const perfisLogado = formatarPerfis(usuario.perfis || usuario.nivel_acesso);

    // ==================================================
    // TRAVA DE ROTA: CHUTA INVASORES PARA A HOME
    // ==================================================
    if (!podeEditar(perfisLogado, 'tesouraria')) {
      router.push("/");
      return; 
    }
    // ==================================================

    const igrejaId = usuario.igreja_id || usuario.id_igreja || usuario.idIgreja;
    setIgrejaIdLogada(igrejaId);

    async function carregarDados(idIgreja: string) {
      setCarregando(true);
      setErroBanco(null);
      
      try {
        // 1. Busca o nome da Igreja Mãe (Sede)
        const { data: config } = await supabase
          .from("configuracao_igreja")
          .select("nome_igreja")
          .eq("igreja_id", idIgreja)
          .maybeSingle();

        const nomeSede = config?.nome_igreja?.trim() || "Sede Principal";
        setNomeSedeOficial(nomeSede);

        // 2. Analisa quem é o usuário logado e sua hierarquia
        const congUser = usuario?.congregacao?.trim() || "";
        setCongregacaoUsuario(congUser);
        
        const congLow = congUser.toLowerCase();
        const isUserSede = !congLow || congLow === "sede" || congLow === "matriz" || congLow === "geral" || congLow === nomeSede.toLowerCase();
        
        setEhSede(isUserSede);

        // 3. Monta a lista oficial de congregações permitidas para o usuário
        if (isUserSede) {
          const { data: filhas } = await supabase
            .from("igrejas_filhas")
            .select("nome")
            .eq("igreja_id", idIgreja)
            .order("nome", { ascending: true });

          const nomesFilhas = filhas ? filhas.map(f => f.nome) : [];
          setCongregacoes([nomeSede, ...nomesFilhas]);
        } else {
          setCongregacoes([congUser]);
          setCongregacaoFiltro(congUser); // Trava o filtro analítico na filial dele
          setCongregacaoForm(congUser); // Trava o formulário de cadastro na filial dele
        }

        // 4. Busca o restante dos dados com Travas Inteligentes
        let queryMembros = supabase.from("membros").select("*").eq("igreja_id", idIgreja);
        let queryLancamentos = supabase.from("tesouraria_lancamentos").select("*").eq("igreja_id", idIgreja);
        
        if (!isUserSede) {
          queryMembros = queryMembros.eq("congregacao", congUser);
          queryLancamentos = queryLancamentos.eq("congregacao", congUser);
        }

        const [resMembros, resLancamentos, resDizimistas] = await Promise.all([
          queryMembros,
          queryLancamentos,
          supabase.from("tesouraria_dizimistas").select("*").eq("igreja_id", idIgreja)
        ]);

        if (resMembros.error) throw new Error(`Erro ao buscar membros: ${resMembros.error.message}`);
        if (resLancamentos.error) throw new Error(`Erro ao buscar lançamentos: ${resLancamentos.error.message}`);
        if (resDizimistas.error) throw new Error(`Erro nos dizimistas: ${resDizimistas.error.message}`);

        if (resMembros.data) {
          resMembros.data.sort((a, b) => obterNomeMembro(a).localeCompare(obterNomeMembro(b)));
          setMembros(resMembros.data);

          if (resDizimistas.data) {
            // Relaciona e elimina "órfãos" caso a filial não tenha permissão de ver o membro da Sede
            const dizimistasUnidos = resDizimistas.data.map((d: any) => {
              const dadosDoMembro = resMembros.data.find(m => String(m.id) === String(d.membro_id));
              return { ...d, membros: dadosDoMembro || null };
            }).filter(d => d.membros !== null);

            setDizimistas(dizimistasUnidos);
          }
        }

        if (resLancamentos.data) setLancamentos(resLancamentos.data);

      } catch (error: any) {
        setErroBanco(error.message);
      } finally {
        setCarregando(false);
      }
    }

    if (igrejaId) carregarDados(igrejaId);
  }, [router]);

  // Função extra de recarga manual (Mantendo a Trava Hierárquica)
  async function recarregarDadosManualmente() {
    if (!igrejaIdLogada) return;
    setCarregando(true);
    setErroBanco(null);
    
    try {
      let queryMembros = supabase.from("membros").select("*").eq("igreja_id", igrejaIdLogada);
      let queryLancamentos = supabase.from("tesouraria_lancamentos").select("*").eq("igreja_id", igrejaIdLogada);
      
      if (!ehSede) {
        queryMembros = queryMembros.eq("congregacao", congregacaoUsuario);
        queryLancamentos = queryLancamentos.eq("congregacao", congregacaoUsuario);
      }

      const [resMembros, resLancamentos, resDizimistas] = await Promise.all([
        queryMembros,
        queryLancamentos,
        supabase.from("tesouraria_dizimistas").select("*").eq("igreja_id", igrejaIdLogada)
      ]);

      if (resMembros.data) {
        resMembros.data.sort((a, b) => obterNomeMembro(a).localeCompare(obterNomeMembro(b)));
        setMembros(resMembros.data);

        if (resDizimistas.data) {
          const dizimistasUnidos = resDizimistas.data.map((d: any) => ({
            ...d,
            membros: resMembros.data.find(m => String(m.id) === String(d.membro_id)) || null
          })).filter(d => d.membros !== null);
          setDizimistas(dizimistasUnidos);
        }
      }

      if (resLancamentos.data) setLancamentos(resLancamentos.data);
    } catch (error: any) {
      setErroBanco(error.message);
    } finally {
      setCarregando(false);
    }
  }

  // 3. FUNÇÕES COMUNS DE FORMATAÇÃO E FILTRO
  const obterNomeMembro = (m: any) => {
    if (!m) return "Desconhecido";
    return m.nome || m.Nome || m.nome_completo || m.nome_membro || "Sem Nome";
  };

  const normalizarSede = (c: string) => {
    const cong = c?.trim();
    if (!cong || cong.toLowerCase() === "sede" || cong.toLowerCase() === "matriz" || cong.toLowerCase() === "geral" || cong.toLowerCase() === nomeSedeOficial.toLowerCase()) {
      return nomeSedeOficial;
    }
    return cong;
  };

  const obterCongregacaoMembro = (m: any) => {
    if (!m) return nomeSedeOficial;
    return normalizarSede(m.congregacao || m.Congregacao);
  };

  const membrosDisponiveis = membros.filter(m => 
    !dizimistas.some(d => String(d.membro_id) === String(m.id))
  );

  const membrosFiltradosForm = congregacaoForm 
    ? membrosDisponiveis.filter(m => obterCongregacaoMembro(m) === congregacaoForm)
    : membrosDisponiveis;

  const salvarDizimista = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membroSelecionado || !igrejaIdLogada) return;

    setSalvando(true);
    const { error } = await supabase
      .from("tesouraria_dizimistas")
      .insert([{ 
        membro_id: String(membroSelecionado),
        igreja_id: igrejaIdLogada 
      }]);

    if (error) {
      alert("Erro ao salvar: " + error.message);
    } else {
      setMembroSelecionado("");
      recarregarDadosManualmente();
    }
    setSalvando(false);
  };

  const removerDizimista = async (id: number) => {
    if (!confirm("Remover este membro dos dizimistas ativos?")) return;
    if (!igrejaIdLogada) return;

    const { error } = await supabase
      .from("tesouraria_dizimistas")
      .delete()
      .eq("id", id)
      .eq("igreja_id", igrejaIdLogada);
      
    if (!error) recarregarDadosManualmente();
  };

  const dizimistasFiltrados = dizimistas.filter((d) => {
    const cong = obterCongregacaoMembro(d.membros);
    return congregacaoFiltro === "" || cong === congregacaoFiltro;
  });

  // Filtra ignorando os excluídos logicamente para a média bater exato!
  const lancamentosFiltrados = lancamentos.filter((lanc) => {
    const isAtivo = !lanc.excluido;
    const isCongregacaoCerta = congregacaoFiltro === "" || normalizarSede(lanc.congregacao) === congregacaoFiltro;
    return isAtivo && isCongregacaoCerta;
  });

  const valorTotalDizimosMes = lancamentosFiltrados.reduce((acc, l) => acc + (Number(l.dizimos) || 0), 0);
  const qtdDizimistasAtivos = dizimistasFiltrados.length;
  const mediaDizimo = qtdDizimistasAtivos > 0 ? valorTotalDizimosMes / qtdDizimistasAtivos : 0;

  const formatarMoeda = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  // 4. RETORNOS
  if (erroBanco) {
    return (
      <div className="max-w-2xl mx-auto mt-10 bg-white border border-red-200 rounded-xl p-6 text-center shadow-sm">
        <h2 className="text-lg font-bold text-red-600 mb-2">Diagnóstico de Sincronização</h2>
        <p className="text-sm text-gray-600 mb-4">{erroBanco}</p>
        <button onClick={recarregarDadosManualmente} className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-black transition">Tentar Novamente</button>
      </div>
    );
  }

  if (carregando) return <div className="p-8 text-center text-gray-500 font-medium text-sm animate-pulse">Carregando painel de dizimistas...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dizimistas Ativos</h1>
          <p className="text-sm text-gray-500 mt-1">Cadastro de dizimistas ativos e cálculo de dízimo médio geral.</p>
        </div>
        <button onClick={() => router.push("/tesouraria")} className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition text-sm">Voltar</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* FORMULÁRIO */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2 border-gray-100">Adicionar à Lista</h3>
          <form onSubmit={salvarDizimista} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Filtrar por Congregação</label>
              {ehSede ? (
                <select 
                  value={congregacaoForm} 
                  onChange={(e) => { setCongregacaoForm(e.target.value); setMembroSelecionado(""); }} 
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  <option value="">🌍 Todas as Congregações</option>
                  <option value={nomeSedeOficial}>🏢 {nomeSedeOficial}</option>
                  {congregacoes.filter(c => c !== nomeSedeOficial).map((c) => <option key={c} value={c}>📍 {c}</option>)}
                </select>
              ) : (
                <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500 font-bold cursor-not-allowed">
                  📍 {congregacaoUsuario}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Selecionar Membro</label>
              <select required value={membroSelecionado} onChange={(e) => setMembroSelecionado(e.target.value)} className="w-full px-3 py-2 bg-blue-50/50 border border-blue-100 rounded-lg text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500">
                <option value="" disabled>Selecione...</option>
                {membrosFiltradosForm.map((m) => <option key={m.id} value={m.id}>{obterNomeMembro(m)}</option>)}
              </select>
            </div>
            
            <button type="submit" disabled={salvando || membrosFiltradosForm.length === 0} className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg transition text-sm disabled:bg-gray-200 disabled:text-gray-400">
              {salvando ? "Salvando..." : "Confirmar Ativo"}
            </button>
          </form>
        </div>

        {/* DASHBOARD */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-3">
            {ehSede ? (
              <select value={congregacaoFiltro} onChange={(e) => setCongregacaoFiltro(e.target.value)} className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none flex-1 font-semibold text-gray-800 cursor-pointer">
                <option value="">🌍 Geral (Todas as Congregações)</option>
                <option value={nomeSedeOficial}>🏢 {nomeSedeOficial} (Sede)</option>
                {congregacoes.filter(c => c !== nomeSedeOficial).map((c) => <option key={c} value={c}>📍 {c}</option>)}
              </select>
            ) : (
              <div className="px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm flex-1 font-bold text-gray-500 cursor-not-allowed">
                📍 {congregacaoUsuario}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 border-l-4 border-l-green-500">
              <p className="text-xs text-gray-400 font-bold uppercase mb-1">Total Dízimos (Tesouraria)</p>
              <p className="text-xl font-black text-gray-900">{formatarMoeda(valorTotalDizimosMes)}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 border-l-4 border-l-blue-500">
              <p className="text-xs text-gray-400 font-bold uppercase mb-1">Dizimistas Ativos</p>
              <p className="text-xl font-black text-gray-900">{qtdDizimistasAtivos}</p>
            </div>
            <div className="bg-teal-50 p-4 rounded-xl border border-teal-100 border-l-4 border-l-teal-600">
              <p className="text-xs text-teal-700 font-bold uppercase mb-1">Média por Dizimista</p>
              <p className="text-xl font-black text-teal-900">{formatarMoeda(mediaDizimo)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 sticky top-0 shadow-sm z-10">
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Nome</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Congregação</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {dizimistasFiltrados.length > 0 ? (
                    dizimistasFiltrados.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">{obterNomeMembro(d.membros)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{obterCongregacaoMembro(d.membros)}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => removerDizimista(d.id)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded text-xs font-bold transition">Remover</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-sm">Nenhum dizimista ativo listado nesta congregação.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}