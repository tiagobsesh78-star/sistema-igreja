"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../src/lib/supabase";
import { podeEditar, formatarPerfis } from "../../../../src/lib/permissoes";

export default function DizimistasPage() {
  const router = useRouter();

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

  const dataAtual = new Date();
  const [mesFiltro, setMesFiltro] = useState(dataAtual.getMonth() + 1);
  const [anoFiltro, setAnoFiltro] = useState(dataAtual.getFullYear());

  const meses = [
    { valor: 1, nome: "Janeiro" }, { valor: 2, nome: "Fevereiro" },
    { valor: 3, nome: "Março" }, { valor: 4, nome: "Abril" },
    { valor: 5, nome: "Maio" }, { valor: 6, nome: "Junho" },
    { valor: 7, nome: "Julho" }, { valor: 8, nome: "Agosto" },
    { valor: 9, nome: "Setembro" }, { valor: 10, nome: "Outubro" },
    { valor: 11, nome: "Novembro" }, { valor: 12, nome: "Dezembro" },
  ];

  const [ehSede, setEhSede] = useState(false);
  const [nomeSedeOficial, setNomeSedeOficial] = useState("Sede");
  const [congregacaoUsuario, setCongregacaoUsuario] = useState("");

  useEffect(() => {
    const usuarioLocal = localStorage.getItem("usuarioLogado");
    if (!usuarioLocal) {
      router.push("/login");
      return;
    }
    
    const usuario = JSON.parse(usuarioLocal);
    const perfisLogado = formatarPerfis(usuario.perfis || usuario.nivel_acesso);

    if (!podeEditar(perfisLogado, 'tesouraria')) {
      router.push("/");
      return; 
    }

    const igrejaId = usuario.igreja_id || usuario.id_igreja || usuario.idIgreja;
    setIgrejaIdLogada(igrejaId);

    async function carregarDados(idIgreja: string) {
      setCarregando(true);
      setErroBanco(null);
      
      try {
        const { data: config } = await supabase.from("configuracao_igreja").select("nome_igreja").eq("igreja_id", idIgreja).maybeSingle();
        const nomeSede = config?.nome_igreja?.trim() || "Sede Principal";
        setNomeSedeOficial(nomeSede);

        const congUser = usuario?.congregacao?.trim() || "";
        setCongregacaoUsuario(congUser);
        
        const congLow = congUser.toLowerCase();
        const isUserSede = !congLow || congLow === "sede" || congLow === "matriz" || congLow === "geral" || congLow === nomeSede.toLowerCase();
        setEhSede(isUserSede);

        if (isUserSede) {
          const { data: filhas } = await supabase.from("igrejas_filhas").select("nome").eq("igreja_id", idIgreja).order("nome", { ascending: true });
          const nomesFilhas = filhas ? filhas.map(f => f.nome) : [];
          setCongregacoes([nomeSede, ...nomesFilhas]);
        } else {
          setCongregacoes([congUser]);
          setCongregacaoFiltro(congUser); 
          setCongregacaoForm(congUser); 
        }

        let queryMembros = supabase.from("membros").select("id, nome_completo, congregacao").eq("igreja_id", idIgreja);
        let queryLancamentos = supabase.from("tesouraria_lancamentos").select("*").eq("igreja_id", idIgreja);
        
        if (!isUserSede) {
          queryMembros = queryMembros.eq("congregacao", congUser);
          queryLancamentos = queryLancamentos.eq("congregacao", congUser);
        }

        const [resMembros, resLancamentos, resDizimistas] = await Promise.all([
          queryMembros, queryLancamentos, supabase.from("tesouraria_dizimistas").select("*").eq("igreja_id", idIgreja)
        ]);

        if (resMembros.data) {
          resMembros.data.sort((a, b) => obterNomeMembro(a).localeCompare(obterNomeMembro(b)));
          setMembros(resMembros.data);

          if (resDizimistas.data) {
            // Unimos os membros sem filtrar o mês ainda
            const unidos = resDizimistas.data.map((d: any) => ({
              ...d, membros: resMembros.data.find(m => String(m.id) === String(d.membro_id)) || null
            })).filter(d => d.membros !== null);
            setDizimistas(unidos);
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

  async function recarregarDadosManualmente() {
    if (!igrejaIdLogada) return;
    setCarregando(true);
    setErroBanco(null);
    
    try {
      let queryMembros = supabase.from("membros").select("id, nome_completo, congregacao").eq("igreja_id", igrejaIdLogada);
      let queryLancamentos = supabase.from("tesouraria_lancamentos").select("*").eq("igreja_id", igrejaIdLogada);
      
      if (!ehSede) {
        queryMembros = queryMembros.eq("congregacao", congregacaoUsuario);
        queryLancamentos = queryLancamentos.eq("congregacao", congregacaoUsuario);
      }

      const [resMembros, resLancamentos, resDizimistas] = await Promise.all([
        queryMembros, queryLancamentos, supabase.from("tesouraria_dizimistas").select("*").eq("igreja_id", igrejaIdLogada)
      ]);

      if (resMembros.data) {
        resMembros.data.sort((a, b) => obterNomeMembro(a).localeCompare(obterNomeMembro(b)));
        setMembros(resMembros.data);

        if (resDizimistas.data) {
          const unidos = resDizimistas.data.map((d: any) => ({
            ...d, membros: resMembros.data.find(m => String(m.id) === String(d.membro_id)) || null
          })).filter(d => d.membros !== null);
          setDizimistas(unidos);
        }
      }
      if (resLancamentos.data) setLancamentos(resLancamentos.data);
    } catch (error: any) {
      setErroBanco(error.message);
    } finally {
      setCarregando(false);
    }
  }

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

  const obterCongregacaoMembro = (m: any) => m ? normalizarSede(m.congregacao || m.Congregacao) : nomeSedeOficial;

  // =====================================
  // FILTRO HISTÓRICO DE MÊS
  // =====================================
  const getPeriod = (dataStr: string | null) => {
    if (!dataStr) return null;
    const [ano, mes] = dataStr.split('-');
    return parseInt(ano) * 12 + parseInt(mes);
  };

  const currentPeriod = anoFiltro * 12 + mesFiltro;
  const dizimistasFiltradosMes: any[] = [];
  const membrosProcessados = new Set();

  dizimistas.forEach(d => {
    if (membrosProcessados.has(d.membro_id)) return;
    
    // Pega todas as passagens da pessoa pela lista
    const rows = dizimistas.filter(x => String(x.membro_id) === String(d.membro_id));
    
    // Verifica se ela estava ativa em alguma dessas passagens durante o mês selecionado
    const isAtivoNoMes = rows.some(row => {
        const addP = getPeriod(row.adicionado_em) || 0;
        const remP = getPeriod(row.removido_em) || Infinity;
        return currentPeriod >= addP && currentPeriod < remP;
    });

    if (isAtivoNoMes) {
        // Encontra exatamente qual registro torna ela ativa para amarrarmos o botão "Remover"
        const activeRow = rows.find(row => {
            const addP = getPeriod(row.adicionado_em) || 0;
            const remP = getPeriod(row.removido_em) || Infinity;
            return currentPeriod >= addP && currentPeriod < remP;
        });

        if (activeRow && !membrosProcessados.has(d.membro_id)) {
            dizimistasFiltradosMes.push({ ...activeRow, membros: d.membros });
            membrosProcessados.add(d.membro_id);
        }
    }
  });

  const dizimistasExibicao = dizimistasFiltradosMes.filter((d) => {
    const cong = obterCongregacaoMembro(d.membros);
    return congregacaoFiltro === "" || cong === congregacaoFiltro;
  });

  const membrosDisponiveis = membros.filter(m => !dizimistasFiltradosMes.some(d => String(d.membro_id) === String(m.id)));

  const membrosFiltradosForm = congregacaoForm 
    ? membrosDisponiveis.filter(m => obterCongregacaoMembro(m) === congregacaoForm)
    : membrosDisponiveis;

  const salvarDizimista = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membroSelecionado || !igrejaIdLogada) return;

    setSalvando(true);
    const padMes = mesFiltro < 10 ? `0${mesFiltro}` : mesFiltro;
    const periodoStr = `${anoFiltro}-${padMes}`; // Data que a pessoa começou

    const { error } = await supabase.from("tesouraria_dizimistas").insert([{ 
      membro_id: String(membroSelecionado),
      igreja_id: igrejaIdLogada,
      adicionado_em: periodoStr
    }]);

    if (error) alert("Erro ao salvar: " + error.message);
    else { setMembroSelecionado(""); recarregarDadosManualmente(); }
    setSalvando(false);
  };

  const removerDizimista = async (id: number) => {
    if (!confirm("Remover este membro dos dizimistas ativos a partir deste mês? Ele continuará visível se você filtrar os meses anteriores.")) return;
    if (!igrejaIdLogada) return;

    const padMes = mesFiltro < 10 ? `0${mesFiltro}` : mesFiltro;
    const periodoStr = `${anoFiltro}-${padMes}`; // Marca até quando a pessoa ficou ativa

    const { error } = await supabase.from("tesouraria_dizimistas").update({ removido_em: periodoStr }).eq("id", id).eq("igreja_id", igrejaIdLogada);
    if (!error) recarregarDadosManualmente();
  };

  const lancamentosFiltrados = lancamentos.filter((lanc) => {
    const isAtivo = !lanc.excluido;
    const isCongregacaoCerta = congregacaoFiltro === "" || normalizarSede(lanc.congregacao) === congregacaoFiltro;
    const dataLanc = new Date(lanc.data + "T00:00:00");
    const isMesCerto = dataLanc.getMonth() + 1 === mesFiltro && dataLanc.getFullYear() === anoFiltro;
    return isAtivo && isCongregacaoCerta && isMesCerto;
  });

  const obterDetalhesDizimos = (lanc: any) => {
    if (!lanc.detalhes_dizimos) return [];
    let detalhes = lanc.detalhes_dizimos;
    if (typeof detalhes === 'string') { try { detalhes = JSON.parse(detalhes); } catch(e) { return []; } }
    return Array.isArray(detalhes) ? detalhes : [];
  };

  const calcularValorDizimadoNoMes = (membroId: string) => {
    return lancamentosFiltrados.reduce((total, lanc) => {
      const detalhes = obterDetalhesDizimos(lanc);
      const valorNoLancamento = detalhes.filter((d: any) => String(d.membro_id) === String(membroId)).reduce((acc: number, curr: any) => acc + (Number(curr.valor) || 0), 0);
      return total + valorNoLancamento;
    }, 0);
  };

  const valorTotalDizimosMes = lancamentosFiltrados.reduce((acc, l) => acc + (Number(l.dizimos) || 0), 0);
  const qtdDizimistasAtivos = dizimistasExibicao.length;
  const mediaDizimo = qtdDizimistasAtivos > 0 ? valorTotalDizimosMes / qtdDizimistasAtivos : 0;

  const formatarMoeda = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  if (erroBanco) return (
    <div className="max-w-2xl mx-auto mt-10 bg-white border border-red-200 rounded-xl p-6 text-center shadow-sm">
      <h2 className="text-lg font-bold text-red-600 mb-2">Diagnóstico de Sincronização</h2>
      <p className="text-sm text-gray-600 mb-4">{erroBanco}</p>
      <button onClick={recarregarDadosManualmente} className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-black transition">Tentar Novamente</button>
    </div>
  );

  if (carregando) return <div className="p-8 text-center text-gray-500 font-medium text-sm animate-pulse">Carregando painel de dizimistas...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dizimistas Ativos</h1>
          <p className="text-sm text-gray-500 mt-1">Cadastro de dizimistas ativos e cálculo de dízimo médio geral.</p>
        </div>
        <button onClick={() => router.push("/tesouraria")} className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition text-sm">Voltar</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2 border-gray-100">Adicionar à Lista</h3>
          <form onSubmit={salvarDizimista} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Filtrar por Congregação</label>
              {ehSede ? (
                <select value={congregacaoForm} onChange={(e) => { setCongregacaoForm(e.target.value); setMembroSelecionado(""); }} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer">
                  <option value="">🌍 Todas as Congregações</option>
                  <option value={nomeSedeOficial}>🏢 {nomeSedeOficial}</option>
                  {congregacoes.filter(c => c !== nomeSedeOficial).map((c) => <option key={c} value={c}>📍 {c}</option>)}
                </select>
              ) : (
                <div className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500 font-bold cursor-not-allowed">📍 {congregacaoUsuario}</div>
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

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-3">
            {ehSede ? (
              <select value={congregacaoFiltro} onChange={(e) => setCongregacaoFiltro(e.target.value)} className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none flex-1 font-semibold text-gray-800 cursor-pointer">
                <option value="">🌍 Geral (Todas as Congregações)</option>
                <option value={nomeSedeOficial}>🏢 {nomeSedeOficial} (Sede)</option>
                {congregacoes.filter(c => c !== nomeSedeOficial).map((c) => <option key={c} value={c}>📍 {c}</option>)}
              </select>
            ) : (
              <div className="px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm flex-1 font-bold text-gray-500 cursor-not-allowed">📍 {congregacaoUsuario}</div>
            )}
            <div className="flex gap-2">
              <select value={mesFiltro} onChange={(e) => setMesFiltro(Number(e.target.value))} className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none font-bold text-gray-800 cursor-pointer">
                {meses.map(m => <option key={m.valor} value={m.valor}>{m.nome}</option>)}
              </select>
              <select value={anoFiltro} onChange={(e) => setAnoFiltro(Number(e.target.value))} className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none font-bold text-gray-800 cursor-pointer">
                <option value={anoFiltro - 1}>{anoFiltro - 1}</option>
                <option value={anoFiltro}>{anoFiltro}</option>
                <option value={anoFiltro + 1}>{anoFiltro + 1}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-100 border-l-4 border-l-green-500">
              <p className="text-xs text-gray-400 font-bold uppercase mb-1">Total Dízimos ({meses.find(m => m.valor === mesFiltro)?.nome})</p>
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
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 sticky top-0 shadow-sm z-10">
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Nome</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Congregação</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center">Status no Mês</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center">Valor no Mês</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {dizimistasExibicao.length > 0 ? (
                    dizimistasExibicao.map((d) => {
                      const valorDizimado = calcularValorDizimadoNoMes(d.membro_id);
                      const dizimou = valorDizimado > 0;
                      return (
                        <tr key={d.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 text-sm font-bold text-gray-900">{obterNomeMembro(d.membros)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{obterCongregacaoMembro(d.membros)}</td>
                          <td className="px-4 py-3 text-center">
                            {dizimou ? <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-md">✅ Dizimou</span>
                             : <span className="inline-block px-2 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-md">⏳ Pendente</span>}
                          </td>
                          <td className="px-4 py-3 text-sm font-black text-gray-900 text-center">{formatarMoeda(valorDizimado)}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => removerDizimista(d.id)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded text-xs font-bold transition">Remover</button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Nenhum dizimista ativo listado nesta congregação.</td></tr>
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