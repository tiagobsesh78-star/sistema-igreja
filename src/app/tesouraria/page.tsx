"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../src/lib/supabase";
import { podeVisualizar, podeEditar, formatarPerfis } from "../../../src/lib/permissoes";

// ==========================================
// INTERFACES DOS CAMPOS DINÂMICOS
// ==========================================
interface Membro {
  id: string;
  nome: string;
  congregacao?: string;
}

interface DizimoItem {
  id: string;
  is_avulso: boolean;
  membro_id: string;
  nome_avulso: string;
  valor: number | "";
}

interface OfertaEspecialItem {
  id: string;
  descricao: string;
  valor: number | "";
}

interface SaidaItem {
  id: string;
  descricao: string;
  valor: number | "";
}

// ==========================================
// COMPONENTE: SELECT DE MEMBROS COM LUPA (Para a Edição)
// ==========================================
const MembroSearchSelect = ({ 
  membros, 
  valor, 
  onChange 
}: { 
  membros: Membro[], 
  valor: string, 
  onChange: (val: string) => void 
}) => {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selecionado = membros.find(m => String(m.id) === String(valor));
  
  const normalizarTexto = (texto: string) => {
    return texto?.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() || "";
  };

  const filtrados = membros.filter(m => normalizarTexto(m.nome).includes(normalizarTexto(busca)));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        onClick={() => setAberto(!aberto)}
        className="w-full px-4 py-2.5 bg-blue-50/50 border border-blue-100 rounded-lg flex items-center justify-between cursor-pointer hover:bg-blue-50 transition-colors text-sm"
      >
        <span className={selecionado ? "text-gray-900 font-medium" : "text-gray-400 font-medium truncate pr-2"}>
          {selecionado ? selecionado.nome : "Buscar membro..."}
        </span>
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </div>

      {aberto && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100 bg-gray-50" onClick={e => e.stopPropagation()}>
            <input 
              type="text" 
              autoFocus
              placeholder="Digite o nome..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto">
            {filtrados.length === 0 ? (
              <li className="px-4 py-3 text-sm text-gray-500 text-center">Nenhum membro encontrado na congregação selecionada</li>
            ) : (
              filtrados.map(m => (
                <li 
                  key={m.id} 
                  onClick={() => { onChange(m.id); setAberto(false); setBusca(""); }}
                  className="px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer border-b border-gray-50 last:border-0 transition-colors truncate"
                >
                  {m.nome}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default function TesourariaPage() {
  const router = useRouter();
  
  // 1. STATES PRINCIPAIS
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [perfisUsuario, setPerfisUsuario] = useState<string[]>([]); 
  const [membros, setMembros] = useState<Membro[]>([]);

  const [ehSede, setEhSede] = useState(false);
  const [nomeSedeOficial, setNomeSedeOficial] = useState("Sede");
  const [congregacaoUsuario, setCongregacaoUsuario] = useState("");
  const [igrejaIdLogada, setIgrejaIdLogada] = useState<string | null>(null);

  const [configIgreja, setConfigIgreja] = useState<any>(null);
  const [congregacoes, setCongregacoes] = useState<string[]>([]);
  const [congregacaoSelecionada, setCongregacaoSelecionada] = useState(""); 
  const [configuracoesGlobais, setConfiguracoesGlobais] = useState<any[]>([]);
  const [totalDizimistasGeral, setTotalDizimistasGeral] = useState<any[]>([]);

  const [mesesSelecionados, setMesesSelecionados] = useState<string[]>([]);
  const [anosSelecionados, setAnosSelecionados] = useState<string[]>([]);
  const [tiposSelecionados, setTiposSelecionados] = useState<string[]>([]);
  const [dropdownAberto, setDropdownAberto] = useState<string | null>(null);
  const [opcoesAnos, setOpcoesAnos] = useState<string[]>([]);

  // Modal Visualização
  const [modalVerAberto, setModalVerAberto] = useState(false);
  const [lancamentoParaVer, setLancamentoParaVer] = useState<any>(null);

  // Modal Exclusão
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [lancamentoParaExcluir, setLancamentoParaExcluir] = useState<any>(null);
  const [justificativa, setJustificativa] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  // NOVO: Modal Assinaturas para o PDF
  const [modalAssinaturasAberto, setModalAssinaturasAberto] = useState(false);
  const [assinaturasSelecionadas, setAssinaturasSelecionadas] = useState<string[]>([]);

  // Modal Edição (Com Listas Dinâmicas)
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [lancamentoParaEditar, setLancamentoParaEditar] = useState<any>(null);
  
  const [editData, setEditData] = useState("");
  const [editTipoTrabalho, setEditTipoTrabalho] = useState("");
  const [editTipoTrabalhoPersonalizado, setEditTipoTrabalhoPersonalizado] = useState("");
  const [editOfertas, setEditOfertas] = useState<number | "">("");
  const [editJustificativa, setEditJustificativa] = useState("");
  
  const [listaDizimos, setListaDizimos] = useState<DizimoItem[]>([]);
  const [listaOfertasEspeciais, setListaOfertasEspeciais] = useState<OfertaEspecialItem[]>([]);
  const [listaSaidas, setListaSaidas] = useState<SaidaItem[]>([]);

  const opcoesMeses = [
    { valor: "01", rotulo: "Janeiro" }, { valor: "02", rotulo: "Fevereiro" },
    { valor: "03", rotulo: "Março" }, { valor: "04", rotulo: "Abril" },
    { valor: "05", rotulo: "Maio" }, { valor: "06", rotulo: "Junho" },
    { valor: "07", rotulo: "Julho" }, { valor: "08", rotulo: "Agosto" },
    { valor: "09", rotulo: "Setembro" }, { valor: "10", rotulo: "Outubro" },
    { valor: "11", rotulo: "Novembro" }, { valor: "12", rotulo: "Dezembro" }
  ];
  const opcoesTipos = ["Culto", "EBD", "Consagração", "Círculo de oração", "Outros"];

  // 2. FETCH DE DADOS
  useEffect(() => {
    async function carregarDados() {
      const usuarioLocal = localStorage.getItem("usuarioLogado");
      if (!usuarioLocal) {
        router.push("/login");
        return;
      }
      const usuario = JSON.parse(usuarioLocal);
      const perfisLogado = formatarPerfis(usuario.perfis || usuario.nivel_acesso);
      
      if (!podeVisualizar(perfisLogado, 'tesouraria')) {
        router.push("/");
        return; 
      }

      setPerfisUsuario(perfisLogado);
      const igrejaId = usuario.igreja_id || usuario.id_igreja || usuario.idIgreja;
      setIgrejaIdLogada(igrejaId);

      if (!igrejaId) {
        setCarregando(false);
        return;
      }

      try {
        const { data: dadosIgreja } = await supabase.from("configuracao_igreja").select("*").eq("igreja_id", igrejaId).limit(1).maybeSingle();
        if (dadosIgreja) setConfigIgreja(dadosIgreja);

        const nomeSede = dadosIgreja?.nome_igreja?.trim() || "Sede Principal";
        setNomeSedeOficial(nomeSede);

        const congUser = usuario?.congregacao?.trim() || "";
        setCongregacaoUsuario(congUser);
        
        const congLow = congUser.toLowerCase();
        const isUserSede = !congLow || congLow === "sede" || congLow === "matriz" || congLow === "geral" || congLow === nomeSede.toLowerCase();
        
        setEhSede(isUserSede);

        // Sempre inicializar o filtro com a congregação do próprio usuário logado
        if (isUserSede) {
          setCongregacaoSelecionada(nomeSede);
        } else {
          setCongregacaoSelecionada(congUser);
        }

        let queryMembros = supabase.from("membros").select("*").eq("igreja_id", igrejaId);
        let queryLancamentos = supabase.from("tesouraria_lancamentos").select("*").eq("igreja_id", igrejaId).order("data", { ascending: false });

        if (!isUserSede) {
          queryMembros = queryMembros.eq("congregacao", congUser);
          queryLancamentos = queryLancamentos.eq("congregacao", congUser);
        }

        const [resMembros, resLancamentos, resConfigs, resDizimistas, resFilhas] = await Promise.all([
          queryMembros,
          queryLancamentos,
          supabase.from("tesouraria_configuracoes").select("*").eq("igreja_id", igrejaId),
          supabase.from("tesouraria_dizimistas").select("*").eq("igreja_id", igrejaId),
          supabase.from("igrejas_filhas").select("nome").eq("igreja_id", igrejaId).order("nome", { ascending: true })
        ]);

        if (isUserSede) {
          const nomesFilhas = resFilhas.data ? resFilhas.data.map(f => f.nome) : [];
          setCongregacoes([nomeSede, ...nomesFilhas]);
        }

        if (resMembros.data) {
          setMembros(resMembros.data.map(m => ({ id: m.id, nome: m.nome_completo, congregacao: m.congregacao })));
        }

        if (resConfigs.data) setConfiguracoesGlobais(resConfigs.data);

        if (resDizimistas.data && resMembros.data) {
          const unidos = resDizimistas.data.map(d => ({
            ...d,
            membros: resMembros.data.find(m => String(m.id) === String(d.membro_id)) || null
          })).filter(d => d.membros !== null); 
          setTotalDizimistasGeral(unidos);
        }

        if (resLancamentos.data) {
          setLancamentos(resLancamentos.data);
          const anosNoBanco = resLancamentos.data.map(l => l.data.split("-")[0]);
          const anosUnicos = Array.from(new Set([...anosNoBanco, String(new Date().getFullYear())])).sort();
          setOpcoesAnos(anosUnicos);
        }
      } catch (err) {
        console.error("Erro ao carregar tesouraria:", err);
      } finally {
        setCarregando(false);
      }
    }
    
    carregarDados();
  }, [router]);

  // 3. UTILITÁRIOS E FILTROS GERAIS
  const toggleFiltro = (lista: string[], setLista: any, valor: string) => {
    if (lista.includes(valor)) setLista(lista.filter((v) => v !== valor));
    else setLista([...lista, valor]);
  };

  const normalizarSede = (c: string) => {
    const cong = c?.trim();
    if (!cong || cong.toLowerCase() === "sede" || cong.toLowerCase() === "matriz" || cong.toLowerCase() === "geral" || cong.toLowerCase() === nomeSedeOficial.toLowerCase()) {
      return nomeSedeOficial;
    }
    return cong;
  };

  const parseJSON = (data: any) => {
    if (!data) return [];
    if (typeof data === 'string') {
        try { return JSON.parse(data); } catch(e) { return []; }
    }
    return Array.isArray(data) ? data : [];
  };

  const membrosParaBuscaDaEdicao = membros.filter(m => {
    if (!congregacaoSelecionada || congregacaoSelecionada === "Todas as Congregações (Geral)" || congregacaoSelecionada === "") return true;
    
    const c1 = m.congregacao?.toLowerCase().trim() || "";
    const c2 = congregacaoSelecionada.toLowerCase().trim() || "";
    
    if (c2 === nomeSedeOficial.toLowerCase()) {
      return c1 === "" || c1 === "sede" || c1 === "matriz" || c1 === "geral" || c1 === c2;
    }
    
    return c1 === c2;
  });

  // 4. FUNÇÕES DE VISUALIZAÇÃO
  const abrirModalVer = (lanc: any) => {
    setLancamentoParaVer(lanc);
    setModalVerAberto(true);
  };

  const resolverNomeMembro = (membro_id: string, nome_avulso: string, is_avulso: boolean) => {
    if (is_avulso) return `${nome_avulso} (Visitante)`;
    const m = membros.find(x => String(x.id) === String(membro_id));
    return m ? m.nome : "Membro não encontrado";
  };

  // 5. FUNÇÕES DE EXCLUSÃO
  const executarExclusaoLogica = async () => {
    if (!justificativa.trim() || !lancamentoParaExcluir) return;
    setExcluindo(true);

    const { error } = await supabase.from("tesouraria_lancamentos").update({
      excluido: true,
      justificativa_exclusao: justificativa.trim()
    }).eq("id", lancamentoParaExcluir.id);

    if (error) {
      alert("Erro ao excluir lançamento: " + error.message);
    } else {
      setLancamentos(prev =>
        prev.map(l => l.id === lancamentoParaExcluir.id ? { ...l, excluido: true, justificativa_exclusao: justificativa.trim() } : l)
      );
      setModalExcluirAberto(false);
      setLancamentoParaExcluir(null);
      setJustificativa("");
    }
    setExcluindo(false);
  };

  // 6. FUNÇÕES DE EDIÇÃO COMPLEXA (Com Listas)
  const abrirModalEditar = (lanc: any) => {
    setLancamentoParaEditar(lanc);
    setEditData(lanc.data || "");
    if (lanc.tipo_trabalho && !opcoesTipos.includes(lanc.tipo_trabalho)) {
      setEditTipoTrabalho("Outros");
      setEditTipoTrabalhoPersonalizado(lanc.tipo_trabalho);
    } else {
      setEditTipoTrabalho(lanc.tipo_trabalho || "Culto");
      setEditTipoTrabalhoPersonalizado("");
    }
    setEditOfertas(lanc.ofertas || "");
    setEditJustificativa("");

    setListaDizimos(parseJSON(lanc.detalhes_dizimos));
    setListaOfertasEspeciais(parseJSON(lanc.detalhes_ofertas_especiais));
    setListaSaidas(parseJSON(lanc.detalhes_saidas));

    setModalEditarAberto(true);
  };

  const addDizimo = () => setListaDizimos([...listaDizimos, { id: Date.now().toString(), is_avulso: false, membro_id: "", nome_avulso: "", valor: "" }]);
  const removeDizimo = (id: string) => setListaDizimos(listaDizimos.filter(d => d.id !== id));
  const updateDizimo = (id: string, updates: Partial<DizimoItem>) => setListaDizimos(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));

  const addOfertaEspecial = () => setListaOfertasEspeciais([...listaOfertasEspeciais, { id: Date.now().toString(), descricao: "", valor: "" }]);
  const removeOfertaEspecial = (id: string) => setListaOfertasEspeciais(listaOfertasEspeciais.filter(o => o.id !== id));
  const updateOfertaEspecial = (id: string, updates: Partial<OfertaEspecialItem>) => setListaOfertasEspeciais(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));

  const addSaida = () => setListaSaidas([...listaSaidas, { id: Date.now().toString(), descricao: "", valor: "" }]);
  const removeSaida = (id: string) => setListaSaidas(listaSaidas.filter(s => s.id !== id));
  const updateSaida = (id: string, updates: Partial<SaidaItem>) => setListaSaidas(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));

  const editTotalOfertas = Number(editOfertas) || 0;
  const editTotalDizimos = listaDizimos.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  const editTotalOfertaEspecial = listaOfertasEspeciais.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  const editTotalSaidas = listaSaidas.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  const editTotalCalculado = editTotalOfertas + editTotalDizimos + editTotalOfertaEspecial - editTotalSaidas;

  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editJustificativa.trim()) { alert("A justificativa é obrigatória para auditar a edição."); return; }
    
    if (listaDizimos.some(d => (d.is_avulso && !d.nome_avulso) || (!d.is_avulso && !d.membro_id) || !d.valor)) {
      alert("Preencha corretamente todos os dízimos lançados."); return;
    }
    if (listaOfertasEspeciais.some(o => !o.descricao || !o.valor)) {
      alert("Preencha a descrição e o valor de todas as ofertas especiais."); return;
    }
    if (listaSaidas.some(s => !s.descricao || !s.valor)) {
      alert("Preencha a descrição e o valor de todas as saídas."); return;
    }

    setExcluindo(true);

    const payload = {
      data: editData,
      tipo_trabalho: editTipoTrabalho === "Outros" ? (editTipoTrabalhoPersonalizado || "Outros") : editTipoTrabalho,
      ofertas: editTotalOfertas,
      dizimos: editTotalDizimos,
      oferta_especial: editTotalOfertaEspecial,
      saidas: editTotalSaidas,
      total: editTotalCalculado,
      detalhes_dizimos: listaDizimos,
      detalhes_ofertas_especiais: listaOfertasEspeciais,
      detalhes_saidas: listaSaidas,
      justificativa_edicao: editJustificativa.trim()
    };

    try {
      const { error } = await supabase.from("tesouraria_lancamentos").update(payload).eq("id", lancamentoParaEditar.id);
      if (error) throw error;

      try {
        const dizimistasCadastrados = listaDizimos.filter(d => d.is_avulso === false && d.membro_id);
        if (dizimistasCadastrados.length > 0 && igrejaIdLogada) {
          const periodoStr = editData.substring(0, 7); 
          const { data: dizimistasBanco } = await supabase.from('tesouraria_dizimistas').select('membro_id, adicionado_em, removido_em').eq('igreja_id', igrejaIdLogada);
          const unicosParaInserir = Array.from(new Set(dizimistasCadastrados.map(d => String(d.membro_id))));
          const insercoesFinais: any[] = [];
          
          unicosParaInserir.forEach(membroIdStr => {
              const registros = dizimistasBanco?.filter(x => String(x.membro_id) === membroIdStr) || [];
              const curPeriod = parseInt(periodoStr.split('-')[0]) * 12 + parseInt(periodoStr.split('-')[1]);
              const isAtivo = registros.some(row => {
                  const addP = row.adicionado_em ? (parseInt(row.adicionado_em.split('-')[0]) * 12 + parseInt(row.adicionado_em.split('-')[1])) : 0;
                  const remP = row.removido_em ? (parseInt(row.removido_em.split('-')[0]) * 12 + parseInt(row.removido_em.split('-')[1])) : Infinity;
                  return curPeriod >= addP && curPeriod < remP;
              });
              if (!isAtivo) {
                  insercoesFinais.push({ igreja_id: igrejaIdLogada, membro_id: membroIdStr, adicionado_em: periodoStr });
              }
          });

          if (insercoesFinais.length > 0) {
            await supabase.from('tesouraria_dizimistas').insert(insercoesFinais);
          }
        }
      } catch (errAuto) { console.error("Erro no auto-cadastro:", errAuto); }

      setLancamentos(prev => prev.map(l => l.id === lancamentoParaEditar.id ? { ...l, ...payload } : l));
      setModalEditarAberto(false);
    } catch (err: any) {
      alert("Erro ao editar: " + err.message);
    } finally {
      setExcluindo(false);
    }
  };

  // 7. RENDERIZAÇÃO E MATEMÁTICA DA TABELA
  const lancamentosFiltrados = lancamentos.filter((lanc) => {
    if (!lanc.data) return false;
    const [ano, mes] = lanc.data.split("-");
    const matchCongregacao = congregacaoSelecionada === "" || normalizarSede(lanc.congregacao) === congregacaoSelecionada;
    const matchMes = mesesSelecionados.length === 0 || mesesSelecionados.includes(mes);
    const matchAno = anosSelecionados.length === 0 || anosSelecionados.includes(ano);
    const matchTipo = tiposSelecionados.length === 0 || tiposSelecionados.includes(lanc.tipo_trabalho);
    return matchCongregacao && matchMes && matchAno && matchTipo;
  });

  const lancamentosAtivos = lancamentosFiltrados.filter(l => !l.excluido);

  // Totais Brutos
  const totalOfertasGerais = lancamentosAtivos.reduce((acc, lanc) => acc + (Number(lanc.ofertas) || 0), 0);
  const totalDizimosGerais = lancamentosAtivos.reduce((acc, lanc) => acc + (Number(lanc.dizimos) || 0), 0);
  const totalEspecialGerais = lancamentosAtivos.reduce((acc, lanc) => acc + (Number(lanc.oferta_especial) || 0), 0);
  const totalSaidasGerais = lancamentosAtivos.reduce((acc, lanc) => acc + (Number(lanc.saidas) || 0), 0);
  const totalEntradasBrutas = totalOfertasGerais + totalDizimosGerais + totalEspecialGerais;

  // Matemática de Frequências Inteligentes
  const distinctCultos = lancamentosAtivos.length;
  const distinctMeses = new Set(lancamentosAtivos.map(l => l.data?.substring(0, 7))).size;
  const distinctAnos = new Set(lancamentosAtivos.map(l => l.data?.substring(0, 4))).size;
  const distinctSemanas = new Set(lancamentosAtivos.map(l => {
    if (!l.data) return "";
    const date = new Date(l.data + "T12:00:00Z"); 
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${weekNo}`;
  })).size;

  const calcularValorConfiguracao = (c: any) => {
    const isPercent = c.tipo_valor === "percentual" || c.percentual !== null;
    let vCalc = 0;
    if (isPercent) {
      vCalc = totalEntradasBrutas * ((c.percentual || 0) / 100);
    } else {
      const valorFixo = Number(c.valor_fixo) || 0;
      let multiplicador = 0;
      if (c.frequencia === "Semana") multiplicador = distinctSemanas;
      else if (c.frequencia === "Mês") multiplicador = distinctMeses;
      else if (c.frequencia === "Ano") multiplicador = distinctAnos;
      else multiplicador = distinctCultos; 
      
      vCalc = valorFixo * multiplicador;
    }
    return vCalc;
  };

  const saidasFixasCalculadas = configuracoesGlobais
    .filter(c => c.categoria === "Saída")
    .map(c => ({ ...c, valorCalculado: calcularValorConfiguracao(c) }));

  const entradasFixasCalculadas = configuracoesGlobais
    .filter(c => c.categoria === "Entrada")
    .map(c => ({ ...c, valorCalculado: calcularValorConfiguracao(c) }));

  const totalRepassesFixos = saidasFixasCalculadas.reduce((acc, s) => acc + s.valorCalculado, 0);
  const totalEntradasFixas = entradasFixasCalculadas.reduce((acc, e) => acc + e.valorCalculado, 0);
  
  const saldoLiquidoParcial = totalEntradasBrutas + totalEntradasFixas - totalSaidasGerais - totalRepassesFixos;

  const formatarMoeda = (valor: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
  const formatarMoedaExcel = (valor: number) => (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatarData = (dataSql: string) => {
    if (!dataSql) return "-";
    const [ano, mes, dia] = dataSql.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  const nomeIgrejaPrincipal = configIgreja?.nome_igreja || "Igreja Principal";
  const nomeCongregacao = congregacaoSelecionada || "Todas as Congregações (Geral)";

  const abrirModalParaPDF = () => {
    setAssinaturasSelecionadas([]); // Reseta as seleções pra começar limpo
    setModalAssinaturasAberto(true);
  };

  const confirmarEGerarPDF = () => {
    setModalAssinaturasAberto(false);
    setTimeout(() => {
      window.print();
    }, 150); // Timeout leve para dar tempo da animação do modal fechar e a página ir limpa pra impressão
  };

  const exportarExcel = () => {
    let csv = `Relatório Financeiro - ${nomeIgrejaPrincipal}\nCongregação: ${nomeCongregacao}\nData de Geração: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    csv += "Data;Congregação;Reunião;Ofertas;Dízimos;Oferta Especial;Saídas;Total\n";
    
    lancamentosAtivos.forEach((lanc) => {
      csv += `${formatarData(lanc.data)};${normalizarSede(lanc.congregacao)};${lanc.tipo_trabalho};${formatarMoedaExcel(lanc.ofertas)};${formatarMoedaExcel(lanc.dizimos)};${formatarMoedaExcel(lanc.oferta_especial)};${formatarMoedaExcel(lanc.saidas)};${formatarMoedaExcel(lanc.total)}\n`;
    });
    
    csv += `\nRESUMO FINANCEIRO\n`;
    csv += `Entradas Brutas (Lançamentos);;;;;;${formatarMoedaExcel(totalEntradasBrutas)}\n`;
    
    entradasFixasCalculadas.forEach(e => {
      const isPercent = e.tipo_valor === "percentual" || e.percentual !== null;
      const tag = isPercent ? `${e.percentual}%` : (e.frequencia || 'Culto');
      csv += `Entrada Fixa - ${e.tipo} (${tag});;;;;;${formatarMoedaExcel(e.valorCalculado)}\n`;
    });

    csv += `Saídas Lançamentos Manuais;;;;;;${formatarMoedaExcel(totalSaidasGerais)}\n`;
    
    saidasFixasCalculadas.forEach(s => {
      const isPercent = s.tipo_valor === "percentual" || s.percentual !== null;
      const tag = isPercent ? `${s.percentual}%` : (s.frequencia || 'Culto');
      csv += `Repasse/Saída Fixa - ${s.tipo} (${tag});;;;;;${formatarMoedaExcel(s.valorCalculado)}\n`;
    });
    csv += `SALDO LÍQUIDO PARCIAL;;;;;;${formatarMoedaExcel(saldoLiquidoParcial)}\n`;

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Tesouraria_${nomeCongregacao.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const ehEditor = podeEditar(perfisUsuario, 'tesouraria');

  if (carregando) return <div className="p-8 text-center text-gray-600">Carregando tesouraria...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 print:flex print:flex-col print:min-h-screen print:max-w-none print:m-0 print:p-0">
      <style dangerouslySetInnerHTML={{__html: `
        .cabecalho-impressao { display: none !important; }
        @media print {
          .print-oculto { display: none !important; }
          .cabecalho-impressao { display: block !important; visibility: visible !important; }
          body { background-color: white !important; color: black !important; }
          table { width: 100% !important; border-collapse: collapse !important; margin-bottom: 20px !important; }
          th, td { border: 1px solid #000 !important; padding: 6px !important; font-size: 11px !important; text-align: right !important; }
          th:nth-child(1), th:nth-child(2), th:nth-child(3), td:nth-child(1), td:nth-child(2), td:nth-child(3) { text-align: left !important; }
          .resumo-print { page-break-inside: avoid; border: 1px solid #000; padding: 15px; margin-top: 20px; }
          @page { margin: 10mm; }
        }
      `}} />

      <div className="cabecalho-impressao text-center mb-8 border-b-2 border-black pb-4">
        {configIgreja?.logo_url && <img src={configIgreja.logo_url} alt="Logo" className="h-20 mx-auto mb-3 object-contain" crossOrigin="anonymous" />}
        <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900">{nomeIgrejaPrincipal}</h1>
        <h2 className="text-md font-bold text-gray-700 mt-0.5">Relatório Financeiro da Congregação: {nomeCongregacao}</h2>
        <div className="flex justify-between items-center text-xs text-gray-500 mt-4 px-2">
          <span>Data de Emissão: {new Date().toLocaleDateString('pt-BR')}</span>
          <span>Total de Lançamentos: {lancamentosAtivos.length}</span>
        </div>
      </div>

      {dropdownAberto && <div className="fixed inset-0 z-10 print-oculto" onClick={() => setDropdownAberto(null)}></div>}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100 print-oculto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tesouraria</h1>
          <p className="text-sm text-gray-500 mt-1">Gestão de entradas, saídas e relatórios financeiros.</p>
        </div>
        
        {ehEditor && (
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Link href="/tesouraria/configuracoes" className="flex-1 md:flex-none px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition text-sm text-center">Configurações</Link>
            <Link href="/tesouraria/dizimistas" className="flex-1 md:flex-none px-4 py-2 bg-blue-50 text-blue-700 font-medium rounded-lg hover:bg-blue-100 transition text-sm text-center">Dizimistas</Link>
            <Link href="/tesouraria/novo" className="flex-1 md:flex-none px-4 py-2 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition shadow-sm text-sm text-center">+ Novo Lançamento</Link>
          </div>
        )}
      </div>

      <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col space-y-4 print-oculto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-gray-100 pb-4 gap-4">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Filtrar por Congregação</label>
            {ehSede ? (
              <select
                value={congregacaoSelecionada} onChange={(e) => setCongregacaoSelecionada(e.target.value)}
                className="w-full md:w-80 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 font-bold outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="">🌍 Todas as Congregações (Geral)</option>
                <option value={nomeSedeOficial}>🏢 {nomeSedeOficial}</option>
                {congregacoes.filter(c => c !== nomeSedeOficial).map((nomeCong) => <option key={nomeCong} value={nomeCong}>📍 {nomeCong}</option>)}
              </select>
            ) : (
              <div className="w-full md:w-80 px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500 font-bold cursor-not-allowed">
                📍 {congregacaoUsuario}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button onClick={exportarExcel} className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 font-bold text-sm rounded-lg hover:bg-green-100 transition shadow-sm border border-green-200">Excel</button>
            <button onClick={abrirModalParaPDF} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 font-bold text-sm rounded-lg hover:bg-red-100 transition shadow-sm border border-red-200">PDF</button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 w-full relative z-20 items-center justify-between">
          <div className="flex flex-wrap gap-4">
            <div className="relative">
              <button type="button" onClick={() => setDropdownAberto(dropdownAberto === 'meses' ? null : 'meses')} className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium w-full md:w-48 text-left flex justify-between items-center hover:bg-gray-100 transition">
                {mesesSelecionados.length === 0 ? "Selecionar Mês" : `Meses (${mesesSelecionados.length})`}
              </button>
              {dropdownAberto === 'meses' && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-30 max-h-64 overflow-y-auto">
                  {opcoesMeses.map((mes) => (
                    <label key={mes.valor} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={mesesSelecionados.includes(mes.valor)} onChange={() => toggleFiltro(mesesSelecionados, setMesesSelecionados, mes.valor)} className="w-4 h-4 text-teal-600 rounded border-gray-300" />
                      <span className="text-sm text-gray-700">{mes.rotulo}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button type="button" onClick={() => setDropdownAberto(dropdownAberto === 'anos' ? null : 'anos')} className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium w-full md:w-36 text-left flex justify-between items-center hover:bg-gray-100 transition">
                {anosSelecionados.length === 0 ? "Selecionar Ano" : `Anos (${anosSelecionados.length})`}
              </button>
              {dropdownAberto === 'anos' && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-30 max-h-64 overflow-y-auto">
                  {opcoesAnos.map((ano) => (
                    <label key={ano} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={anosSelecionados.includes(ano)} onChange={() => toggleFiltro(anosSelecionados, setAnosSelecionados, ano)} className="w-4 h-4 text-teal-600 rounded border-gray-300" />
                      <span className="text-sm text-gray-700">{ano}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button type="button" onClick={() => setDropdownAberto(dropdownAberto === 'tipos' ? null : 'tipos')} className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium w-full md:w-48 text-left flex justify-between items-center hover:bg-gray-100 transition">
                {tiposSelecionados.length === 0 ? "Reuniões" : `Reuniões (${tiposSelecionados.length})`}
              </button>
              {dropdownAberto === 'tipos' && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-30 max-h-64 overflow-y-auto">
                  {opcoesTipos.map((tipo) => (
                    <label key={tipo} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={tiposSelecionados.includes(tipo)} onChange={() => toggleFiltro(tiposSelecionados, setTiposSelecionados, tipo)} className="w-4 h-4 text-teal-600 rounded border-gray-300" />
                      <span className="text-sm text-gray-700">{tipo}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="text-sm font-bold text-gray-500 hidden md:block">{lancamentosFiltrados.length} encontrados</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Congregação</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reunião</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Ofertas</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Dízimos</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Especial</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Saídas</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-800 uppercase tracking-wider text-right bg-gray-100/50">Total</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center print-oculto">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lancamentosFiltrados.length > 0 ? (
                lancamentosFiltrados.map((lanc) => (
                  <tr key={lanc.id} className={`hover:bg-gray-50/50 transition ${lanc.excluido ? 'bg-red-50/30 text-gray-400 print:hidden' : ''}`}>
                    <td className={`px-6 py-4 text-sm font-medium whitespace-nowrap ${lanc.excluido ? 'line-through decoration-red-500 decoration-2 text-gray-400' : 'text-gray-700'}`}>{formatarData(lanc.data)}</td>
                    <td className={`px-6 py-4 text-sm font-bold ${lanc.excluido ? 'line-through decoration-red-500 decoration-2 text-gray-400' : 'text-gray-900'}`}>{normalizarSede(lanc.congregacao)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-600">
                      <span className={lanc.excluido ? 'line-through decoration-red-500 decoration-2 text-gray-400' : ''}>{lanc.tipo_trabalho}</span>
                      {lanc.excluido && lanc.justificativa_exclusao && (
                        <div className="text-xs text-red-600 font-bold mt-1 bg-red-100/60 px-2 py-1 rounded border border-red-200/50 block normal-case max-w-xs break-words">
                          Excluído: {lanc.justificativa_exclusao}
                        </div>
                      )}
                      {!lanc.excluido && lanc.justificativa_edicao && (
                        <div className="text-xs text-blue-600 font-bold mt-1 bg-blue-50 px-2 py-1 rounded border border-blue-100 block normal-case max-w-xs break-words">
                          Editado: {lanc.justificativa_edicao}
                        </div>
                      )}
                    </td>
                    <td className={`px-6 py-4 text-sm text-right ${lanc.excluido ? 'line-through decoration-red-500 text-gray-400' : 'text-gray-600'}`}>{formatarMoeda(lanc.ofertas)}</td>
                    <td className={`px-6 py-4 text-sm text-right ${lanc.excluido ? 'line-through decoration-red-500 text-gray-400' : 'text-gray-600'}`}>{formatarMoeda(lanc.dizimos)}</td>
                    <td className={`px-6 py-4 text-sm text-right ${lanc.excluido ? 'line-through decoration-red-500 text-gray-400' : 'text-gray-600'}`}>{formatarMoeda(lanc.oferta_especial)}</td>
                    <td className={`px-6 py-4 text-sm text-right font-medium ${lanc.excluido ? 'line-through decoration-red-500 text-gray-400' : 'text-red-600'}`}>{formatarMoeda(lanc.saidas)}</td>
                    <td className={`px-6 py-4 text-sm font-black text-right bg-gray-50/30 ${lanc.excluido ? 'line-through decoration-red-500 text-gray-400' : 'text-teal-800'}`}>{formatarMoeda(lanc.total)}</td>
                    <td className="px-6 py-4 text-sm text-center whitespace-nowrap print-oculto">
                      {ehEditor ? (
                        !lanc.excluido ? (
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => abrirModalVer(lanc)} className="px-2.5 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-xs font-bold transition border border-gray-200 shadow-sm">Ver</button>
                            <button onClick={() => abrirModalEditar(lanc)} className="px-2.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition border border-blue-100 shadow-sm">Editar</button>
                            <button onClick={() => { setLancamentoParaExcluir(lanc); setModalExcluirAberto(true); }} className="px-2.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold transition border border-red-100 shadow-sm">Excluir</button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-center items-center">
                            <button onClick={() => abrirModalVer(lanc)} className="px-2.5 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-xs font-bold transition border border-gray-200 shadow-sm">Ver</button>
                            <span className="text-xs text-red-500 font-bold uppercase tracking-wider bg-red-50 px-2 py-1 rounded border border-red-100/50 inline-block">Excluído</span>
                          </div>
                        )
                      ) : (
                        <button onClick={() => abrirModalVer(lanc)} className="px-2.5 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-xs font-bold transition border border-gray-200 shadow-sm">Ver</button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500 text-sm">Nenhum lançamento encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {lancamentosAtivos.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden resumo-print">
          <div className="p-4 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">Resumo Financeiro e Repasses</h3>
              <p className="text-xs text-gray-400">Cálculos baseados nos lançamentos exibidos acima.</p>
            </div>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4 border-b md:border-b-0 md:border-r border-gray-100 pb-6 md:pb-0 md:pr-8">
              <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Totais Brutos</h4>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Total de Entradas Brutas</span>
                <span className="text-base font-bold text-teal-700">{formatarMoeda(totalEntradasBrutas)}</span>
              </div>
              
              {entradasFixasCalculadas.length > 0 && (
                <div className="pt-3 mt-3 border-t border-gray-100 space-y-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">Entradas Fixas</span>
                  {entradasFixasCalculadas.map((entrada) => {
                    const isPercent = entrada.tipo_valor === "percentual" || entrada.percentual !== null;
                    return (
                      <div key={entrada.id} className="flex justify-between items-center text-blue-600">
                        <span className="text-sm font-medium">
                          (+) {entrada.tipo} 
                          <span className="text-xs ml-1 font-normal">
                            {isPercent ? `(${entrada.percentual}%)` : `(${entrada.frequencia || 'Culto'})`}
                          </span>
                        </span>
                        <span className="text-sm font-bold">{formatarMoeda(entrada.valorCalculado)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-between items-center text-red-600 pt-3 mt-3 border-t border-gray-100">
                <span className="text-sm font-medium">(-) Saídas Lançamentos Manuais</span>
                <span className="text-base font-bold">{formatarMoeda(totalSaidasGerais)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Repasses e Saídas Fixas</h4>
              {saidasFixasCalculadas.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nenhuma saída fixa configurada.</p>
              ) : (
                saidasFixasCalculadas.map((saida) => {
                  const isPercent = saida.tipo_valor === "percentual" || saida.percentual !== null;
                  return (
                    <div key={saida.id} className="flex justify-between items-center text-orange-600">
                      <span className="text-sm font-medium">
                        (-) {saida.tipo} 
                        <span className="text-xs ml-1 font-normal">
                          {isPercent ? `(${saida.percentual}%)` : `(${saida.frequencia || 'Culto'})`}
                        </span>
                      </span>
                      <span className="text-sm font-bold">{formatarMoeda(saida.valorCalculado)}</span>
                    </div>
                  );
                })
              )}
              {totalRepassesFixos > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">Total de Repasses</span>
                  <span className="text-sm font-bold text-orange-700">{formatarMoeda(totalRepassesFixos)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 p-6 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Saldo Líquido Parcial</h3>
              <p className="text-xs text-gray-400 mt-1">Disponível em caixa após todas as deduções e entradas fixas.</p>
            </div>
            <div className={`text-3xl font-black tracking-tight ${saldoLiquidoParcial >= 0 ? 'text-teal-700' : 'text-red-600'}`}>
              {formatarMoeda(saldoLiquidoParcial)}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BLOCO DE ASSINATURAS (SÓ APARECE NA HORA DA IMPRESSÃO E VAI PRO FINAL DA PÁG) */}
      {/* ========================================================================= */}
      {assinaturasSelecionadas.length > 0 && (
        <div className="hidden print:flex mt-auto pt-16 pb-8 flex-wrap justify-center gap-12 md:gap-24 break-inside-avoid w-full">
          {configIgreja?.assinaturas
            ?.filter((a: any) => assinaturasSelecionadas.includes(a.id))
            .map((ass: any) => (
              <div key={ass.id} className="flex flex-col items-center justify-end w-48 text-center">
                {ass.url ? (
                  <img src={ass.url} alt="Assinatura" className="h-16 object-contain mb-1" crossOrigin="anonymous" />
                ) : (
                  <div className="h-16 w-full mb-1"></div> 
                )}
                <div className="w-full border-t border-black mb-1"></div>
                <p className="text-[10px] font-bold uppercase text-black">{ass.titulo}</p>
              </div>
          ))}
        </div>
      )}


      {/* ========================================== */}
      {/* MODAL 1: VISUALIZAR DETALHES (Somente Leitura) */}
      {/* ========================================== */}
      {modalVerAberto && lancamentoParaVer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity animate-fadeIn print-oculto">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
              <div>
                <h3 className="text-lg font-black text-gray-900">Extrato do Lançamento</h3>
                <p className="text-xs font-medium text-gray-500 mt-1">{formatarData(lancamentoParaVer.data)} • {lancamentoParaVer.tipo_trabalho} • {normalizarSede(lancamentoParaVer.congregacao)}</p>
              </div>
              <button onClick={() => setModalVerAberto(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-red-100 hover:text-red-600 transition-colors font-bold">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 bg-white">
              
              {lancamentoParaVer.excluido && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <h4 className="text-sm font-bold text-red-800 uppercase">🚫 Lançamento Excluído</h4>
                  <p className="text-sm text-red-700 mt-1">{lancamentoParaVer.justificativa_exclusao}</p>
                </div>
              )}
              {!lancamentoParaVer.excluido && lancamentoParaVer.justificativa_edicao && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <h4 className="text-sm font-bold text-blue-800 uppercase">✏️ Lançamento Editado</h4>
                  <p className="text-sm text-blue-700 mt-1">{lancamentoParaVer.justificativa_edicao}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-bold text-gray-800 uppercase border-b border-gray-100 pb-2 mb-3">Dízimos Recebidos ({formatarMoeda(lancamentoParaVer.dizimos)})</h4>
                {parseJSON(lancamentoParaVer.detalhes_dizimos).length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Nenhum dízimo registrado.</p>
                ) : (
                  <ul className="space-y-2">
                    {parseJSON(lancamentoParaVer.detalhes_dizimos).map((d: any, idx: number) => (
                      <li key={idx} className="flex justify-between items-center bg-green-50/50 p-2.5 rounded-lg border border-green-100/50">
                        <span className="text-sm font-medium text-gray-800">{resolverNomeMembro(d.membro_id, d.nome_avulso, d.is_avulso)}</span>
                        <span className="text-sm font-bold text-green-700">{formatarMoeda(Number(d.valor))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-gray-800 uppercase border-b border-gray-100 pb-2 mb-3">Ofertas Especiais ({formatarMoeda(lancamentoParaVer.oferta_especial)})</h4>
                {parseJSON(lancamentoParaVer.detalhes_ofertas_especiais).length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Nenhuma oferta especial registrada.</p>
                ) : (
                  <ul className="space-y-2">
                    {parseJSON(lancamentoParaVer.detalhes_ofertas_especiais).map((o: any, idx: number) => (
                      <li key={idx} className="flex justify-between items-center bg-yellow-50/50 p-2.5 rounded-lg border border-yellow-100/50">
                        <span className="text-sm font-medium text-gray-800">{o.descricao}</span>
                        <span className="text-sm font-bold text-yellow-700">{formatarMoeda(Number(o.valor))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-gray-800 uppercase border-b border-gray-100 pb-2 mb-3">Despesas e Saídas ({formatarMoeda(lancamentoParaVer.saidas)})</h4>
                {parseJSON(lancamentoParaVer.detalhes_saidas).length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Nenhuma saída registrada.</p>
                ) : (
                  <ul className="space-y-2">
                    {parseJSON(lancamentoParaVer.detalhes_saidas).map((s: any, idx: number) => (
                      <li key={idx} className="flex justify-between items-center bg-red-50/50 p-2.5 rounded-lg border border-red-100/50">
                        <span className="text-sm font-medium text-gray-800">{s.descricao}</span>
                        <span className="text-sm font-bold text-red-600">- {formatarMoeda(Number(s.valor))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-xl flex justify-between items-center border border-gray-200">
                <span className="text-sm font-bold text-gray-600 uppercase">Ofertas Gerais:</span>
                <span className="text-lg font-black text-blue-700">{formatarMoeda(lancamentoParaVer.ofertas)}</span>
              </div>
            </div>
            
            <div className="p-4 bg-gray-900 flex justify-between items-center sticky bottom-0">
              <span className="text-sm font-bold text-white uppercase tracking-wider">Saldo Líquido</span>
              <span className="text-2xl font-black text-teal-400">{formatarMoeda(lancamentoParaVer.total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 2: EDITAR LANÇAMENTO (Poder Total)   */}
      {/* ========================================== */}
      {modalEditarAberto && lancamentoParaEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity animate-fadeIn print-oculto">
          <div className="bg-gray-50 rounded-2xl shadow-2xl border border-gray-200 max-w-4xl w-full overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-5 border-b border-gray-200 bg-white flex justify-between items-center sticky top-0 z-20 shadow-sm">
              <div>
                <h3 className="text-lg font-black text-gray-900">Editar Lançamento Completo</h3>
                <p className="text-xs text-gray-500 mt-1">Altere qualquer informação ou lista deste culto.</p>
              </div>
              <button onClick={() => setModalEditarAberto(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-red-100 hover:text-red-600 transition-colors font-bold">✕</button>
            </div>
            
            <div className="overflow-y-auto p-4 md:p-6 space-y-8 flex-1">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label>
                  <input type="date" value={editData} onChange={e => setEditData(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reunião</label>
                  <select value={editTipoTrabalho} onChange={e => setEditTipoTrabalho(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer" required>
                    {opcoesTipos.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {editTipoTrabalho === "Outros" && (
                    <input
                      type="text"
                      required
                      placeholder="Especifique o tipo..."
                      value={editTipoTrabalhoPersonalizado}
                      onChange={(e) => setEditTipoTrabalhoPersonalizado(e.target.value)}
                      className="w-full mt-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ofertas Gerais Culto</label>
                  <input type="number" step="0.01" value={editOfertas} onChange={e => setEditOfertas(e.target.value ? parseFloat(e.target.value) : "")} className="w-full px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                  <h3 className="text-sm font-black text-gray-800 uppercase">Dízimos</h3>
                  <button type="button" onClick={addDizimo} className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 text-xs font-bold rounded-lg transition-colors">+ Dízimo</button>
                </div>
                <div className="space-y-3">
                  {listaDizimos.map((item) => (
                    <div key={item.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                      <select value={item.is_avulso ? "sim" : "nao"} onChange={(e) => updateDizimo(item.id, { is_avulso: e.target.value === "sim", membro_id: "", nome_avulso: "" })} className="w-full sm:w-auto px-2 py-2 bg-white border border-gray-200 rounded text-xs outline-none">
                        <option value="nao">Cadastrado</option>
                        <option value="sim">Visitante</option>
                      </select>
                      <div className="flex-1 w-full min-w-[150px]">
                        {item.is_avulso ? (
                          <input type="text" placeholder="Nome..." value={item.nome_avulso} onChange={(e) => updateDizimo(item.id, { nome_avulso: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-xs outline-none" />
                        ) : (
                          <MembroSearchSelect membros={membrosParaBuscaDaEdicao} valor={item.membro_id} onChange={(val) => updateDizimo(item.id, { membro_id: val })} />
                        )}
                      </div>
                      <input type="number" step="0.01" placeholder="Valor" value={item.valor} onChange={(e) => updateDizimo(item.id, { valor: e.target.value ? parseFloat(e.target.value) : "" })} className="w-full sm:w-28 px-3 py-2 bg-green-50 border border-green-200 text-green-900 rounded text-sm font-bold outline-none" />
                      <button type="button" onClick={() => removeDizimo(item.id)} className="w-full sm:w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 hover:bg-red-500 hover:text-white rounded transition-colors text-xs font-bold">X</button>
                    </div>
                  ))}
                  <div className="text-right text-xs font-bold text-gray-500 pt-1">Subtotal Dízimos: <span className="text-green-600 text-sm">{formatarMoeda(editTotalDizimos)}</span></div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                  <h3 className="text-sm font-black text-gray-800 uppercase">Ofertas Especiais</h3>
                  <button type="button" onClick={addOfertaEspecial} className="px-3 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-xs font-bold rounded-lg transition-colors">+ Oferta</button>
                </div>
                <div className="space-y-3">
                  {listaOfertasEspeciais.map((item) => (
                    <div key={item.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                      <input type="text" placeholder="Propósito..." value={item.descricao} onChange={(e) => updateOfertaEspecial(item.id, { descricao: e.target.value })} className="flex-1 w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm outline-none" />
                      <input type="number" step="0.01" placeholder="Valor" value={item.valor} onChange={(e) => updateOfertaEspecial(item.id, { valor: e.target.value ? parseFloat(e.target.value) : "" })} className="w-full sm:w-28 px-3 py-2 bg-yellow-50 border border-yellow-200 text-yellow-900 rounded text-sm font-bold outline-none" />
                      <button type="button" onClick={() => removeOfertaEspecial(item.id)} className="w-full sm:w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 hover:bg-red-500 hover:text-white rounded transition-colors text-xs font-bold">X</button>
                    </div>
                  ))}
                  <div className="text-right text-xs font-bold text-gray-500 pt-1">Subtotal Especiais: <span className="text-yellow-600 text-sm">{formatarMoeda(editTotalOfertaEspecial)}</span></div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                  <h3 className="text-sm font-black text-gray-800 uppercase">Saídas e Despesas</h3>
                  <button type="button" onClick={addSaida} className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold rounded-lg transition-colors">+ Saída</button>
                </div>
                <div className="space-y-3">
                  {listaSaidas.map((item) => (
                    <div key={item.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                      <input type="text" placeholder="Descrição da saída..." value={item.descricao} onChange={(e) => updateSaida(item.id, { descricao: e.target.value })} className="flex-1 w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm outline-none" />
                      <input type="number" step="0.01" placeholder="Valor" value={item.valor} onChange={(e) => updateSaida(item.id, { valor: e.target.value ? parseFloat(e.target.value) : "" })} className="w-full sm:w-28 px-3 py-2 bg-red-50 border border-red-200 text-red-900 rounded text-sm font-bold outline-none" />
                      <button type="button" onClick={() => removeSaida(item.id)} className="w-full sm:w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 hover:bg-red-500 hover:text-white rounded transition-colors text-xs font-bold">X</button>
                    </div>
                  ))}
                  <div className="text-right text-xs font-bold text-gray-500 pt-1">Subtotal Saídas: <span className="text-red-600 text-sm">- {formatarMoeda(editTotalSaidas)}</span></div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <label className="block text-xs font-black text-blue-800 uppercase mb-2">Justificativa da Edição *</label>
                <textarea 
                  value={editJustificativa} 
                  onChange={e => setEditJustificativa(e.target.value)} 
                  placeholder="Por que você está alterando os valores ou itens deste culto? Essa justificativa ficará salva no histórico para auditoria..." 
                  className="w-full px-4 py-3 bg-white border border-blue-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm resize-none outline-none font-medium text-gray-800" 
                  rows={3} 
                  required 
                />
              </div>

            </div>

            <div className="p-5 bg-white border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 sticky bottom-0 z-20">
              <div className="bg-gray-100 px-4 py-2 rounded-lg border border-gray-200 w-full sm:w-auto text-center sm:text-left">
                <span className="text-xs font-bold text-gray-500 uppercase block">Saldo Total Ajustado</span>
                <span className={`text-xl font-black ${editTotalCalculado >= 0 ? 'text-teal-700' : 'text-red-600'}`}>{formatarMoeda(editTotalCalculado)}</span>
              </div>
              <div className="flex w-full sm:w-auto gap-3">
                <button type="button" onClick={() => setModalEditarAberto(false)} className="flex-1 sm:flex-none px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition">Cancelar</button>
                <button type="submit" disabled={excluindo || !editJustificativa.trim()} onClick={salvarEdicao} className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-black transition disabled:opacity-50 shadow-md">Gravar Correção</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: JUSTIFICATIVA DE EXCLUSÃO */}
      {modalExcluirAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity animate-fadeIn print-oculto">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 max-w-md w-full overflow-hidden transform transition-all scale-100">
            <div className="p-5 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Justificativa de Exclusão</h3>
              <p className="text-xs text-gray-500 mt-1">Informe o motivo da exclusão deste lançamento.</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-red-500 uppercase tracking-wider mb-2">Motivo *</label>
                <textarea
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder="Ex: Lançamento duplicado..."
                  className="w-full px-4 py-3 border border-red-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-sm min-h-[110px] resize-none transition"
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button type="button" disabled={excluindo} onClick={() => { setModalExcluirAberto(false); setLancamentoParaExcluir(null); setJustificativa(""); }} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium text-sm rounded-lg transition">Cancelar</button>
              <button type="button" disabled={excluindo || !justificativa.trim()} onClick={executarExclusaoLogica} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium text-sm rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm font-bold">
                {excluindo ? "Excluindo..." : "Confirmar Exclusão"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 4: ESCOLHA DE ASSINATURAS PARA O PDF */}
      {/* ========================================== */}
      {modalAssinaturasAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity animate-fadeIn print-oculto">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-100 max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Gerar PDF do Relatório</h3>
                <p className="text-xs text-gray-500 mt-1">Selecione as assinaturas que aparecerão no final do documento.</p>
              </div>
              <button onClick={() => setModalAssinaturasAberto(false)} className="text-gray-400 hover:text-red-600 font-bold text-xl">&times;</button>
            </div>
            
            <div className="p-5">
              {configIgreja?.assinaturas && configIgreja.assinaturas.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {configIgreja.assinaturas.map((ass: any) => (
                    <label key={ass.id} className={`flex items-center gap-2 cursor-pointer px-4 py-2 border rounded-lg shadow-sm transition-all ${assinaturasSelecionadas.includes(ass.id) ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-300 hover:border-gray-400'}`}>
                      <input
                        type="checkbox"
                        checked={assinaturasSelecionadas.includes(ass.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssinaturasSelecionadas(prev => [...prev, ass.id]);
                          } else {
                            setAssinaturasSelecionadas(prev => prev.filter(id => id !== ass.id));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-sm font-semibold text-gray-700">{ass.titulo}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">Nenhuma assinatura configurada. Vá em Configurações Globais para cadastrar.</p>
              )}
            </div>
            
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button type="button" onClick={() => setModalAssinaturasAberto(false)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium text-sm rounded-lg transition">Cancelar</button>
              <button 
                type="button" 
                onClick={confirmarEGerarPDF} 
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-medium text-sm rounded-lg transition shadow-sm font-bold flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Confirmar e Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}