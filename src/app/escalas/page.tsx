"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { podeEditar, formatarPerfis } from "../../lib/permissoes";

const paletasDeCores = [
  { base: "bg-teal-600", text: "text-teal-700", light: "bg-teal-50", border: "border-teal-200", hover: "hover:bg-teal-600", icon: "text-teal-500" },
  { base: "bg-orange-500", text: "text-orange-600", light: "bg-orange-50", border: "border-orange-200", hover: "hover:bg-orange-500", icon: "text-orange-500" },
  { base: "bg-blue-600", text: "text-blue-700", light: "bg-blue-50", border: "border-blue-200", hover: "hover:bg-blue-600", icon: "text-blue-500" },
  { base: "bg-rose-500", text: "text-rose-600", light: "bg-rose-50", border: "border-rose-200", hover: "hover:bg-rose-500", icon: "text-rose-500" },
  { base: "bg-indigo-600", text: "text-indigo-700", light: "bg-indigo-50", border: "border-indigo-200", hover: "hover:bg-indigo-600", icon: "text-indigo-500" },
  { base: "bg-amber-500", text: "text-amber-600", light: "bg-amber-50", border: "border-amber-200", hover: "hover:bg-amber-500", icon: "text-amber-500" }
];

export default function EscalasPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [dataAtual, setDataAtual] = useState(new Date());
  const [igrejaIdLogada, setIgrejaIdLogada] = useState<string | null>(null);
  const [perfisUsuario, setPerfisUsuario] = useState<string[]>([]);
  
  // ==========================================
  // ESTADOS DO MULTI-TENANCY HIERÁRQUICO
  // ==========================================
  const [inicializado, setInicializado] = useState(false);
  const [ehSede, setEhSede] = useState(false);
  const [nomeSedeOficial, setNomeSedeOficial] = useState("Sede");
  const [congregacaoUsuario, setCongregacaoUsuario] = useState("");
  const [filtroCongregacao, setFiltroCongregacao] = useState("Todas");
  const [congregacoesDisponiveis, setCongregacoesDisponiveis] = useState<string[]>([]);

  // Estados dos Dados
  const [escalasRaw, setEscalasRaw] = useState<any[]>([]);
  const [escalas, setEscalas] = useState<any[]>([]);
  const [tiposExistentes, setTiposExistentes] = useState<string[]>([]);
  const [escalasAgrupadas, setEscalasAgrupadas] = useState<Record<string, any[]>>({});

  // Estados para Modais de Edição e Exclusão
  const [escalaExcluindo, setEscalaExcluindo] = useState<string | null>(null);
  const [escalaEditando, setEscalaEditando] = useState<any | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // 1. IDENTIFICAÇÃO E CONFIGURAÇÃO DA HIERARQUIA
  useEffect(() => {
    setIsClient(true);
    const usuarioLocal = localStorage.getItem("usuarioLogado");
    
    if (!usuarioLocal) {
      router.push("/login");
      return;
    }
    
    const usuario = JSON.parse(usuarioLocal);
    const igrejaId = usuario.igreja_id || usuario.id_igreja || usuario.idIgreja;
    setIgrejaIdLogada(igrejaId);
    setPerfisUsuario(formatarPerfis(usuario.perfis || usuario.nivel_acesso));

    async function carregarConfiguracoesDaIgreja() {
      try {
        const { data: config } = await supabase
          .from("configuracao_igreja")
          .select("nome_igreja")
          .eq("igreja_id", igrejaId)
          .maybeSingle();

        const nomeSede = config?.nome_igreja?.trim() || "Sede Principal";
        setNomeSedeOficial(nomeSede);

        const congUser = usuario?.congregacao?.trim() || "";
        setCongregacaoUsuario(congUser);
        
        const congLow = congUser.toLowerCase();
        const isUserSede = !congLow || congLow === "sede" || congLow === "matriz" || congLow === "geral" || congLow === nomeSede.toLowerCase();
        
        setEhSede(isUserSede);

        if (isUserSede) {
          const { data: filhas } = await supabase
            .from("igrejas_filhas")
            .select("nome")
            .eq("igreja_id", igrejaId)
            .order("nome", { ascending: true });

          const nomesFilhas = filhas ? filhas.map(f => f.nome) : [];
          setCongregacoesDisponiveis([nomeSede, ...nomesFilhas]);
          
          // -> MÁGICA AQUI: Define a Sede como valor default na tela de painel <-
          setFiltroCongregacao(nomeSede);
        } else {
          setFiltroCongregacao(congUser);
        }

        setInicializado(true);
      } catch (error) {
        console.error("Erro ao inicializar:", error);
      }
    }

    if (igrejaId) carregarConfiguracoesDaIgreja();
  }, [router]);


  // 2. BUSCA DAS ESCALAS (Dispara quando muda o Mês ou quando Inicializa)
  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    
    async function buscarEscalas() {
      if (!igrejaIdLogada || !inicializado) return;
      
      setCarregando(true);
      const inicio = format(startOfMonth(dataAtual), "yyyy-MM-dd");
      const fim = format(endOfMonth(dataAtual), "yyyy-MM-dd");

      let query = supabase
        .from("escalas")
        .select("*")
        .eq("igreja_id", igrejaIdLogada)
        .gte("data", inicio)
        .lte("data", fim)
        .order("data", { ascending: true });

      if (!ehSede) {
        query = query.eq("congregacao", congregacaoUsuario);
      }

      const { data, error } = await query;
      if (!error && data) {
        setEscalasRaw(data);
      } else {
        setEscalasRaw([]);
      }
      setCarregando(false);
    }

    buscarEscalas();
    return () => { document.documentElement.style.scrollBehavior = 'auto'; };
  }, [dataAtual, inicializado, igrejaIdLogada, ehSede, congregacaoUsuario]);


  // 3. FILTRO LOCAL EM TEMPO REAL
  useEffect(() => {
    if (!escalasRaw) return;

    const normalizarSede = (c: string) => {
      const cong = c?.trim();
      if (!cong || cong.toLowerCase() === "sede" || cong.toLowerCase() === "matriz" || cong.toLowerCase() === "geral" || cong.toLowerCase() === nomeSedeOficial.toLowerCase()) {
        return nomeSedeOficial;
      }
      return cong;
    };

    // Aplica o filtro de congregação na tela
    const filtradas = filtroCongregacao === "Todas"
      ? escalasRaw
      : escalasRaw.filter(e => normalizarSede(e.congregacao) === filtroCongregacao);

    setEscalas(filtradas);

    // Agrupa e prepara o layout para a lista filtrada
    const agrupado: Record<string, any[]> = {};
    filtradas.forEach(escala => {
      const nomeTipo = escala.tipo === "Outro" ? (escala.tipo_personalizado || "Outros") : escala.tipo;
      if (!agrupado[nomeTipo]) agrupado[nomeTipo] = [];
      agrupado[nomeTipo].push(escala);
    });
    
    setEscalasAgrupadas(agrupado);
    setTiposExistentes(Object.keys(agrupado).sort());

  }, [filtroCongregacao, escalasRaw, nomeSedeOficial]);


  // --- FUNÇÕES DE EXCLUSÃO ---
  async function confirmarExclusao() {
    if (!escalaExcluindo || !igrejaIdLogada) return;
    try {
      const { error } = await supabase
        .from("escalas")
        .delete()
        .eq("id", escalaExcluindo)
        .eq("igreja_id", igrejaIdLogada); 
      
      if (error) throw error;
      
      setEscalaExcluindo(null);
      // Remove localmente para não precisar dar fetch inteiro de novo
      setEscalasRaw(prev => prev.filter(e => e.id !== escalaExcluindo));
    } catch (error: any) {
      alert("Erro ao excluir: " + error.message);
    }
  }

  // --- FUNÇÕES DE EDIÇÃO ---
  const atualizarCampoEdicao = (idLinha: number, campo: string, valor: string) => {
    setEscalaEditando({
      ...escalaEditando,
      detalhes: escalaEditando.detalhes.map((l: any) => l.id === idLinha ? { ...l, [campo]: valor } : l)
    });
  };

  const adicionarLinhaEdicao = () => {
    const linhasAtuais = escalaEditando.detalhes;
    const novoId = linhasAtuais.length > 0 ? Math.max(...linhasAtuais.map((l: any) => l.id)) + 1 : 1;
    let novaLinha = {};
    
    if (escalaEditando.tipo === "Louvor") novaLinha = { id: novoId, instrumento: "Voz", nome: "" };
    else if (escalaEditando.tipo === "EBD" || escalaEditando.tipo === "DEPIN") novaLinha = { id: novoId, sala: "", professor: "", auxiliar: "" };
    else novaLinha = { id: novoId, funcao: "", nome: "" };
    
    setEscalaEditando({ ...escalaEditando, detalhes: [...linhasAtuais, novaLinha] });
  };

  const removerLinhaEdicao = (idLinha: number) => {
    setEscalaEditando({
      ...escalaEditando,
      detalhes: escalaEditando.detalhes.filter((l: any) => l.id !== idLinha)
    });
  };

  async function salvarEdicao() {
    if (!igrejaIdLogada) return;
    
    setSalvandoEdicao(true);
    try {
      const { error } = await supabase
        .from("escalas")
        .update({
          descricao: escalaEditando.descricao,
          detalhes: escalaEditando.detalhes
        })
        .eq("id", escalaEditando.id)
        .eq("igreja_id", igrejaIdLogada);

      if (error) throw error;
      
      // Atualiza os dados brutos localmente e fecha o modal
      setEscalasRaw(prev => prev.map(e => e.id === escalaEditando.id ? { ...e, descricao: escalaEditando.descricao, detalhes: escalaEditando.detalhes } : e));
      setEscalaEditando(null);
    } catch (error: any) {
      alert("Erro ao salvar: " + error.message);
    } finally {
      setSalvandoEdicao(false);
    }
  }

  const capitalizar = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
  const criarIdAncora = (nome: string) => `secao-${nome.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  // Trava central de permissão para esse módulo
  const ehEditor = podeEditar(perfisUsuario, 'escalas');

  return (
    <>
      <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in pb-20 relative">
        
        {/* CABEÇALHO */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-[28px] font-bold text-gray-900 tracking-tight">Escalas Mensais</h1>
            <p className="text-sm text-gray-500 mt-1">Visualize e organize os ministérios da igreja.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            
            {/* SELETOR HIERÁRQUICO */}
            {ehSede && congregacoesDisponiveis.length > 0 && (
              <select
                value={filtroCongregacao}
                onChange={(e) => setFiltroCongregacao(e.target.value)}
                className="w-full sm:w-auto max-w-full truncate px-4 py-2.5 bg-indigo-50 border border-indigo-100 text-indigo-800 font-bold text-sm rounded-lg hover:border-indigo-300 focus:border-indigo-500 outline-none transition-all shadow-sm cursor-pointer"
              >
                <option value={nomeSedeOficial}>🏢 {nomeSedeOficial} (Sede)</option>
                <option value="Todas">🌍 Todas as Congregações</option>
                {congregacoesDisponiveis.filter(c => c !== nomeSedeOficial).map(c => (
                  <option key={c} value={c}>📍 {c}</option>
                ))}
              </select>
            )}

            {!ehSede && congregacaoUsuario && (
              <div className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 border border-gray-200 text-gray-600 font-bold text-sm rounded-lg shadow-sm truncate cursor-not-allowed">
                📍 {congregacaoUsuario}
              </div>
            )}

            {/* ESCONDE O BOTÃO DE NOVA ESCALA SE NÃO FOR EDITOR */}
            {ehEditor && (
              <Link href="/escalas/novo" className="w-full sm:w-auto text-center px-6 py-2.5 bg-teal-600 text-white font-bold rounded-lg shadow-md hover:bg-teal-700 transition flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Nova Escala
              </Link>
            )}
          </div>
        </div>

        {/* NAVEGAÇÃO DE MÊS */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between mb-8">
          <button onClick={() => setDataAtual(subMonths(dataAtual, 1))} className="p-2 hover:bg-gray-100 rounded-full transition">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h2 className="text-xl font-bold text-gray-800 uppercase tracking-widest">
            {capitalizar(format(dataAtual, "MMMM yyyy", { locale: ptBR }))}
          </h2>
          <button onClick={() => setDataAtual(addMonths(dataAtual, 1))} className="p-2 hover:bg-gray-100 rounded-full transition">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* MENU DE ANCORAS (Tipos de Escalas) */}
        {!carregando && tiposExistentes.length > 0 && (
          <div className="sticky top-[80px] z-30 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-md border border-gray-200 mb-10 flex flex-col md:flex-row md:items-center gap-4 transition-all">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
              Navegar:
            </span>
            <div className="flex flex-wrap gap-2">
              {tiposExistentes.map((tipo, index) => {
                const cor = paletasDeCores[index % paletasDeCores.length];
                return (
                  <a key={tipo} href={`#${criarIdAncora(tipo)}`} className={`px-5 py-2 ${cor.light} border ${cor.border} ${cor.text} ${cor.hover} hover:text-white rounded-full text-xs font-black uppercase tracking-wide transition-colors`}>
                    {tipo}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* CONTEÚDO PRINCIPAL */}
        {carregando ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div></div>
        ) : escalas.length === 0 ? (
          <div className="bg-white p-20 rounded-2xl border-2 border-dashed border-gray-200 text-center">
            <p className="text-gray-400 text-lg">Nenhuma escala encontrada para esta congregação neste mês.</p>
          </div>
        ) : (
          <div className="space-y-16">
            {tiposExistentes.map((tipo, index) => {
              const cor = paletasDeCores[index % paletasDeCores.length];

              return (
                <section key={tipo} id={criarIdAncora(tipo)} className="scroll-mt-40">
                  <div className="flex items-center gap-4 mb-8 border-b-2 border-gray-100 pb-4">
                    <div className={`w-2.5 h-10 rounded-full ${cor.base}`}></div>
                    <h3 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">{tipo}</h3>
                    <span className={`${cor.light} ${cor.text} border ${cor.border} px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ml-2`}>
                      {escalasAgrupadas[tipo].length} dias
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {escalasAgrupadas[tipo].map((escala) => (
                      <div key={escala.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow flex flex-col group">
                        
                        <div className={`${cor.base} p-4 flex justify-between items-center text-white shrink-0`}>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-xl tracking-widest">
                              {format(parseISO(escala.data), "dd/MM")}
                            </span>
                            <span className="bg-white/25 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">
                              {format(parseISO(escala.data), "EEEE", { locale: ptBR })}
                            </span>
                          </div>
                          
                          {/* ESCONDE OS BOTÕES DE EDIÇÃO/EXCLUSÃO SE NÃO FOR EDITOR */}
                          {ehEditor && (
                            <div className="flex items-center gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEscalaEditando(escala)} className="p-1.5 bg-white/20 hover:bg-white/40 rounded transition" title="Editar Escala">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                              <button onClick={() => setEscalaExcluindo(escala.id)} className="p-1.5 bg-white/20 hover:bg-red-500 rounded transition" title="Excluir Escala">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {escala.descricao && (
                          <div className={`px-5 py-3 ${cor.light} border-b ${cor.border} shrink-0`}>
                            <span className={`block text-[10px] font-black uppercase tracking-widest ${cor.text} opacity-80 mb-0.5`}>Tema / Obs:</span>
                            <span className={`text-sm font-semibold italic ${cor.text}`}>{escala.descricao}</span>
                          </div>
                        )}
                        
                        <div className="p-6 space-y-5 flex-1">
                          {escala.detalhes.map((item: any, idx: number) => (
                            <div key={idx} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                              {escala.tipo === "Culto" || escala.tipo === "Outro" ? (
                                <div>
                                  <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider mb-1">{item.funcao || 'Cargo'}</p>
                                  <p className="font-bold text-gray-800 text-lg">{item.nome || '-'}</p>
                                </div>
                              ) : escala.tipo === "Louvor" ? (
                                <div className="flex justify-between items-center">
                                   <div>
                                      <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider mb-1">{item.instrumento === "Outro" ? item.instrumento_outro : item.instrumento}</p>
                                      <p className="font-bold text-gray-800 text-lg">{item.nome}</p>
                                   </div>
                                   <div className={`${cor.icon} bg-gray-50 p-2 rounded-full`}>
                                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 1.045-3 2.333S3.343 18.667 5 18.667s3-1.045 3-2.334V10.43l9-1.8v4.484a4.369 4.369 0 00-1-.114c-1.657 0-3 1.045-3 2.333s1.343 2.334 3 2.334 3-1.045 3-2.334V3z" /></svg>
                                   </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className={`text-[10px] font-black uppercase tracking-wider ${cor.text} ${cor.light} px-2 py-0.5 rounded`}>Sala</span>
                                    <p className="text-sm font-bold text-gray-800">{item.sala}</p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                     <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Professor</p>
                                        <p className="text-base font-bold text-gray-800">{item.professor}</p>
                                     </div>
                                     {item.auxiliar && (
                                       <div>
                                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Auxiliar</p>
                                          <p className="text-base font-bold text-gray-800">{item.auxiliar}</p>
                                       </div>
                                     )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* --- MODAIS RENDERIZADOS NO BODY (IGNORA QUALQUER LAYOUT E FIXA NA TELA REAL) --- */}
      {isClient && escalaExcluindo && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[99999] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-fade-in-up">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Excluir Escala?</h2>
            <p className="text-gray-500 mb-8">Tem certeza? Esta ação não poderá ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setEscalaExcluindo(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition">Cancelar</button>
              <button onClick={confirmarExclusao} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-md">Sim, Excluir</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isClient && escalaEditando && createPortal(
        <div className="fixed inset-0 bg-black/60 flex justify-center z-[99999] p-4 sm:p-6 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl animate-fade-in-up flex flex-col my-auto max-h-[90vh]">
            
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0 rounded-t-3xl">
              <div>
                <h2 className="text-xl font-black text-gray-900 uppercase">Editar Escala</h2>
                <p className="text-sm text-gray-500">{format(parseISO(escalaEditando.data), "dd/MM/yyyy")} - {escalaEditando.tipo}</p>
              </div>
              <button onClick={() => setEscalaEditando(null)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <label className="block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2">Tema / Descrição / Observação</label>
                <textarea 
                  value={escalaEditando.descricao || ""}
                  onChange={(e) => setEscalaEditando({...escalaEditando, descricao: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none resize-none bg-white text-sm"
                  rows={2}
                ></textarea>
              </div>

              {escalaEditando.detalhes.map((linha: any) => (
                <div key={linha.id} className="flex items-end gap-3 pb-6 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {escalaEditando.tipo === "Louvor" ? (
                      <>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Instrumento</label>
                          <select value={linha.instrumento} onChange={(e) => atualizarCampoEdicao(linha.id, "instrumento", e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                            <option value="Voz">Voz</option><option value="Teclado">Teclado</option><option value="Violão">Violão</option><option value="Guitarra">Guitarra</option><option value="Baixo">Baixo</option><option value="Bateria">Bateria</option><option value="Outro">Outro...</option>
                          </select>
                          {linha.instrumento === "Outro" && (
                            <input type="text" value={linha.instrumento_outro || ""} onChange={(e) => atualizarCampoEdicao(linha.id, "instrumento_outro", e.target.value)} placeholder="Qual?" className="w-full mt-2 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                          )}
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Nome do Membro</label>
                          <input type="text" value={linha.nome || ""} onChange={(e) => atualizarCampoEdicao(linha.id, "nome", e.target.value)} placeholder="Nome completo" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                        </div>
                      </>
                    ) : escalaEditando.tipo === "EBD" || escalaEditando.tipo === "DEPIN" ? (
                      <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Sala</label>
                          <input type="text" value={linha.sala || ""} onChange={(e) => atualizarCampoEdicao(linha.id, "sala", e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Professor</label>
                          <input type="text" value={linha.professor || ""} onChange={(e) => atualizarCampoEdicao(linha.id, "professor", e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Auxiliar</label>
                          <input type="text" value={linha.auxiliar || ""} onChange={(e) => atualizarCampoEdicao(linha.id, "auxiliar", e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Cargo</label>
                          <input type="text" value={linha.funcao || ""} onChange={(e) => atualizarCampoEdicao(linha.id, "funcao", e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Nome</label>
                          <input type="text" value={linha.nome || ""} onChange={(e) => atualizarCampoEdicao(linha.id, "nome", e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                        </div>
                      </>
                    )}
                  </div>
                  <button onClick={() => removerLinhaEdicao(linha.id)} className="p-3 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 rounded-xl transition-colors flex-shrink-0 mb-[2px]" title="Remover">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
              
              <button onClick={adicionarLinhaEdicao} className="flex items-center gap-2 text-sm font-bold text-teal-600 hover:text-teal-800 transition">
                <span className="bg-teal-50 p-1 rounded-md">+</span> Adicionar mais pessoas
              </button>

            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50/50 shrink-0 rounded-b-3xl flex gap-3">
              <button onClick={() => setEscalaEditando(null)} className="flex-1 py-3.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition shadow-sm">Cancelar</button>
              <button onClick={salvarEdicao} disabled={salvandoEdicao} className="flex-1 py-3.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition shadow-md disabled:opacity-50">
                {salvandoEdicao ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}
    </>
  );
}