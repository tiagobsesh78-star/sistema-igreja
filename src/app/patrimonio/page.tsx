"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";

export default function PatrimonioPage() {
  const [patrimonios, setPatrimonios] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);

  // Estados de Ordenação
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  // Estados dos Modais
  const [modalCadastroAberto, setModalCadastroAberto] = useState(false);
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [modalMovimentoAberto, setModalMovimentoAberto] = useState(false);

  // Campos de Cadastro / Edição
  const [itemSelecionado, setItemSelecionado] = useState<any>(null);
  const [itemNome, setItemNome] = useState("");
  const [dataEntrada, setDataEntrada] = useState("");
  const [valorEstimado, setValorEstimado] = useState("");

  // Campos de Movimentação e Histórico
  const [tipoMovimentacao, setTipoMovimentacao] = useState("");
  const [descricaoMovimentacao, setDescricaoMovimentacao] = useState("");
  const [historicoItem, setHistoricoItem] = useState<any[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  useEffect(() => {
    const carregarIgreja = () => {
      try {
        const userLocal = localStorage.getItem("usuarioLogado");
        if (userLocal) {
          const parsedUser = JSON.parse(userLocal);
          const currentIgrejaId = parsedUser.igreja_id || parsedUser.id_igreja || parsedUser.idIgreja || parsedUser.igreja;
          setIgrejaId(currentIgrejaId ? String(currentIgrejaId) : null);
          if (currentIgrejaId) buscarPatrimonios(String(currentIgrejaId));
        } else {
          setCarregando(false);
        }
      } catch (e) {
        setCarregando(false);
      }
    };
    carregarIgreja();
  }, []);

  const buscarPatrimonios = async (idIgreja: string) => {
    setCarregando(true);
    const { data, error } = await supabase
      .from("patrimonio")
      .select("*")
      .eq("igreja_id", idIgreja)
      .order("id", { ascending: false });

    if (!error) setPatrimonios(data || []);
    setCarregando(false);
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

  // --- LÓGICA DE EXPORTAÇÃO EXCEL (CSV PT-BR) ---
  const handleExportarExcel = () => {
    if (patrimonios.length === 0) {
      alert("Não há dados cadastrados para exportar.");
      return;
    }

    // \uFEFF força o Excel a abrir o arquivo interpretando caracteres e acentos em UTF-8 corretamente
    let conteudoCSV = "\uFEFF";
    conteudoCSV += "ID;Item;Data de Entrada;Valor (R$);Status\n";

    patrimoniosOrdenados.forEach((item) => {
      const idFmt = `#${item.id}`;
      const itemFmt = item.item.replace(/"/g, '""'); // Escapa aspas
      const dataFmt = formatarData(item.data_entrada);
      const valorFmt = (item.valor || 0).toFixed(2).replace(".", ",");
      const statusFmt = item.status || "Disponível";

      conteudoCSV += `${idFmt};"${itemFmt}";${dataFmt};${valorFmt};${statusFmt}\n`;
    });

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

    const valorTratado = parseFloat(valorEstimado.toString().replace(",", "."));
    const { error } = await supabase.from("patrimonio").insert([
      {
        igreja_id: igrejaId,
        item: itemNome,
        data_entrada: dataEntrada,
        valor: isNaN(valorTratado) ? 0 : valorTratado,
        status: "Disponível"
      },
    ]);

    if (!error) {
      setModalCadastroAberto(false);
      limparCampos();
      buscarPatrimonios(igrejaId);
    } else {
      alert("Erro ao cadastrar: " + error.message);
    }
  };

  const abrirEditar = (item: any) => {
    setItemSelecionado(item);
    setItemNome(item.item);
    setDataEntrada(item.data_entrada);
    setValorEstimado(item.valor.toString());
    setModalEditarAberto(true);
  };

  const handleEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemSelecionado || !igrejaId) return;

    const valorTratado = parseFloat(valorEstimado.toString().replace(",", "."));
    const { error } = await supabase
      .from("patrimonio")
      .update({
        item: itemNome,
        data_entrada: dataEntrada,
        valor: isNaN(valorTratado) ? 0 : valorTratado,
      })
      .eq("id", itemSelecionado.id);

    if (!error) {
      setModalEditarAberto(false);
      limparCampos();
      buscarPatrimonios(igrejaId);
    } else {
      alert("Erro ao editar: " + error.message);
    }
  };

  const handleExcluir = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir permanentemente este item do patrimônio?")) return;
    const { error } = await supabase.from("patrimonio").delete().eq("id", id);
    if (!error && igrejaId) buscarPatrimonios(igrejaId);
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
      .eq("id", itemSelecionado.id);

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
      buscarPatrimonios(igrejaId);
    } else {
      alert("Erro ao movimentar: " + erroPrincipal.message);
    }
  };

  const limparCampos = () => {
    setItemSelecionado(null);
    setItemNome("");
    setDataEntrada("");
    setValorEstimado("");
    setTipoMovimentacao("");
    setDescricaoMovimentacao("");
    setHistoricoItem([]);
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

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">Patrimônio</h1>
          <p className="text-gray-600 dark:text-gray-400">Gerencie, movimente e exporte os ativos da igreja</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button
            onClick={handleExportarExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar Excel
          </button>
          <button
            onClick={() => { limparCampos(); setModalCadastroAberto(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors w-full sm:w-auto shadow-md"
          >
            + Cadastrar Item
          </button>
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
              <th className="p-4 font-bold text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500 font-medium">Carregando ativos...</td></tr>
            ) : patrimoniosOrdenados.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500 font-medium">Nenhum patrimônio registrado.</td></tr>
            ) : (
              patrimoniosOrdenados.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                  <td className="p-4 text-gray-600 dark:text-gray-300 font-medium">#{item.id}</td>
                  <td className="p-4 text-gray-800 dark:text-gray-100 font-semibold">{item.item}</td>
                  <td className="p-4 text-gray-600 dark:text-gray-300">{formatarData(item.data_entrada)}</td>
                  <td className="p-4 text-gray-600 dark:text-gray-300 font-medium">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.valor || 0)}
                  </td>
                  <td className={`p-4 ${getStatusColor(item.status)}`}>
                    <span className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-sm">
                      {item.status || "Disponível"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center items-center gap-2">
                      <button
                        onClick={() => abrirModalMovimentacao(item)}
                        className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus:ring-2 focus:ring-blue-300 outline-none"
                      >
                        Movimentar
                      </button>
                      <button
                        onClick={() => abrirEditar(item)}
                        className="bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus:ring-2 focus:ring-gray-300 outline-none"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleExcluir(item.id)}
                        className="bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus:ring-2 focus:ring-red-300 outline-none"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: CADASTRO */}
      {modalCadastroAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Cadastrar Novo Item</h2>
            <form onSubmit={handleCadastrar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID</label>
                <input type="text" disabled value="Gerado automaticamente" className="w-full border dark:border-gray-600 rounded-lg p-3 bg-gray-100 dark:bg-gray-700 text-gray-500 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Item</label>
                <input type="text" required value={itemNome} onChange={(e) => setItemNome(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="Ex: Mesa de Som, Projetor..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data de Entrada</label>
                <input type="date" required value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Estimado (R$)</label>
                <input type="number" step="0.01" required value={valorEstimado} onChange={(e) => setValorEstimado(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="0.00" />
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setModalCadastroAberto(false)} className="px-5 py-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium rounded-lg transition-colors">Cancelar</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors">Criar Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR */}
      {modalEditarAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Editar Item</h2>
            <form onSubmit={handleEditar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Item</label>
                <input type="text" required value={itemNome} onChange={(e) => setItemNome(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data de Entrada</label>
                <input type="date" required value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Estimado (R$)</label>
                <input type="number" step="0.01" required value={valorEstimado} onChange={(e) => setValorEstimado(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setModalEditarAberto(false)} className="px-5 py-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium rounded-lg transition-colors">Cancelar</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors">Salvar Alterações</button>
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