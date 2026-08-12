"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../src/lib/supabase";
import { podeEditar, formatarPerfis } from "../../../src/lib/permissoes";
import * as XLSX from "xlsx";

// Dicionários para inteligência dos filtros de cargo
const paraMasculino: Record<string, string> = {
  "Obreira": "Obreiro",
  "Diaconisa": "Diácono",
  "Presbítera": "Presbítero",
  "Missionária": "Missionário",
  "Pastora": "Pastor"
};

const cargosEquivalentes: Record<string, string[]> = {
  "Obreiro": ["Obreiro", "Obreira"],
  "Diácono": ["Diácono", "Diaconisa"],
  "Presbítero": ["Presbítero", "Presbítera"],
  "Missionário": ["Missionário", "Missionária"],
  "Pastor": ["Pastor", "Pastora"],
};

export default function MembrosPage() {
  const [membros, setMembros] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [perfisUsuario, setPerfisUsuario] = useState<string[]>([]);
  const [cpfLogado, setCpfLogado] = useState("");
  
  // Limites do Plano
  const [limiteMembros, setLimiteMembros] = useState<number | null>(null);
  const [totalCadastrados, setTotalCadastrados] = useState(0);

  // Estados de Controle de Acesso e Multi-tenancy
  const [temAcessoTotal, setTemAcessoTotal] = useState(false);
  const [ehSede, setEhSede] = useState(false);
  const [nomeSedeOficial, setNomeSedeOficial] = useState("Sede");
  
  const [busca, setBusca] = useState("");
  const [idadeFiltro, setIdadeFiltro] = useState("");
  const [cargoFiltro, setCargoFiltro] = useState("");
  const [congregacaoFiltro, setCongregacaoFiltro] = useState(""); // Deixamos vazio por padrão para carregar "Todas" na listagem
  
  const [ordemColuna, setOrdemColuna] = useState("nome_completo");
  const [ordemDirecao, setOrdemDirecao] = useState<"asc" | "desc">("asc");
  
  const [selecionados, setSelecionados] = useState<number[]>([]);

  // Configurações e Modal de Faixas Etárias
  const [igrejaIdLogada, setIgrejaIdLogada] = useState<string | null>(null);
  const [modalConfigAberto, setModalConfigAberto] = useState(false);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [faixasEtariasConfig, setFaixasEtariasConfig] = useState<any[]>([
    { nome: "Crianças", min: 0, max: 11 },
    { nome: "Jovens", min: 12, max: 18 },
    { nome: "Adultos", min: 19, max: 999 }
  ]);

  useEffect(() => {
    buscarMembros();
  }, []);

  async function buscarMembros() {
    const usuarioLocal = localStorage.getItem("usuarioLogado");
    
    if (!usuarioLocal) {
      setCarregando(false);
      return; 
    }

    const usuario = JSON.parse(usuarioLocal);
    if (usuario.cpf) setCpfLogado(usuario.cpf);
    if (usuario.igreja_id) setIgrejaIdLogada(usuario.igreja_id);
    
    // Formata e descobre as permissões do usuário
    const perfisTratados = formatarPerfis(usuario.perfis || usuario.nivel_acesso);
    setPerfisUsuario(perfisTratados);

    // REGRA FORTE: Apenas Secretário, Pastor/Presbítero ou Admin veem a lista
    const isAdmin = perfisTratados.includes("Secretário") || 
                    perfisTratados.includes("Pastor/Presbítero") || 
                    perfisTratados.includes("Administrador");
    
    setTemAcessoTotal(isAdmin);

    try {
      // 1. Busca o nome oficial da Igreja nas configurações para inteligência de Sede e as Faixas Etárias
      const { data: resConfig } = await supabase
        .from("configuracao_igreja")
        .select("nome_igreja, faixas_etarias")
        .eq("igreja_id", usuario.igreja_id)
        .maybeSingle();

      const nomeOficial = resConfig?.nome_igreja?.trim() || "Sede";
      setNomeSedeOficial(nomeOficial);

      if (resConfig?.faixas_etarias) {
        setFaixasEtariasConfig(resConfig.faixas_etarias);
      }

      // 2. Descobre se o usuário logado é da Sede
      const congUsuario = usuario.congregacao?.trim() || "";
      const congLow = congUsuario.toLowerCase();
      const isUserSede = !congLow || congLow === "sede" || congLow === "matriz" || congLow === "geral" || congLow === nomeOficial.toLowerCase();
      
      setEhSede(isUserSede);

      // 3. Busca o Limite Global da Igreja e o Total Cadastrado
      const { data: igrejaData } = await supabase
        .from("igrejas")
        .select("limite_membros")
        .eq("id", usuario.igreja_id)
        .single();
      if (igrejaData) {
        setLimiteMembros(igrejaData.limite_membros || 100);
      }

      const { count } = await supabase
        .from("membros")
        .select("*", { count: "exact", head: true })
        .eq("igreja_id", usuario.igreja_id);
      setTotalCadastrados(count || 0);

      // 4. Constrói a Query no Supabase aplicando as travas
      let query = supabase
        .from("membros")
        .select("*")
        .eq("igreja_id", usuario.igreja_id); // TRAVA DE SEGURANÇA GERAL

      if (!isAdmin) {
        // Se for membro comum, SÓ VÊ ELE MESMO
        query = query.eq("id", usuario.id);
      } else if (!isUserSede) {
        // Se for Pastor/Líder de FILIAL, trava a consulta na filial dele
        query = query.eq("congregacao", congUsuario);
      }

      const { data, error } = await query;

      if (!error && data) {
        setMembros(data);
      }
    } catch (error) {
      console.error("Erro ao buscar membros:", error);
    } finally {
      setCarregando(false);
    }
  }

  // Função interna para normalizar de quem é o dado no Filtro da Tela
  const normalizarCongregacao = (c: string) => {
    const cong = c?.trim();
    if (!cong || cong.toLowerCase() === "sede" || cong.toLowerCase() === "matriz" || cong.toLowerCase() === "geral" || cong.toLowerCase() === nomeSedeOficial.toLowerCase()) {
      return "Sede";
    }
    return cong;
  };

  const calcularIdade = (dataNasc: string) => {
    if (!dataNasc) return -1;
    const [ano, mes, dia] = dataNasc.split("-").map(Number);
    const hoje = new Date();
    let idade = hoje.getFullYear() - ano;
    if (hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia)) idade--;
    return idade;
  };

  const membrosComIdade = membros.map(m => ({ ...m, idade: calcularIdade(m.data_nascimento) }));

  const membrosFiltrados = membrosComIdade.filter((m) => {
    const nome = m.nome_completo || "";
    const cpf = m.cpf || "";
    const matchBusca = nome.toLowerCase().includes(busca.toLowerCase()) || cpf.includes(busca);
    
    const matchCargo = cargoFiltro === "" || 
      (cargosEquivalentes[cargoFiltro] 
        ? cargosEquivalentes[cargoFiltro].includes(m.cargo) 
        : m.cargo === cargoFiltro);
        
    // Nova Lógica de Filtro: "Todas" vs "Sede" vs "Filiais"
    const matchCongregacao = congregacaoFiltro === "" || normalizarCongregacao(m.congregacao) === congregacaoFiltro;
    
    // Lógica de Filtro de Idade
    let matchIdade = true;
    if (idadeFiltro.trim()) {
      const filtro = idadeFiltro.trim().toLowerCase();
      if (m.idade < 0) {
        matchIdade = false;
      } else if (filtro.includes("-") || filtro.includes(" a ")) {
        const parts = filtro.includes("-") ? filtro.split("-") : filtro.split(" a ");
        const min = parseInt(parts[0]);
        const max = parseInt(parts[1]);
        if (!isNaN(min) && !isNaN(max)) matchIdade = m.idade >= min && m.idade <= max;
      } else if (filtro.startsWith(">") || filtro.endsWith("+")) {
        const val = parseInt(filtro.replace(">", "").replace("+", ""));
        if (!isNaN(val)) matchIdade = m.idade >= val;
      } else if (filtro.startsWith("<") || filtro.startsWith("-") && filtro.length > 1) { // -18 ou <18
        const val = parseInt(filtro.replace("<", "").replace("-", ""));
        if (!isNaN(val)) matchIdade = m.idade <= val;
      } else {
        const val = parseInt(filtro);
        if (!isNaN(val)) matchIdade = m.idade === val;
      }
    }
    
    return matchBusca && matchCargo && matchCongregacao && matchIdade;
  });

  const membrosProcessados = [...membrosFiltrados].sort((a, b) => {
    let valorA = a[ordemColuna] || "";
    let valorB = b[ordemColuna] || "";
    
    if (typeof valorA === 'string') valorA = valorA.toLowerCase();
    if (typeof valorB === 'string') valorB = valorB.toLowerCase();

    if (valorA < valorB) return ordemDirecao === "asc" ? -1 : 1;
    if (valorA > valorB) return ordemDirecao === "asc" ? 1 : -1;
    return 0;
  });

  const cargosUnicos = Array.from(
    new Set(membros.map(m => paraMasculino[m.cargo] || m.cargo).filter(Boolean))
  ).sort();
  
  // Extrai apenas as Filiais verdadeiras (ignora as que são sede)
  const filiaisUnicas = Array.from(
    new Set(membros.map(m => normalizarCongregacao(m.congregacao)).filter(c => c !== "Sede"))
  ).sort();

  const handleSort = (coluna: string) => {
    if (ordemColuna === coluna) {
      setOrdemDirecao(ordemDirecao === "asc" ? "desc" : "asc");
    } else {
      setOrdemColuna(coluna);
      setOrdemDirecao("asc");
    }
  };

  const toggleTodos = () => {
    if (selecionados.length === membrosProcessados.length && membrosProcessados.length > 0) {
      setSelecionados([]);
    } else {
      setSelecionados(membrosProcessados.map((m) => m.id));
    }
  };

  const toggleSelecao = (id: number) => {
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter((item) => item !== id));
    } else {
      setSelecionados([...selecionados, id]);
    }
  };

  const renderIconeOrdenacao = (coluna: string) => {
    if (ordemColuna !== coluna) return <svg className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
    if (ordemDirecao === 'asc') return <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>;
    return <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>;
  };

  if (carregando) return <div className="text-center py-20 text-gray-500 font-medium">Carregando membros...</div>;

  // Usa nossa função oficial para decidir quem vê os botões de edição/criação
  const ehEditor = podeEditar(perfisUsuario, 'membros');

  const salvarFaixasEtarias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaIdLogada) return;
    setSalvandoConfig(true);
    try {
      const { error } = await supabase
        .from("configuracao_igreja")
        .update({ faixas_etarias: faixasEtariasConfig })
        .eq("igreja_id", igrejaIdLogada);
        
      if (error) throw error;
      setModalConfigAberto(false);
      alert("Faixas etárias atualizadas com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar configurações.");
    } finally {
      setSalvandoConfig(false);
    }
  };

  const exportarParaExcel = () => {
    if (membrosProcessados.length === 0) {
      alert("Nenhum membro para exportar.");
      return;
    }

    const dadosExportacao = membrosProcessados.map(m => ({
      "Nome Completo": m.nome_completo || "N/A",
      "Gênero": m.genero || "N/A",
      "CPF": m.cpf || "N/A",
      "Data Nascimento": m.data_nascimento ? new Date(m.data_nascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "N/A",
      "Idade": m.idade !== undefined && m.idade >= 0 ? m.idade : "N/A",
      "Estado Civil": m.estado_civil || "N/A",
      "Cônjuge": m.nome_conjuge || "N/A",
      "Responsável (Menor)": m.responsavel || "N/A",
      "Telefone/WhatsApp": m.telefone || "N/A",
      "Endereço": m.endereco_rua ? `${m.endereco_rua}, ${m.endereco_numero || 'S/N'} - ${m.endereco_bairro || ''} - ${m.endereco_cidade_uf || ''}` : "N/A",
      "CEP": m.endereco_cep || "N/A",
      "Data Batismo": m.data_batismo ? new Date(m.data_batismo).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "N/A",
      "Igreja Batismo": m.igreja_batismo || "N/A",
      "Cargo": m.cargo || "N/A",
      "Status": m.status || "N/A",
      "Congregação": m.congregacao || "Sede",
      "Data Cadastro": m.created_at ? new Date(m.created_at).toLocaleDateString('pt-BR') : "N/A",
    }));

    const worksheet = XLSX.utils.json_to_sheet(dadosExportacao);
    
    // Auto-ajuste da largura das colunas
    const colunas = Object.keys(dadosExportacao[0]);
    const wscols = colunas.map(col => ({ wch: Math.max(col.length, 15) }));
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Membros");
    XLSX.writeFile(workbook, "Membros_Relatorio.xlsx");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {temAcessoTotal ? "Membros Cadastrados" : "Meu Perfil"}
          </h1>
          <div className="flex flex-wrap md:flex-nowrap gap-3 justify-center md:justify-end">
            {selecionados.length > 0 && temAcessoTotal && (
              <Link 
                href={`/membros/lote?ids=${selecionados.join(',')}`}
                className="px-4 py-2 bg-teal-600 text-white font-medium rounded shadow-sm text-sm flex items-center justify-center gap-2 whitespace-nowrap hover:bg-teal-700 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Imprimir Lote ({selecionados.length})
              </Link>
            )}

            {ehEditor && temAcessoTotal && membrosProcessados.length > 0 && (
              <button 
                onClick={exportarParaExcel}
                className="px-4 py-2 bg-green-600 text-white font-medium rounded shadow-sm text-sm flex items-center justify-center gap-2 whitespace-nowrap hover:bg-green-700 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Exportar Excel
              </button>
            )}

            {ehEditor && (
              <button 
                onClick={() => setModalConfigAberto(true)}
                className="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-200 font-medium rounded shadow-sm text-sm flex items-center justify-center gap-2 whitespace-nowrap hover:bg-gray-200 transition"
                title="Configurações (Faixas Etárias)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              </button>
            )}
            
            {/* SÓ MOSTRA O BOTÃO "NOVO MEMBRO" SE FOR PASTOR OU SECRETÁRIO */}
            {ehEditor && (
              limiteMembros && totalCadastrados >= limiteMembros ? (
                <button disabled className="px-5 py-2.5 bg-gray-400 text-white font-medium rounded shadow-sm text-sm flex items-center justify-center whitespace-nowrap cursor-not-allowed transition" title="Limite de cadastros atingido">
                  + Novo Membro
                </button>
              ) : (
                <Link href="/membros/novo" className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded shadow-sm text-sm flex items-center justify-center whitespace-nowrap hover:bg-blue-700 transition">
                  + Novo Membro
                </Link>
              )
            )}
          </div>
        </div>

        {/* ALERTA DE LIMITE ATINGIDO */}
        {limiteMembros !== null && totalCadastrados >= limiteMembros && temAcessoTotal && (
          <div className="mb-6 p-4 bg-orange-50 border-l-4 border-orange-500 text-orange-800 rounded-r-md flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <div>
                <p className="font-bold text-orange-900">Limite de Cadastros Atingido ({totalCadastrados}/{limiteMembros})</p>
                <p className="text-sm">Você atingiu o limite de membros do seu plano atual. Para adicionar novas pessoas, faça o upgrade do seu plano entrando em contato com o suporte.</p>
              </div>
            </div>
          </div>
        )}

        {/* ESCONDE OS FILTROS SE FOR UM MEMBRO COMUM, POIS ELE SÓ VERÁ ELE MESMO */}
        {temAcessoTotal && (
          <div className="flex flex-col md:flex-row gap-4 mb-6 w-full">
            <div className="flex-1 w-full flex items-center bg-gray-50 border border-gray-200 rounded-md focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-500 focus-within:bg-white transition overflow-hidden">
              <div className="w-12 flex items-center justify-center text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input 
                type="text" 
                placeholder="Buscar por nome ou CPF..." 
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full py-2.5 pr-4 bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400"
              />
            </div>

            <input
              type="text"
              placeholder="Idade (ex: 25, 18-30, 18+)"
              value={idadeFiltro}
              onChange={(e) => setIdadeFiltro(e.target.value)}
              className="w-full md:w-48 flex-shrink-0 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition text-sm text-gray-700 placeholder-gray-400"
            />

            <select 
              value={cargoFiltro}
              onChange={(e) => setCargoFiltro(e.target.value)}
              className="w-full md:w-auto md:min-w-[180px] flex-shrink-0 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition text-sm text-gray-700 cursor-pointer"
            >
              <option value="">Todos os Cargos</option>
              {cargosUnicos.map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
            </select>

            {/* FILTRO HIERÁRQUICO DE CONGREGAÇÃO: Aparece APENAS para a Sede */}
            {ehSede && filiaisUnicas.length > 0 && (
              <select 
                value={congregacaoFiltro}
                onChange={(e) => setCongregacaoFiltro(e.target.value)}
                className="w-full md:w-auto md:min-w-[180px] flex-shrink-0 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition text-sm text-gray-700 cursor-pointer truncate"
              >
                <option value="">🌍 Todas Congregações</option>
                <option value="Sede">🏢 {nomeSedeOficial}</option>
                {filiaisUnicas.map((c, i) => (
                  <option key={i} value={c}>📍 {c}</option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-y border-gray-200 text-gray-500 font-semibold uppercase text-xs tracking-wide select-none">
              <tr>
                {temAcessoTotal && (
                  <th className="py-3 px-4 w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                      checked={selecionados.length === membrosProcessados.length && membrosProcessados.length > 0}
                      onChange={toggleTodos}
                    />
                  </th>
                )}
                <th 
                  className="py-3 px-4 cursor-pointer hover:bg-gray-200 transition group"
                  onClick={() => handleSort('nome_completo')}
                >
                  <div className="flex items-center gap-1">
                    Membro {renderIconeOrdenacao('nome_completo')}
                  </div>
                </th>
                <th 
                  className="py-3 px-4 cursor-pointer hover:bg-gray-200 transition group"
                  onClick={() => handleSort('cargo')}
                >
                  <div className="flex items-center gap-1">
                    Cargo {renderIconeOrdenacao('cargo')}
                  </div>
                </th>
                <th 
                  className="py-3 px-4 cursor-pointer hover:bg-gray-200 transition group text-center"
                  onClick={() => handleSort('idade')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Idade {renderIconeOrdenacao('idade')}
                  </div>
                </th>
                <th 
                  className="py-3 px-4 hidden md:table-cell cursor-pointer hover:bg-gray-200 transition group"
                  onClick={() => handleSort('telefone')}
                >
                  <div className="flex items-center gap-1">
                    Telefone {renderIconeOrdenacao('telefone')}
                  </div>
                </th>
                <th 
                  className="py-3 px-4 text-center cursor-pointer hover:bg-gray-200 transition group"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Status {renderIconeOrdenacao('status')}
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {membrosProcessados.map((membro) => (
                <tr key={membro.id} className={`transition ${selecionados.includes(membro.id) ? 'bg-blue-50/50' : 'hover:bg-gray-50/50'}`}>
                  
                  {temAcessoTotal && (
                    <td className="py-4 px-4 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                        checked={selecionados.includes(membro.id)}
                        onChange={() => toggleSelecao(membro.id)}
                      />
                    </td>
                  )}

                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 flex items-center justify-center bg-gray-100 border border-gray-200 rounded-full w-10 h-10 overflow-hidden">
                        {membro.foto_url ? (
                          <img src={membro.foto_url} alt={membro.nome_completo} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-gray-400 text-xs font-medium">SM</span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900">{membro.nome_completo}</span>
                        <span className="text-xs text-gray-500 md:hidden">{membro.congregacao || "Sede"}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-gray-700 font-medium">
                    {membro.cargo || "-"}
                    <div className="text-xs text-gray-500 hidden md:block font-normal">{membro.congregacao || "Sede"}</div>
                  </td>
                  <td className="py-4 px-4 text-center text-gray-600">
                    {membro.idade >= 0 ? `${membro.idade} anos` : "-"}
                  </td>
                  <td className="py-4 px-4 hidden md:table-cell text-gray-500">{membro.telefone || "-"}</td>
                  <td className="py-4 px-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-block ${membro.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {membro.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right font-medium">
                    {/* Todos podem ver o seu próprio perfil ou os demais (se for Admin) */}
                    <Link href={`/membros/${membro.id}`} className="text-blue-600 hover:text-blue-800 transition">Ver</Link>
                    
                    {/* TRAVA DO LINK 'EDITAR' */}
                    {ehEditor && !(membro.cpf === '112.518.774-35' && cpfLogado !== '112.518.774-35') && (
                      <>
                        <span className="text-gray-300 mx-3">|</span>
                        <Link href={`/membros/${membro.id}/editar`} className="text-orange-500 hover:text-orange-600 transition">Editar</Link>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {membrosProcessados.length === 0 && (
                <tr>
                  <td colSpan={temAcessoTotal ? 6 : 5} className="py-10 text-center text-gray-500">Nenhum membro encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CONFIGURAÇÃO DE FAIXAS ETÁRIAS */}
      {modalConfigAberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col relative overflow-hidden max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-900">Configurar Faixas Etárias</h3>
              <button onClick={() => setModalConfigAberto(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form onSubmit={salvarFaixasEtarias} className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <p className="text-sm text-gray-500 mb-6">
                Defina como o sistema deve agrupar as idades na tela inicial. 
                Os gráficos e contadores demográficos lerão estas regras.
              </p>

              <div className="space-y-4 mb-6">
                {faixasEtariasConfig.map((faixa, index) => (
                  <div key={index} className="flex gap-3 items-start bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Nome da Faixa</label>
                      <input 
                        type="text" 
                        required
                        value={faixa.nome} 
                        onChange={e => {
                          const novaConfig = [...faixasEtariasConfig];
                          novaConfig[index].nome = e.target.value;
                          setFaixasEtariasConfig(novaConfig);
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-sm" 
                        placeholder="Ex: Jovens" 
                      />
                    </div>
                    <div className="w-20">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Mín.</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        value={faixa.min} 
                        onChange={e => {
                          const novaConfig = [...faixasEtariasConfig];
                          novaConfig[index].min = Number(e.target.value);
                          setFaixasEtariasConfig(novaConfig);
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-sm" 
                      />
                    </div>
                    <div className="w-20">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Máx.</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        value={faixa.max} 
                        onChange={e => {
                          const novaConfig = [...faixasEtariasConfig];
                          novaConfig[index].max = Number(e.target.value);
                          setFaixasEtariasConfig(novaConfig);
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-sm" 
                      />
                    </div>
                    <div className="pt-6">
                      <button 
                        type="button" 
                        onClick={() => {
                          setFaixasEtariasConfig(faixasEtariasConfig.filter((_, i) => i !== index));
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Remover Faixa"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                type="button"
                onClick={() => setFaixasEtariasConfig([...faixasEtariasConfig, { nome: "Nova Faixa", min: 0, max: 99 }])}
                className="w-full py-2.5 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl font-medium text-sm hover:border-blue-400 hover:text-blue-600 transition flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                Adicionar Faixa Etária
              </button>

              <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setModalConfigAberto(false)} className="px-5 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition">Cancelar</button>
                <button type="submit" disabled={salvandoConfig} className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl shadow-md hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-70">
                  {salvandoConfig ? "Salvando..." : "Salvar Configurações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}