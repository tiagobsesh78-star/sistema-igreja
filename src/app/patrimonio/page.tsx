"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { podeVisualizar, podeEditar, formatarPerfis } from "../../lib/permissoes";

export default function PatrimonioPage() {
  const router = useRouter();

  // 1. TODOS OS STATES NO TOPO
  const [patrimoniosRaw, setPatrimoniosRaw] = useState<any[]>([]);
  const [patrimonios, setPatrimonios] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [perfisUsuario, setPerfisUsuario] = useState<string[]>([]);

  // Estados do Multi-tenancy Hierárquico
  const [ehSede, setEhSede] = useState(false);
  const [nomeSedeOficial, setNomeSedeOficial] = useState("Sede");
  const [congregacaoUsuario, setCongregacaoUsuario] = useState("");
  const [filtroCongregacao, setFiltroCongregacao] = useState(""); 
  const [congregacoesDisponiveis, setCongregacoesDisponiveis] = useState<string[]>([]);
  const [congregacaoForm, setCongregacaoForm] = useState("");

  // Estados de Ordenação
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  // Estados dos Modais
  const [modalCadastroAberto, setModalCadastroAberto] = useState(false);
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [modalMovimentoAberto, setModalMovimentoAberto] = useState(false);

  // Campos de Cadastro / Edição
  const [itemSelecionado, setItemSelecionado] = useState<any>(null);
  const [itemNome, setItemNome] = useState("");
  const [itemMarca, setItemMarca] = useState("");
  const [itemModelo, setItemModelo] = useState("");
  const [dataEntrada, setDataEntrada] = useState("");
  const [valorEstimado, setValorEstimado] = useState("");
  const [quantidade, setQuantidade] = useState<number>(1);

  // Campos de Movimentação e Histórico
  const [tipoMovimentacao, setTipoMovimentacao] = useState("");
  const [descricaoMovimentacao, setDescricaoMovimentacao] = useState("");
  const [historicoItem, setHistoricoItem] = useState<any[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  // 2. EFFECT PRINCIPAL COM A TRAVA DE ROTA E HIERARQUIA
  useEffect(() => {
    const carregarIgrejaEDados = async () => {
      try {
        const userLocal = localStorage.getItem("usuarioLogado");
        if (!userLocal) {
          router.push("/login");
          return;
        }

        const parsedUser = JSON.parse(userLocal);
        const perfisLogado = formatarPerfis(parsedUser.perfis || parsedUser.nivel_acesso);

        // TRAVA DE ROTA
        if (!podeVisualizar(perfisLogado, 'patrimonio')) {
          router.push("/");
          return; 
        }

        setPerfisUsuario(perfisLogado);
        const currentIgrejaId = parsedUser.igreja_id || parsedUser.id_igreja || parsedUser.idIgreja || parsedUser.igreja;
        setIgrejaId(currentIgrejaId ? String(currentIgrejaId) : null);
        
        if (!currentIgrejaId) {
          setCarregando(false);
          return;
        }

        // 1. Busca Configuração da Sede
        const { data: config } = await supabase
          .from("configuracao_igreja")
          .select("nome_igreja")
          .eq("igreja_id", currentIgrejaId)
          .maybeSingle();

        const nomeSede = config?.nome_igreja?.trim() || "Sede Principal";
        setNomeSedeOficial(nomeSede);

        // 2. Analisa a hierarquia do usuário logado
        const congUser = parsedUser?.congregacao?.trim() || "";
        setCongregacaoUsuario(congUser);
        
        const congLow = congUser.toLowerCase();
        const isUserSede = !congLow || congLow === "sede" || congLow === "matriz" || congLow === "geral" || congLow === nomeSede.toLowerCase();
        
        setEhSede(isUserSede);

        // 3. Monta a lista permitida com base no perfil
        if (isUserSede) {
          const { data: filhas } = await supabase
            .from("igrejas_filhas")
            .select("nome")
            .eq("igreja_id", currentIgrejaId)
            .order("nome", { ascending: true });

          const nomesFilhas = filhas ? filhas.map(f => f.nome) : [];
          setCongregacoesDisponiveis([nomeSede, ...nomesFilhas]);
          
          setFiltroCongregacao(nomeSede);
          setCongregacaoForm(nomeSede);
        } else {
          setCongregacoesDisponiveis([congUser]);
          setFiltroCongregacao(congUser);
          setCongregacaoForm(congUser);
        }

        // 4. Busca os Patrimônios aplicando a Trava Hierárquica
        let query = supabase
          .from("patrimonio")
          .select("*")
          .eq("igreja_id", currentIgrejaId)
          .order("id", { ascending: false });

        if (!isUserSede) {
          query = query.eq("congregacao", congUser);
        }

        const { data: patData } = await query;
        setPatrimoniosRaw(patData || []);

      } catch (e) {
        console.error(e);
      } finally {
        setCarregando(false);
      }
    };

    carregarIgrejaEDados();
  }, [router]);

  // Normalizador Universal de Congregação
  const normalizarSede = (c: string) => {
    const cong = c?.trim();
    if (!cong || cong.toLowerCase() === "sede" || cong.toLowerCase() === "matriz" || cong.toLowerCase() === "geral" || cong.toLowerCase() === nomeSedeOficial.toLowerCase()) {
      return nomeSedeOficial;
    }
    return cong;
  };

  // 3. FILTRO LOCAL EM TEMPO REAL (CORRIGIDO E BLINDADO)
  useEffect(() => {
    if (!patrimoniosRaw) return;

    if (filtroCongregacao === "Todas") {
      setPatrimonios(patrimoniosRaw);
    } else {
      const filtrados = patrimoniosRaw.filter(p => {
        // Blindagem contra espaços extras e letras maiúsculas/minúsculas
        const congDoItem = normalizarSede(p.congregacao).toLowerCase().trim();
        const congDoFiltro = filtroCongregacao.toLowerCase().trim();
        return congDoItem === congDoFiltro;
      });
      setPatrimonios(filtrados);
    }
  }, [filtroCongregacao, patrimoniosRaw, nomeSedeOficial]);


  // Função unificada para recarregar dados após CRUD
  const recarregarDados = async () => {
    if (!igrejaId) return;
    let query = supabase
      .from("patrimonio")
      .select("*")
      .eq("igreja_id", igrejaId)
      .order("id", { ascending: false });

    if (!ehSede) {
      query = query.eq("congregacao", congregacaoUsuario);
    }

    const { data } = await query;
    if (data) setPatrimoniosRaw(data);
  };

  // --- CÁLCULO DO VALOR TOTAL ATIVO (Excluindo Vendidos e Doações) ---
  const valorTotalAtivo = useMemo(() => {
    return patrimonios.reduce((acc, item) => {
      const status = item.status || "Disponível";
      if (status !== "Vendido" && status !== "Doação" && status !== "Venda") {
        return acc + (Number(item.valor) || 0);
      }
      return acc;
    }, 0);
  }, [patrimonios]);

  // --- LÓGICA DE ORDENAÇÃO ---
  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const patrimoniosOrdenados = useMemo(() => {
    let itensOrdenaveis = [...patrimonios];
    if (sortConfig !== null) {
      itensOrdenaveis.sort((a, b) => {
        let valorA = a[sortConfig.key];
        let valorB = b[sortConfig.key];

        if (valorA === null || valorA === undefined) valorA = "";
        if (valorB === null || valorB === undefined) valorB = "";

        if (valorA < valorB) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (valorA > valorB) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }
    return itensOrdenaveis;
  }, [patrimonios, sortConfig]);

  // --- LÓGICA DE EXPORTAÇÃO EXCEL (CSV PT-BR) ---
  const handleExportarExcel = () => {
    if (patrimonios.length === 0) {
      alert("Não há dados cadastrados para exportar.");
      return;
    }

    let conteudoCSV = "\uFEFF";
    conteudoCSV += "ID;Item;Marca;Modelo;Data de Entrada;Valor (R$);Status;Congregação\n";

    patrimoniosOrdenados.forEach((item) => {
      const idFmt = `#${item.id}`;
      const itemFmt = item.item.replace(/"/g, '""'); 
      const marcaFmt = (item.marca || "").replace(/"/g, '""'); 
      const modeloFmt = (item.modelo || "").replace(/"/g, '""'); 
      const dataFmt = formatarData(item.data_entrada);
      const valorFmt = (item.valor || 0).toFixed(2).replace(".", ",");
      const statusFmt = item.status || "Disponível";
      const congFmt = normalizarSede(item.congregacao);

      conteudoCSV += `${idFmt};"${itemFmt}";"${marcaFmt}";"${modeloFmt}";${dataFmt};${valorFmt};${statusFmt};${congFmt}\n`;
    });

    // Adiciona o Resumo no final
    const valorResumoFmt = (valorTotalAtivo || 0).toFixed(2).replace(".", ",");
    conteudoCSV += `\nRESUMO\n`;
    conteudoCSV += `Patrimônio Ativo Total;;;;;;${valorResumoFmt}\n`;

    const blob = new Blob([conteudoCSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `patrimonio_igreja_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderIconeOrdenacao = (key: string) => {
    if (sortConfig?.key !== key) {
      return <span className="text-gray-400 opacity-50 text-xs ml-1">↕</span>;
    }
    return sortConfig.direction === "asc" ? (
      <span className="text-blue-500 font-bold ml-1">↑</span>
    ) : (
      <span className="text-blue-500 font-bold ml-1">↓</span>
    );
  };

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaId) return;

    const congregacaoFinal = ehSede ? congregacaoForm : congregacaoUsuario;
    const valorTratado = parseFloat(valorEstimado.toString().replace(",", "."));
    const valorFinal = isNaN(valorTratado) ? 0 : valorTratado;
    const qtd = quantidade > 0 ? quantidade : 1;

    // Gera um array com a quantidade de itens solicitada
    const novasLinhas = Array.from({ length: qtd }).map(() => ({
      igreja_id: igrejaId,
      congregacao: congregacaoFinal,
      item: itemNome,
      marca: itemMarca,
      modelo: itemModelo,
      data_entrada: dataEntrada,
      valor: valorFinal,
      status: "Disponível"
    }));

    const { error } = await supabase.from("patrimonio").insert(novasLinhas);

    if (!error) {
      setModalCadastroAberto(false);
      limparCampos();
      recarregarDados();
    } else {
      alert("Erro ao cadastrar: " + error.message);
    }
  };

  const abrirEditar = (item: any) => {
    setItemSelecionado(item);
    setItemNome(item.item);
    setItemMarca(item.marca || "");
    setItemModelo(item.modelo || "");
    setDataEntrada(item.data_entrada);
    setValorEstimado(item.valor.toString());
    setQuantidade(1); // Sempre abre com 1 na edição
    setCongregacaoForm(normalizarSede(item.congregacao));
    setModalEditarAberto(true);
  };

  const handleDuplicar = (item: any) => {
    limparCampos();
    setItemNome(item.item);
    setItemMarca(item.marca || "");
    setItemModelo(item.modelo || "");
    setDataEntrada(item.data_entrada);
    setValorEstimado(item.valor ? item.valor.toString() : "");
    setQuantidade(1);
    setCongregacaoForm(normalizarSede(item.congregacao));
    setModalCadastroAberto(true); // Abre o modal de CADASTRO, não de edição
  };

  const handleEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemSelecionado || !igrejaId) return;

    const congregacaoFinal = ehSede ? congregacaoForm : congregacaoUsuario;
    const valorTratado = parseFloat(valorEstimado.toString().replace(",", "."));
    const valorFinal = isNaN(valorTratado) ? 0 : valorTratado;
    const qtd = quantidade > 0 ? quantidade : 1;

    // 1. Atualiza o item atual que foi selecionado
    const { error } = await supabase
      .from("patrimonio")
      .update({
        item: itemNome,
        marca: itemMarca,
        modelo: itemModelo,
        congregacao: congregacaoFinal,
        data_entrada: dataEntrada,
        valor: valorFinal,
      })
      .eq("id", itemSelecionado.id)
      .eq("igreja_id", igrejaId);

    if (error) {
      alert("Erro ao editar: " + error.message);
      return;
    }

    // 2. Se a quantidade for maior que 1, insere cópias adicionais
    if (qtd > 1) {
      const clones = Array.from({ length: qtd - 1 }).map(() => ({
        igreja_id: igrejaId,
        congregacao: congregacaoFinal,
        item: itemNome,
        marca: itemMarca,
        modelo: itemModelo,
        data_entrada: dataEntrada,
        valor: valorFinal,
        status: itemSelecionado.status || "Disponível" // Herda o status do item editado
      }));
      await supabase.from("patrimonio").insert(clones);
    }

    setModalEditarAberto(false);
    limparCampos();
    recarregarDados();
  };

  const handleExcluir = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir permanentemente este item do patrimônio?")) return;
    if (!igrejaId) return;
    
    const { error } = await supabase
      .from("patrimonio")
      .delete()
      .eq("id", id)
      .eq("igreja_id", igrejaId); // Trava de exclusão
      
    if (!error) recarregarDados();
  };

  const abrirModalMovimentacao = async (item: any) => {
    setItemSelecionado(item);
    setTipoMovimentacao(item.status === "Disponível" ? "Manutenção" : item.status);
    setDescricaoMovimentacao("");
    setModalMovimentoAberto(true);
    setCarregandoHistorico(true);

    const { data } = await supabase
      .from("patrimonio_historico")
      .select("*")
      .eq("patrimonio_id", item.id)
      .order("id", { ascending: false });
    
    setHistoricoItem(data || []);
    setCarregandoHistorico(false);
  };

  const handleMovimentar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemSelecionado || !igrejaId) return;

    const statusFinal = tipoMovimentacao === "Venda" ? "Vendido" : tipoMovimentacao;

    const { error: erroPrincipal } = await supabase
      .from("patrimonio")
      .update({ status: statusFinal })
      .eq("id", itemSelecionado.id)
      .eq("igreja_id", igrejaId);

    if (!erroPrincipal) {
      await supabase.from("patrimonio_historico").insert([
        {
          patrimonio_id: itemSelecionado.id,
          status_anterior: itemSelecionado.status || "Disponível",
          status_novo: statusFinal,
          descricao: descricaoMovimentacao
        }
      ]);

      setModalMovimentoAberto(false);
      limparCampos();
      recarregarDados();
    } else {
      alert("Erro ao movimentar: " + erroPrincipal.message);
    }
  };

  const limparCampos = () => {
    setItemSelecionado(null);
    setItemNome("");
    setItemMarca("");
    setItemModelo("");
    setDataEntrada("");
    setValorEstimado("");
    setQuantidade(1);
    setTipoMovimentacao("");
    setDescricaoMovimentacao("");
    setHistoricoItem([]);
    setCongregacaoForm(ehSede ? nomeSedeOficial : congregacaoUsuario);
  };

  const formatarData = (dataStr: string, incluirHora = false) => {
    if (!dataStr) return "-";
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return dataStr;
    return incluirHora 
      ? d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  };

  const getStatusColor = (status: string) => {
    const s = status || "Disponível";
    if (s === "Doação" || s === "Venda" || s === "Vendido") return "text-red-600 font-semibold";
    if (s === "Emprestado" || s === "Manutenção") return "text-blue-600 font-semibold";
    return "text-gray-800 font-medium dark:text-gray-200";
  };

  const ehEditor = podeEditar(perfisUsuario, 'patrimonio');

  if (carregando) return <div className="p-8 text-center text-gray-500 font-medium animate-pulse">Carregando patrimônio...</div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">Patrimônio</h1>
          <p className="text-gray-600 dark:text-gray-400">Gerencie, movimente e exporte os ativos da igreja</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          
          {/* SELETOR HIERÁRQUICO */}
          {ehSede && congregacoesDisponiveis.length > 0 && (
            <select
              value={filtroCongregacao}
              onChange={(e) => setFiltroCongregacao(e.target.value)}
              className="w-full sm:w-auto max-w-full truncate px-4 py-3 bg-indigo-50 border border-indigo-100 text-indigo-800 font-bold text-sm rounded-lg hover:border-indigo-300 focus:border-indigo-500 outline-none transition-all shadow-sm cursor-pointer"
            >
              <option value={nomeSedeOficial}>🏢 {nomeSedeOficial} (Sede)</option>
              <option value="Todas">🌍 Todas as Congregações</option>
              {congregacoesDisponiveis.filter(c => c !== nomeSedeOficial).map(c => (
                <option key={c} value={c}>📍 {c}</option>
              ))}
            </select>
          )}

          <button
            onClick={handleExportarExcel}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar Excel
          </button>
          
          {/* SÓ APARECE O BOTÃO CADASTRAR SE PUDER EDITAR O MÓDULO */}
          {ehEditor && (
            <button
              onClick={() => { limparCampos(); setModalCadastroAberto(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors w-full sm:w-auto shadow-md"
            >
              + Cadastrar Item
            </button>
          )}
        </div>
      </div>

      {/* CARD KPI DE VALOR TOTAL ATIVO */}
      <div className="mb-6 max-w-sm w-full">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Patrimônio Ativo Total
              </p>
              <h3 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white mt-1">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorTotalAtivo)}
              </h3>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 italic">
            * Exclui itens com status "Vendido" ou "Doação".
          </p>
        </div>
      </div>

      {/* TABELA PRINCIPAL */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-x-auto w-full border border-gray-100 dark:border-gray-700">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-750 text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600 text-sm">
              <th 
                className="p-4 font-bold cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-16 select-none"
                onClick={() => handleSort("id")}
              >
                ID {renderIconeOrdenacao("id")}
              </th>
              <th 
                className="p-4 font-bold cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none"
                onClick={() => handleSort("item")}
              >
                Item {renderIconeOrdenacao("item")}
              </th>
              {filtroCongregacao === "Todas" && (
                <th className="p-4 font-bold select-none text-gray-500">
                  Congregação
                </th>
              )}
              <th 
                className="p-4 font-bold cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none"
                onClick={() => handleSort("data_entrada")}
              >
                Entrada {renderIconeOrdenacao("data_entrada")}
              </th>
              <th 
                className="p-4 font-bold cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none"
                onClick={() => handleSort("valor")}
              >
                Valor {renderIconeOrdenacao("valor")}
              </th>
              <th 
                className="p-4 font-bold cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none"
                onClick={() => handleSort("status")}
              >
                Status {renderIconeOrdenacao("status")}
              </th>
              {ehEditor && (
                <th className="p-4 font-bold text-center">Ações</th>
              )}
            </tr>
          </thead>
          <tbody>
            {patrimoniosOrdenados.length === 0 ? (
              <tr><td colSpan={ehEditor ? (filtroCongregacao === "Todas" ? 7 : 6) : (filtroCongregacao === "Todas" ? 6 : 5)} className="p-8 text-center text-gray-500 font-medium">Nenhum patrimônio registrado nesta congregação.</td></tr>
            ) : (
              patrimoniosOrdenados.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                  <td className="p-4 text-gray-600 dark:text-gray-300 font-medium">#{item.id}</td>
                  <td className="p-4 text-gray-800 dark:text-gray-100 font-semibold">
                    {item.item}
                    {/* Exibe Marca e Modelo subtitulados se existirem */}
                    {(item.marca || item.modelo) && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-normal mt-0.5">
                        {item.marca && <span>Marca: {item.marca}</span>}
                        {item.marca && item.modelo && <span> | </span>}
                        {item.modelo && <span>Modelo: {item.modelo}</span>}
                      </div>
                    )}
                  </td>
                  
                  {filtroCongregacao === "Todas" && (
                    <td className="p-4 text-gray-500 text-sm font-medium">
                      {normalizarSede(item.congregacao)}
                    </td>
                  )}

                  <td className="p-4 text-gray-600 dark:text-gray-300">{formatarData(item.data_entrada)}</td>
                  <td className="p-4 text-gray-600 dark:text-gray-300 font-medium">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.valor || 0)}
                  </td>
                  <td className={`p-4 ${getStatusColor(item.status)}`}>
                    <span className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-sm">
                      {item.status || "Disponível"}
                    </span>
                  </td>
                  
                  {/* SÓ MOSTRA A CÉLULA DOS BOTÕES SE FOR EDITOR */}
                  {ehEditor && (
                    <td className="p-4">
                      <div className="flex justify-center items-center gap-2">
                        <button
                          onClick={() => abrirModalMovimentacao(item)}
                          className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors focus:ring-2 focus:ring-blue-300 outline-none"
                          title="Movimentar Item"
                        >
                          Movimentar
                        </button>
                        <button
                          onClick={() => handleDuplicar(item)}
                          className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors focus:ring-2 focus:ring-indigo-300 outline-none"
                          title="Duplicar como novo Cadastro"
                        >
                          Duplicar
                        </button>
                        <button
                          onClick={() => abrirEditar(item)}
                          className="bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors focus:ring-2 focus:ring-gray-300 outline-none"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleExcluir(item.id)}
                          className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors focus:ring-2 focus:ring-red-300 outline-none"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: CADASTRO */}
      {modalCadastroAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Cadastrar Novo Item</h2>
            <form onSubmit={handleCadastrar} className="space-y-4">
              
              {/* SELETOR DA CONGREGAÇÃO PARA NOVO ITEM */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Congregação Padrão *</label>
                {ehSede ? (
                  <select 
                    required 
                    value={congregacaoForm} 
                    onChange={(e) => setCongregacaoForm(e.target.value)} 
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer font-semibold"
                  >
                    <option value="" disabled>Selecione a Congregação</option>
                    {congregacoesDisponiveis.map((nome, idx) => (
                      <option key={idx} value={nome}>{nome === nomeSedeOficial ? `🏢 ${nome}` : `📍 ${nome}`}</option>
                    ))}
                  </select>
                ) : (
                  <select disabled className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-gray-100 dark:bg-gray-700 text-gray-500 cursor-not-allowed font-semibold">
                    <option value={congregacaoUsuario}>📍 {congregacaoUsuario}</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Item *</label>
                <input type="text" required value={itemNome} onChange={(e) => setItemNome(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="Ex: Cadeira, Microfone, Projetor..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Marca (Opcional)</label>
                  <input type="text" value={itemMarca} onChange={(e) => setItemMarca(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="Ex: Yamaha" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Modelo (Opcional)</label>
                  <input type="text" value={itemModelo} onChange={(e) => setItemModelo(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="Ex: MG16XU" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data *</label>
                  <input type="date" required value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Unitário *</label>
                  <input type="number" step="0.01" required value={valorEstimado} onChange={(e) => setValorEstimado(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="0.00" />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm font-black text-blue-700 dark:text-blue-400 mb-1">Quantidade *</label>
                  <input type="number" min="1" required value={quantidade} onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)} className="w-full border border-blue-300 dark:border-blue-600 rounded-lg p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold" />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4">
                <button type="button" onClick={() => setModalCadastroAberto(false)} className="px-5 py-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium rounded-lg transition-colors">Cancelar</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors">
                  {quantidade > 1 ? `Salvar ${quantidade} Itens` : 'Criar Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR */}
      {modalEditarAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Editar Item</h2>
            <form onSubmit={handleEditar} className="space-y-4">

              {/* SELETOR DA CONGREGAÇÃO PARA EDIÇÃO */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Congregação Padrão *</label>
                {ehSede ? (
                  <select 
                    required 
                    value={congregacaoForm} 
                    onChange={(e) => setCongregacaoForm(e.target.value)} 
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer font-semibold"
                  >
                    <option value="" disabled>Selecione a Congregação</option>
                    {/* Preserva a congregação antiga do item se ela tiver sido excluída das configurações gerais */}
                    {congregacaoForm && !congregacoesDisponiveis.includes(congregacaoForm) && (
                      <option value={congregacaoForm}>{congregacaoForm}</option>
                    )}
                    {congregacoesDisponiveis.map((nome, idx) => (
                      <option key={idx} value={nome}>{nome === nomeSedeOficial ? `🏢 ${nome}` : `📍 ${nome}`}</option>
                    ))}
                  </select>
                ) : (
                  <select disabled className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-gray-100 dark:bg-gray-700 text-gray-500 cursor-not-allowed font-semibold">
                    <option value={congregacaoForm || congregacaoUsuario}>📍 {congregacaoForm || congregacaoUsuario}</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Item *</label>
                <input type="text" required value={itemNome} onChange={(e) => setItemNome(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Marca (Opcional)</label>
                  <input type="text" value={itemMarca} onChange={(e) => setItemMarca(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Modelo (Opcional)</label>
                  <input type="text" value={itemModelo} onChange={(e) => setItemModelo(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Entrada</label>
                  <input type="date" required value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor (R$)</label>
                  <input type="number" step="0.01" required value={valorEstimado} onChange={(e) => setValorEstimado(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                </div>
                <div className="sm:col-span-1 relative group">
                  <label className="block text-sm font-black text-indigo-700 dark:text-indigo-400 mb-1 cursor-help">Replicar? ⓘ</label>
                  <input type="number" min="1" required value={quantidade} onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)} className="w-full border border-indigo-300 dark:border-indigo-600 rounded-lg p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold" />
                  <div className="absolute z-10 bottom-full mb-2 hidden group-hover:block w-48 p-2 text-xs bg-gray-800 text-white rounded shadow-lg text-center">
                    Se for maior que 1, o sistema atualizará este item e criará cópias idênticas a ele.
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4">
                <button type="button" onClick={() => setModalEditarAberto(false)} className="px-5 py-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium rounded-lg transition-colors">Cancelar</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors">
                  {quantidade > 1 ? `Salvar e Gerar Cópias` : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MOVIMENTAÇÃO E HISTÓRICO */}
      {modalMovimentoAberto && itemSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-xl p-6 my-8">
            <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-white">Nova Movimentação</h2>
            <p className="text-sm text-gray-500 mb-6">Item atual: <span className="font-bold text-gray-700 dark:text-gray-300">{itemSelecionado.item} ({itemSelecionado.status || "Disponível"})</span></p>
            
            <form onSubmit={handleMovimentar} className="space-y-5 border-b border-gray-200 dark:border-gray-700 pb-8 mb-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de Movimentação</label>
                <select required value={tipoMovimentacao} onChange={(e) => setTipoMovimentacao(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                  <option value="Disponível">Disponível (Devolver ao Estoque)</option>
                  <option value="Manutenção">Manutenção</option>
                  <option value="Emprestado">Emprestar</option>
                  <option value="Doação">Doação</option>
                  <option value="Venda">Venda</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição / Motivo</label>
                <textarea required rows={3} value={descricaoMovimentacao} onChange={(e) => setDescricaoMovimentacao(e.target.value)} placeholder="Especifique os detalhes desta ação..." className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalMovimentoAberto(false)} className="px-5 py-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium rounded-lg transition-colors">Cancelar</button>
                <button type="submit" className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-sm transition-colors">Registrar</button>
              </div>
            </form>

            {/* HISTÓRICO INTEGRADO */}
            <div>
              <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Histórico de Movimentações
              </h3>
              <div className="max-h-56 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                {carregandoHistorico ? (
                  <p className="text-sm text-gray-400 text-center py-6">Buscando histórico...</p>
                ) : historicoItem.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Nenhuma movimentação registrada para este item.</p>
                ) : (
                  historicoItem.map((h) => (
                    <div key={h.id} className="p-4 bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 rounded-xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          <span className="text-gray-500 font-medium">{h.status_anterior || "Disponível"}</span> 
                          <span className="text-gray-300">→</span> 
                          <span className={getStatusColor(h.status_novo)}>{h.status_novo}</span>
                        </span>
                        <span className="text-gray-400 font-medium text-[11px]">{formatarData(h.data_movimentacao, true)}</span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 text-sm italic break-words">{h.descricao}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}