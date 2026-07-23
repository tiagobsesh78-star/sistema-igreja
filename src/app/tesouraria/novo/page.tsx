"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { podeEditar, formatarPerfis } from "../../../lib/permissoes";

// ==========================================
// INTERFACES DOS NOVOS CAMPOS DINÂMICOS
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
// COMPONENTE: SELECT DE MEMBROS COM LUPA
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

export default function NovoLancamento() {
  const router = useRouter();
  
  const [dataLancamento, setDataLancamento] = useState("");
  const [tipoTrabalho, setTipoTrabalho] = useState("Culto");
  const [tipoTrabalhoPersonalizado, setTipoTrabalhoPersonalizado] = useState("");
  const [congregacao, setCongregacao] = useState("");
  
  const [ofertas, setOfertas] = useState<number | "">("");
  
  const [listaDizimos, setListaDizimos] = useState<DizimoItem[]>([]);
  const [listaOfertasEspeciais, setListaOfertasEspeciais] = useState<OfertaEspecialItem[]>([]);
  const [listaSaidas, setListaSaidas] = useState<SaidaItem[]>([]);
  
  const [listaCongregacoes, setListaCongregacoes] = useState<string[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  
  const [salvando, setSalvando] = useState(false);
  const [mostrarModalSucesso, setMostrarModalSucesso] = useState(false);
  const [igrejaIdLogada, setIgrejaIdLogada] = useState<string | null>(null);

  const [ehSede, setEhSede] = useState(false);
  const [nomeSedeOficial, setNomeSedeOficial] = useState("Sede");
  const [congregacaoUsuario, setCongregacaoUsuario] = useState("");

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

    if (!podeEditar(perfisLogado, 'tesouraria')) {
      router.push("/");
      return; 
    }

    const igrejaId = usuario.igreja_id || usuario.id_igreja || usuario.idIgreja;
    setIgrejaIdLogada(igrejaId);

    async function inicializarDados(idIgreja: string) {
      try {
        const { data: config } = await supabase
          .from("configuracao_igreja")
          .select("nome_igreja")
          .eq("igreja_id", idIgreja)
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
            .eq("igreja_id", idIgreja)
            .order("nome", { ascending: true });

          const nomesFilhas = filhas ? filhas.map(f => f.nome) : [];
          setListaCongregacoes([nomeSede, ...nomesFilhas]);
          
          const congInicial = congUser || nomeSede;
          setCongregacao(congInicial.toLowerCase() === "sede" ? nomeSede : congInicial);
        } else {
          setListaCongregacoes([congUser]);
          setCongregacao(congUser);
        }

        const { data: membrosData, error: erroMembros } = await supabase
          .from("membros") 
          .select("id, nome_completo, congregacao")
          .eq("igreja_id", idIgreja)
          .order("nome_completo", { ascending: true });
          
        if (erroMembros) {
          console.error("Erro ao buscar pessoas:", erroMembros);
        } else if (membrosData) {
          setMembros(membrosData.map(m => ({ 
            id: m.id, 
            nome: m.nome_completo,
            congregacao: m.congregacao
          })));
        }

      } catch (error) {
        console.error("Erro ao inicializar:", error);
      } finally {
        setCarregandoDados(false);
      }
    }

    if (igrejaId) {
      inicializarDados(igrejaId);
    }
  }, [router]);

  const membrosParaBusca = membros.filter(m => {
    if (!congregacao || congregacao === "Todas as Congregações") return true;
    
    const c1 = m.congregacao?.toLowerCase().trim() || "";
    const c2 = congregacao.toLowerCase().trim() || "";
    
    if (c2 === nomeSedeOficial.toLowerCase()) {
      return c1 === "" || c1 === "sede" || c1 === "matriz" || c1 === "geral" || c1 === c2;
    }
    
    return c1 === c2;
  });

  const addDizimo = () => {
    setListaDizimos([...listaDizimos, { id: Date.now().toString(), is_avulso: false, membro_id: "", nome_avulso: "", valor: "" }]);
  };
  const removeDizimo = (id: string) => {
    setListaDizimos(listaDizimos.filter(d => d.id !== id));
  };
  const updateDizimo = (id: string, updates: Partial<DizimoItem>) => {
    setListaDizimos(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  };

  const addOfertaEspecial = () => {
    setListaOfertasEspeciais([...listaOfertasEspeciais, { id: Date.now().toString(), descricao: "", valor: "" }]);
  };
  const removeOfertaEspecial = (id: string) => {
    setListaOfertasEspeciais(listaOfertasEspeciais.filter(o => o.id !== id));
  };
  const updateOfertaEspecial = (id: string, updates: Partial<OfertaEspecialItem>) => {
    setListaOfertasEspeciais(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const addSaida = () => {
    setListaSaidas([...listaSaidas, { id: Date.now().toString(), descricao: "", valor: "" }]);
  };
  const removeSaida = (id: string) => {
    setListaSaidas(listaSaidas.filter(s => s.id !== id));
  };
  const updateSaida = (id: string, updates: Partial<SaidaItem>) => {
    setListaSaidas(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const valorOfertas = Number(ofertas) || 0;
  const totalDizimos = listaDizimos.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  const totalOfertaEspecial = listaOfertasEspeciais.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  const totalSaidas = listaSaidas.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  const totalCalculado = valorOfertas + totalDizimos + totalOfertaEspecial - totalSaidas;

  const salvarLancamento = async (e: React.FormEvent) => {
    e.preventDefault();

    const congregacaoFinal = ehSede ? congregacao : congregacaoUsuario;

    if (!congregacaoFinal) {
      alert("Por favor, selecione a congregação desta reunião.");
      setSalvando(false);
      return;
    }
    if (!igrejaIdLogada) {
      alert("Erro de autenticação da igreja. Faça login novamente.");
      return;
    }
    
    if (listaDizimos.some(d => (d.is_avulso && !d.nome_avulso) || (!d.is_avulso && !d.membro_id) || !d.valor)) {
      alert("Preencha corretamente os nomes e valores de todos os dízimos lançados.");
      return;
    }
    if (listaOfertasEspeciais.some(o => !o.descricao || !o.valor)) {
      alert("Preencha a descrição e o valor de todas as ofertas especiais.");
      return;
    }
    if (listaSaidas.some(s => !s.descricao || !s.valor)) {
      alert("Preencha a descrição e o valor de todas as saídas/despesas.");
      return;
    }
    
    setSalvando(true);

    const dadosLancamento = {
      igreja_id: igrejaIdLogada,
      data: dataLancamento,
      tipo_trabalho: tipoTrabalho === "Outros" ? (tipoTrabalhoPersonalizado || "Outros") : tipoTrabalho,
      congregacao: congregacaoFinal,
      ofertas: valorOfertas,
      dizimos: totalDizimos,
      oferta_especial: totalOfertaEspecial,
      saidas: totalSaidas,
      total: totalCalculado,
      detalhes_dizimos: listaDizimos,
      detalhes_ofertas_especiais: listaOfertasEspeciais,
      detalhes_saidas: listaSaidas
    };

    try {
      const { error } = await supabase.from("tesouraria_lancamentos").insert([dadosLancamento]);
      if (error) throw error;

      try {
        const dizimistasCadastrados = listaDizimos.filter(d => d.is_avulso === false && d.membro_id);
        
        if (dizimistasCadastrados.length > 0) {
          const periodoStr = dataLancamento.substring(0, 7);
          
          const { data: dizimistasBanco } = await supabase
            .from('tesouraria_dizimistas')
            .select('membro_id, adicionado_em, removido_em')
            .eq('igreja_id', igrejaIdLogada);
          
          const unicosParaInserir = Array.from(new Set(dizimistasCadastrados.map(d => String(d.membro_id))));
          
          const insercoesFinais: any[] = [];
          
          unicosParaInserir.forEach(membroIdStr => {
              const registrosDoMembro = dizimistasBanco?.filter(x => String(x.membro_id) === membroIdStr) || [];
              const curPeriod = parseInt(periodoStr.split('-')[0]) * 12 + parseInt(periodoStr.split('-')[1]);
              
              const isAtivo = registrosDoMembro.some(row => {
                  const addP = row.adicionado_em ? (parseInt(row.adicionado_em.split('-')[0]) * 12 + parseInt(row.adicionado_em.split('-')[1])) : 0;
                  const remP = row.removido_em ? (parseInt(row.removido_em.split('-')[0]) * 12 + parseInt(row.removido_em.split('-')[1])) : Infinity;
                  return curPeriod >= addP && curPeriod < remP;
              });

              if (!isAtivo) {
                  insercoesFinais.push({
                      igreja_id: igrejaIdLogada,
                      membro_id: membroIdStr,
                      adicionado_em: periodoStr
                  });
              }
          });

          if (insercoesFinais.length > 0) {
            const { error: errInsertDiz } = await supabase.from('tesouraria_dizimistas').insert(insercoesFinais);
            if (errInsertDiz) console.error("Falha ao auto-inserir dizimistas:", errInsertDiz);
          }
        }
      } catch (errAuto) {
        console.error("Erro interno ao auto-cadastrar dizimista na lista ativa:", errAuto);
      }

      setMostrarModalSucesso(true);
    } catch (error: any) {
      alert("Erro ao salvar lançamento: " + error.message);
    } finally {
      setSalvando(false);
    }
  };

  const fecharModalELimpar = () => {
    setMostrarModalSucesso(false);
    setOfertas("");
    setListaDizimos([]);
    setListaOfertasEspeciais([]);
    setListaSaidas([]);
  };

  const formatarMoedaVisual = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Novo Lançamento</h2>
          <p className="text-sm text-gray-500 mt-1">Registre as entradas e saídas da reunião realizada.</p>
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
        <form onSubmit={salvarLancamento} className="p-6 md:p-8 space-y-10">
          
          <div className="mb-10">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">Informações da Reunião</h3>
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

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Congregação Responsável *</label>
                {ehSede ? (
                  <select 
                    required
                    value={congregacao}
                    onChange={(e) => setCongregacao(e.target.value)}
                    disabled={carregandoDados}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 font-bold cursor-pointer disabled:opacity-60"
                  >
                    {carregandoDados ? (
                      <option value="">Buscando congregações...</option>
                    ) : (
                      <>
                        <option value="" disabled>Selecione a Congregação</option>
                        <option value="Todas as Congregações">🌍 Todas as Congregações</option>
                        {listaCongregacoes.map((c) => (
                          <option key={c} value={c}>{c === nomeSedeOficial ? `🏢 ${c} (Sede)` : `📍 ${c}`}</option>
                        ))}
                      </>
                    )}
                  </select>
                ) : (
                  <select disabled className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg outline-none text-sm text-gray-500 font-bold cursor-not-allowed">
                    <option value={congregacaoUsuario}>📍 {congregacaoUsuario}</option>
                  </select>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo de Reunião</label>
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
                
                {tipoTrabalho === "Outros" && (
                  <input
                    type="text"
                    required
                    placeholder="Especifique o tipo..."
                    value={tipoTrabalhoPersonalizado}
                    onChange={(e) => setTipoTrabalhoPersonalizado(e.target.value)}
                    className="w-full mt-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-700 shadow-inner"
                  />
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">Ofertas Avulsas (R$)</h3>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Ofertas Gerais da Reunião</label>
              <input 
                type="number" step="0.01" min="0" placeholder="0,00"
                value={ofertas}
                onChange={(e) => setOfertas(e.target.value ? parseFloat(e.target.value) : "")}
                className="w-full md:w-1/3 px-4 py-2.5 bg-blue-50/50 border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 font-medium placeholder-gray-400"
              />
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Registro de Dízimos</h3>
                <p className="text-xs text-gray-500">Vincule os dízimos aos membros cadastrados.</p>
              </div>
              <button 
                type="button" 
                onClick={addDizimo}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
              >
                <span>+</span> Adicionar Dízimo
              </button>
            </div>

            <div className="space-y-3">
              {listaDizimos.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm font-medium">
                  Nenhum dízimo lançado nesta reunião.
                </div>
              )}
              
              {listaDizimos.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm animate-fade-in">
                  
                  <div className="w-full sm:w-auto flex-shrink-0">
                    <select 
                      value={item.is_avulso ? "sim" : "nao"}
                      onChange={(e) => {
                        updateDizimo(item.id, { 
                          is_avulso: e.target.value === "sim",
                          membro_id: "",
                          nome_avulso: ""
                        });
                      }}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm text-gray-700 font-semibold cursor-pointer"
                    >
                      <option value="nao">Membro Cadastrado</option>
                      <option value="sim">Não Cadastrado (Visitante)</option>
                    </select>
                  </div>

                  <div className="flex-1 w-full min-w-[200px]">
                    {item.is_avulso ? (
                      <input 
                        type="text" 
                        placeholder="Nome da pessoa..."
                        value={item.nome_avulso}
                        onChange={(e) => updateDizimo(item.id, { nome_avulso: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900"
                      />
                    ) : (
                      <MembroSearchSelect 
                        membros={membrosParaBusca} 
                        valor={item.membro_id} 
                        onChange={(val) => updateDizimo(item.id, { membro_id: val })}
                      />
                    )}
                  </div>

                  <div className="w-full sm:w-32 flex-shrink-0 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">R$</span>
                    <input 
                      type="number" step="0.01" min="0" placeholder="0,00"
                      value={item.valor}
                      onChange={(e) => updateDizimo(item.id, { valor: e.target.value ? parseFloat(e.target.value) : "" })}
                      className="w-full pl-9 pr-3 py-2.5 bg-green-50 border border-green-100 text-green-900 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm font-bold"
                    />
                  </div>

                  <button 
                    type="button" 
                    onClick={() => removeDizimo(item.id)}
                    className="w-full sm:w-10 h-10 flex items-center justify-center bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
              
              {listaDizimos.length > 0 && (
                <div className="text-right pr-2 pt-2 text-sm font-bold text-gray-600">
                  Subtotal Dízimos: <span className="text-green-700">{formatarMoedaVisual(totalDizimos)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-yellow-50/50 border border-yellow-100 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Ofertas Especiais</h3>
                <p className="text-xs text-gray-500">Descreva o destino (Ex: Missões, Construção, etc).</p>
              </div>
              <button 
                type="button" 
                onClick={addOfertaEspecial}
                className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
              >
                <span>+</span> Adicionar Oferta
              </button>
            </div>

            <div className="space-y-3">
              {listaOfertasEspeciais.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed border-yellow-200 rounded-xl text-yellow-600/50 text-sm font-medium">
                  Nenhuma oferta especial registrada.
                </div>
              )}
              
              {listaOfertasEspeciais.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white p-3 rounded-xl border border-yellow-200 shadow-sm animate-fade-in">
                  
                  <div className="flex-1 w-full">
                    <input 
                      type="text" 
                      placeholder="Propósito da oferta (Ex: Campanha Templo, Missões...)"
                      value={item.descricao}
                      onChange={(e) => updateOfertaEspecial(item.id, { descricao: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none text-sm text-gray-900 font-medium"
                    />
                  </div>

                  <div className="w-full sm:w-32 flex-shrink-0 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">R$</span>
                    <input 
                      type="number" step="0.01" min="0" placeholder="0,00"
                      value={item.valor}
                      onChange={(e) => updateOfertaEspecial(item.id, { valor: e.target.value ? parseFloat(e.target.value) : "" })}
                      className="w-full pl-9 pr-3 py-2.5 bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none text-sm font-bold"
                    />
                  </div>

                  <button 
                    type="button" 
                    onClick={() => removeOfertaEspecial(item.id)}
                    className="w-full sm:w-10 h-10 flex items-center justify-center bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
              
              {listaOfertasEspeciais.length > 0 && (
                <div className="text-right pr-2 pt-2 text-sm font-bold text-gray-600">
                  Subtotal Ofertas Esp: <span className="text-yellow-700">{formatarMoedaVisual(totalOfertaEspecial)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-red-50/30 border border-red-100 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Saídas Diversas</h3>
                <p className="text-xs text-gray-500">Descreva os pagamentos e gastos da reunião.</p>
              </div>
              <button 
                type="button" 
                onClick={addSaida}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
              >
                <span>+</span> Adicionar Saída
              </button>
            </div>

            <div className="space-y-3">
              {listaSaidas.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed border-red-200 rounded-xl text-red-400 text-sm font-medium">
                  Nenhuma saída ou despesa registrada.
                </div>
              )}
              
              {listaSaidas.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white p-3 rounded-xl border border-red-200 shadow-sm animate-fade-in">
                  
                  <div className="flex-1 w-full">
                    <input 
                      type="text" 
                      placeholder="Descrição da despesa (Ex: Água, Ajuda de custo, Combustível...)"
                      value={item.descricao}
                      onChange={(e) => updateSaida(item.id, { descricao: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm text-gray-900 font-medium"
                    />
                  </div>

                  <div className="w-full sm:w-32 flex-shrink-0 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">R$</span>
                    <input 
                      type="number" step="0.01" min="0" placeholder="0,00"
                      value={item.valor}
                      onChange={(e) => updateSaida(item.id, { valor: e.target.value ? parseFloat(e.target.value) : "" })}
                      className="w-full pl-9 pr-3 py-2.5 bg-red-50 border border-red-200 text-red-900 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm font-bold"
                    />
                  </div>

                  <button 
                    type="button" 
                    onClick={() => removeSaida(item.id)}
                    className="w-full sm:w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-colors flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
              
              {listaSaidas.length > 0 && (
                <div className="text-right pr-2 pt-2 text-sm font-bold text-gray-600">
                  Subtotal Saídas: <span className="text-red-600">- {formatarMoedaVisual(totalSaidas)}</span>
                </div>
              )}
            </div>
          </div>

          <div className={`p-6 rounded-xl flex flex-col md:flex-row items-center justify-between border ${totalCalculado >= 0 ? 'bg-teal-50 border-teal-100' : 'bg-red-50 border-red-100'}`}>
            <span className={`text-sm font-bold uppercase tracking-wider ${totalCalculado >= 0 ? 'text-teal-800' : 'text-red-800'}`}>
              Saldo Líquido da Reunião
            </span>
            <span className={`text-3xl font-black tracking-tight ${totalCalculado >= 0 ? 'text-teal-700' : 'text-red-700'}`}>
              {formatarMoedaVisual(totalCalculado)}
            </span>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <button 
              type="submit" 
              disabled={salvando || carregandoDados}
              className={`w-full md:w-auto px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
                salvando ? "bg-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-105 hover:shadow-indigo-500/30"
              }`}
            >
              {salvando ? "Processando e Salvando..." : "Gravar Lançamento"}
            </button>
          </div>

        </form>
      </div>

      {mostrarModalSucesso && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 cursor-pointer" onClick={fecharModalELimpar}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center cursor-default" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Lançamento Salvo!</h3>
            <p className="text-gray-500 text-sm mb-6">Todos os valores detalhados foram registrados com sucesso no cofre digital.</p>
            <div className="flex flex-col gap-3">
              <button onClick={fecharModalELimpar} className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition">Gravar Outra Reunião</button>
              <button onClick={() => router.push("/tesouraria")} className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition">Voltar ao Painel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}