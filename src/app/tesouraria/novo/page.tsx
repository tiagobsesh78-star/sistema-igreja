"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { podeEditar, formatarPerfis } from "../../../lib/permissoes";

export default function NovoLancamento() {
  const router = useRouter();
  
  // 1. TODOS OS STATES DEVEM FICAR NO TOPO
  const [dataLancamento, setDataLancamento] = useState("");
  const [tipoTrabalho, setTipoTrabalho] = useState("Culto");
  const [congregacao, setCongregacao] = useState("");
  const [ofertas, setOfertas] = useState<number | "">("");
  const [dizimos, setDizimos] = useState<number | "">("");
  const [ofertaEspecial, setOfertaEspecial] = useState<number | "">("");
  const [saidas, setSaidas] = useState<number | "">("");
  
  const [listaCongregacoes, setListaCongregacoes] = useState<string[]>([]);
  const [carregandoCongregacoes, setCarregandoCongregacoes] = useState(true);
  
  const [salvando, setSalvando] = useState(false);
  const [mostrarModalSucesso, setMostrarModalSucesso] = useState(false);
  const [igrejaIdLogada, setIgrejaIdLogada] = useState<string | null>(null);

  // 2. EFFECT PRINCIPAL COM A TRAVA DE ROTA (SEGURANÇA TOTAL)
  useEffect(() => {
    const hoje = new Date().toISOString().split("T")[0];
    setDataLancamento(hoje);

    const usuarioLocal = localStorage.getItem("usuarioLogado");
    if (!usuarioLocal) {
      router.push("/login");
      return;
    }

    const usuario = JSON.parse(usuarioLocal);
    const perfisLogado = formatarPerfis(usuario.perfis || usuario.nivel_acesso);

    // ==================================================
    // TRAVA DE ROTA: CHUTA INVASORES PELA URL PARA A HOME
    // ==================================================
    if (!podeEditar(perfisLogado, 'tesouraria')) {
      router.push("/");
      return; // Interrompe a execução
    }
    // ==================================================

    const igrejaId = usuario.igreja_id;
    setIgrejaIdLogada(igrejaId);

    // Nova função inteligente de busca de Congregações
    async function buscarListaCongregacoes(idIgreja: string) {
      try {
        // 1. Busca o nome da Igreja Mãe (Sede)
        const { data: config } = await supabase
          .from("configuracao_igreja")
          .select("nome_igreja")
          .eq("igreja_id", idIgreja)
          .maybeSingle();

        const nomeSede = config?.nome_igreja || "Sede Principal";

        // 2. Busca as Igrejas Filhas em ordem alfabética
        const { data: filhas } = await supabase
          .from("igrejas_filhas")
          .select("nome")
          .eq("igreja_id", idIgreja)
          .order("nome", { ascending: true });

        const nomesFilhas = filhas ? filhas.map(f => f.nome) : [];

        // 3. Monta a lista final e salva no state
        setListaCongregacoes([nomeSede, ...nomesFilhas]);
      } catch (error) {
        console.error("Erro ao buscar congregações:", error);
        setListaCongregacoes(["Sede Principal"]); // Fallback em caso de erro
      } finally {
        setCarregandoCongregacoes(false);
      }
    }

    if (igrejaId) {
      buscarListaCongregacoes(igrejaId);
    }
  }, [router]);

  // Cálculo automático do Total
  const valorOfertas = Number(ofertas) || 0;
  const valorDizimos = Number(dizimos) || 0;
  const valorEspecial = Number(ofertaEspecial) || 0;
  const valorSaidas = Number(saidas) || 0;
  
  const totalCalculado = valorOfertas + valorDizimos + valorEspecial - valorSaidas;

  const salvarLancamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!congregacao) {
      alert("Por favor, selecione a congregação deste trabalho.");
      return;
    }
    
    if (!igrejaIdLogada) {
      alert("Erro de autenticação da igreja. Faça login novamente.");
      return;
    }
    
    setSalvando(true);

    const dadosLancamento = {
      igreja_id: igrejaIdLogada,
      data: dataLancamento,
      tipo_trabalho: tipoTrabalho,
      congregacao: congregacao,
      ofertas: valorOfertas,
      dizimos: valorDizimos,
      oferta_especial: valorEspecial,
      saidas: valorSaidas,
      total: totalCalculado
    };

    try {
      const { error } = await supabase
        .from("tesouraria_lancamentos")
        .insert([dadosLancamento]);

      if (error) throw error;
      
      setMostrarModalSucesso(true);
    } catch (error: any) {
      alert("Erro ao salvar lançamento: " + error.message);
    } finally {
      setSalvando(false);
    }
  };

  const fecharModalELimpar = () => {
    setMostrarModalSucesso(false);
    // Deixei a congregação e data propositalmente sem limpar aqui. 
    // Assim o tesoureiro consegue lançar vários eventos do mesmo dia/igreja mais rápido!
    setOfertas("");
    setDizimos("");
    setOfertaEspecial("");
    setSaidas("");
  };

  const formatarMoedaVisual = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Novo Lançamento</h1>
          <p className="text-sm text-gray-500 mt-1">Registre as entradas e saídas do trabalho realizado.</p>
        </div>
        <button 
          type="button" 
          onClick={() => router.back()} 
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition shadow-sm text-sm"
        >
          Cancelar
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <form onSubmit={salvarLancamento} className="p-6 md:p-8 space-y-8">
          
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">Informações do Trabalho</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Data do Lançamento</label>
                <input 
                  type="date" 
                  required
                  value={dataLancamento}
                  onChange={(e) => setDataLancamento(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-700"
                />
              </div>

              {/* SELETOR ATUALIZADO: IGREJA SEDE E FILHAS */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Congregação Responsável *</label>
                <select 
                  required
                  value={congregacao}
                  onChange={(e) => setCongregacao(e.target.value)}
                  disabled={carregandoCongregacoes}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 font-bold cursor-pointer disabled:opacity-60"
                >
                  {carregandoCongregacoes ? (
                    <option value="">Buscando congregações...</option>
                  ) : (
                    <>
                      <option value="" disabled>Selecione a Congregação</option>
                      {listaCongregacoes.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </>
                  )}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo de Trabalho</label>
                <select 
                  required
                  value={tipoTrabalho}
                  onChange={(e) => setTipoTrabalho(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-700 cursor-pointer"
                >
                  <option value="Culto">Culto</option>
                  <option value="EBD">EBD</option>
                  <option value="Consagração">Consagração</option>
                  <option value="Círculo de oração">Círculo de oração</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">Valores (R$)</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Ofertas</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={ofertas}
                  onChange={(e) => setOfertas(e.target.value ? parseFloat(e.target.value) : "")}
                  className="w-full px-4 py-2.5 bg-blue-50/50 border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 font-medium placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Dízimos</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={dizimos}
                  onChange={(e) => setDizimos(e.target.value ? parseFloat(e.target.value) : "")}
                  className="w-full px-4 py-2.5 bg-blue-50/50 border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 font-medium placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Oferta Especial</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={ofertaEspecial}
                  onChange={(e) => setOfertaEspecial(e.target.value ? parseFloat(e.target.value) : "")}
                  className="w-full px-4 py-2.5 bg-blue-50/50 border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 font-medium placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Saídas</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={saidas}
                  onChange={(e) => setSaidas(e.target.value ? parseFloat(e.target.value) : "")}
                  className="w-full px-4 py-2.5 bg-red-50 border border-red-100 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm text-red-700 font-medium placeholder-red-300"
                />
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-xl flex flex-col md:flex-row items-center justify-between border ${totalCalculado >= 0 ? 'bg-teal-50 border-teal-100' : 'bg-red-50 border-red-100'}`}>
            <span className={`text-sm font-bold uppercase tracking-wider ${totalCalculado >= 0 ? 'text-teal-800' : 'text-red-800'}`}>
              Total do Trabalho
            </span>
            <span className={`text-3xl font-black tracking-tight ${totalCalculado >= 0 ? 'text-teal-700' : 'text-red-700'}`}>
              {formatarMoedaVisual(totalCalculado)}
            </span>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <button 
              type="submit" 
              disabled={salvando || carregandoCongregacoes}
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-sm transition disabled:bg-teal-400 flex items-center justify-center gap-2"
            >
              {salvando ? "Salvando Lançamento..." : "Registrar na Tesouraria"}
            </button>
          </div>

        </form>
      </div>

      {mostrarModalSucesso && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 cursor-pointer" onClick={fecharModalELimpar}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center cursor-default" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Lançamento Salvo!</h3>
            <p className="text-gray-500 text-sm mb-6">Valores registrados com sucesso.</p>
            <div className="flex flex-col gap-3">
              <button onClick={fecharModalELimpar} className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition">OK, Novo Lançamento</button>
              <button onClick={() => router.push("/tesouraria")} className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition">Voltar para Resumo</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}