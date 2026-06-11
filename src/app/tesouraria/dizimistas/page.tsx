"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../src/lib/supabase";

export default function DizimistasPage() {
  const router = useRouter();

  // Estados dos Dados
  const [dizimistas, setDizimistas] = useState<any[]>([]);
  const [membros, setMembros] = useState<any[]>([]);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [congregacoes, setCongregacoes] = useState<string[]>([]);
  
  const [carregando, setCarregando] = useState(true);
  const [erroBanco, setErroBanco] = useState<string | null>(null);

  // Estados do Formulário
  const [congregacaoForm, setCongregacaoForm] = useState("");
  const [membroSelecionado, setMembroSelecionado] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Filtro de Congregação do Dashboard
  const [congregacaoFiltro, setCongregacaoFiltro] = useState("");

  const obterNomeMembro = (m: any) => {
    if (!m) return "Desconhecido";
    return m.nome || m.Nome || m.nome_completo || m.nome_membro || "Sem Nome";
  };

  const obterCongregacaoMembro = (m: any) => {
    if (!m) return "Geral";
    return m.congregacao || m.Congregacao || "Geral";
  };

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setCarregando(true);
    setErroBanco(null);
    
    try {
      const { data: dadosMembros, error: errMembros } = await supabase
        .from("membros")
        .select("*");

      if (errMembros) throw new Error(`Erro ao buscar membros: ${errMembros.message}`);

      const { data: dadosLancamentos, error: errLancamentos } = await supabase
        .from("tesouraria_lancamentos")
        .select("*");

      if (errLancamentos) throw new Error(`Erro ao buscar lançamentos: ${errLancamentos.message}`);

      const { data: dadosDizimistas, error: errDizimistas } = await supabase
        .from("tesouraria_dizimistas")
        .select("*");

      if (errDizimistas) throw new Error(`Erro nos dizimistas: ${errDizimistas.message}`);

      if (dadosMembros) {
        dadosMembros.sort((a, b) => obterNomeMembro(a).localeCompare(obterNomeMembro(b)));
        setMembros(dadosMembros);

        const listaCongs = Array.from(
          new Set(dadosMembros.map((m) => obterCongregacaoMembro(m).trim()).filter((c) => c !== ""))
        ).sort() as string[];
        setCongregacoes(listaCongs);

        if (dadosDizimistas) {
          const dizimistasUnidos = dadosDizimistas.map((d: any) => {
            const dadosDoMembro = dadosMembros.find(m => String(m.id) === String(d.membro_id));
            return {
              ...d,
              membros: dadosDoMembro || null
            };
          });
          setDizimistas(dizimistasUnidos);
        }
      }

      if (dadosLancamentos) setLancamentos(dadosLancamentos);

    } catch (error: any) {
      setErroBanco(error.message);
    } finally {
      setCarregando(false);
    }
  }

  const membrosDisponiveis = membros.filter(m => 
    !dizimistas.some(d => String(d.membro_id) === String(m.id))
  );

  const membrosFiltradosForm = congregacaoForm 
    ? membrosDisponiveis.filter(m => obterCongregacaoMembro(m) === congregacaoForm)
    : membrosDisponiveis;

  const salvarDizimista = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membroSelecionado) return;

    setSalvando(true);
    const { error } = await supabase
      .from("tesouraria_dizimistas")
      .insert([{ membro_id: String(membroSelecionado) }]);

    if (error) {
      alert("Erro ao salvar: " + error.message);
    } else {
      setMembroSelecionado("");
      carregarDados();
    }
    setSalvando(false);
  };

  const removerDizimista = async (id: number) => {
    if (!confirm("Remover este membro dos dizimistas ativos?")) return;
    const { error } = await supabase.from("tesouraria_dizimistas").delete().eq("id", id);
    if (!error) carregarDados();
  };

  // ========== METRICAS E FILTROS ==========
  const dizimistasFiltrados = dizimistas.filter((d) => {
    const cong = obterCongregacaoMembro(d.membros);
    return congregacaoFiltro === "" || cong === congregacaoFiltro;
  });

  const lancamentosFiltrados = lancamentos.filter((lanc) => {
    return congregacaoFiltro === "" || lanc.congregacao === congregacaoFiltro;
  });

  const valorTotalDizimosMes = lancamentosFiltrados.reduce((acc, l) => acc + (Number(l.dizimos) || 0), 0);
  const qtdDizimistasAtivos = dizimistasFiltrados.length;
  const mediaDizimo = qtdDizimistasAtivos > 0 ? valorTotalDizimosMes / qtdDizimistasAtivos : 0;

  const formatarMoeda = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
  const formatarData = (dataSql: string) => {
    if (!dataSql) return "-";
    const data = new Date(dataSql);
    return data.toLocaleDateString("pt-BR");
  };

  if (erroBanco) {
    return (
      <div className="max-w-2xl mx-auto mt-10 bg-white border border-red-200 rounded-xl p-6 text-center shadow-sm">
        <h2 className="text-lg font-bold text-red-600 mb-2">Diagnóstico de Sincronização</h2>
        <p className="text-sm text-gray-600 mb-4">{erroBanco}</p>
        <button onClick={carregarDados} className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-black transition">Tentar Novamente</button>
      </div>
    );
  }

  if (carregando) return <div className="p-8 text-center text-gray-500 font-medium text-sm">Carregando painel de dizimistas...</div>;

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
              <select value={congregacaoForm} onChange={(e) => { setCongregacaoForm(e.target.value); setMembroSelecionado(""); }} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">Todas as Congregações</option>
                {congregacoes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
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
            <select value={congregacaoFiltro} onChange={(e) => setCongregacaoFiltro(e.target.value)} className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none flex-1 font-semibold text-gray-800">
              <option value="">Geral (Todas as Congregações)</option>
              {congregacoes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
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
                  <tr className="bg-gray-50 border-b border-gray-100 sticky top-0">
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
                          <button onClick={() => removerDizimista(d.id)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded text-xs font-bold">Remover</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-sm">Nenhum dizimista ativo listado.</td>
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