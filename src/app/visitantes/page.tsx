"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase"; 
import { formatarPerfis } from "../../lib/permissoes";

export default function Visitantes() {
  const [carregando, setCarregando] = useState(true);
  const [visitantes, setVisitantes] = useState<any[]>([]);
  const [igrejaIdLogada, setIgrejaIdLogada] = useState<string | null>(null);
  const [perfisUsuario, setPerfisUsuario] = useState<string[]>([]);

  // Estados do Modal Principal (Cadastro/Edição)
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);

  // Estados do Mini-Modal de Confirmação de Contato
  const [modalContatoAberto, setModalContatoAberto] = useState(false);
  const [visitanteContatoId, setVisitanteContatoId] = useState<number | null>(null);
  const [quemContatou, setQuemContatou] = useState("");

  // Estados do Modal de Confirmação Personalizado (Exclusões)
  const [modalConfirmacao, setModalConfirmacao] = useState<{
    aberto: boolean;
    titulo: string;
    mensagem: string;
    textoBotao: string;
    acao: () => void;
  }>({
    aberto: false,
    titulo: "",
    mensagem: "",
    textoBotao: "",
    acao: () => {},
  });

  // Campos do Formulário
  const [dataVisita, setDataVisita] = useState("");
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [isWhatsapp, setIsWhatsapp] = useState(false);
  const [descricao, setDescricao] = useState("");

  useEffect(() => {
    const userLocal = localStorage.getItem("usuarioLogado");
    if (userLocal) {
      const usuarioObj = JSON.parse(userLocal);
      const igrejaId = usuarioObj.igreja_id || usuarioObj.id_igreja || usuarioObj.idIgreja;
      
      const perfis = formatarPerfis(usuarioObj.perfis || usuarioObj.nivel_acesso);
      setPerfisUsuario(perfis);
      
      if (igrejaId) {
        setIgrejaIdLogada(igrejaId);
        carregarVisitantes(igrejaId);
      } else {
        setCarregando(false);
      }
    } else {
      setCarregando(false);
    }
  }, []);

  const carregarVisitantes = async (igrejaId: string) => {
    setCarregando(true);
    const { data, error } = await supabase
      .from("visitantes")
      .select("*")
      .eq("igreja_id", igrejaId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setVisitantes(data);
    }
    setCarregando(false);
  };

  const abrirModal = (visitante?: any) => {
    if (visitante) {
      setEditandoId(visitante.id);
      setDataVisita(visitante.data_visita);
      setNome(visitante.nome);
      setContato(visitante.contato || "");
      setIsWhatsapp(visitante.is_whatsapp);
      setDescricao(visitante.descricao || "");
    } else {
      setEditandoId(null);
      setDataVisita(new Date().toISOString().split("T")[0]);
      setNome("");
      setContato("");
      setIsWhatsapp(false);
      setDescricao("");
    }
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
  };

  const salvarVisitante = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaIdLogada) return;

    setSalvando(true);
    const dados = {
      igreja_id: igrejaIdLogada,
      data_visita: dataVisita,
      nome,
      contato,
      is_whatsapp: isWhatsapp,
      descricao,
    };

    if (editandoId) {
      const { error } = await supabase.from("visitantes").update(dados).eq("id", editandoId);
      if (!error) carregarVisitantes(igrejaIdLogada);
    } else {
      const { error } = await supabase.from("visitantes").insert([dados]);
      if (!error) carregarVisitantes(igrejaIdLogada);
    }

    setSalvando(false);
    fecharModal();
  };

  // LÓGICA DE EXCLUSÃO ÚNICA COM MODAL PERSONALIZADO
  const confirmarExclusaoVisitante = (id: number) => {
    setModalConfirmacao({
      aberto: true,
      titulo: "Excluir Visitante",
      mensagem: "Tem certeza que deseja excluir este visitante? Todos os dados dele serão perdidos.",
      textoBotao: "Excluir Visitante",
      acao: async () => {
        setModalConfirmacao(prev => ({ ...prev, aberto: false }));
        const { error } = await supabase.from("visitantes").delete().eq("id", id);
        if (!error && igrejaIdLogada) {
          carregarVisitantes(igrejaIdLogada);
        }
      }
    });
  };

  // LÓGICA DE EXCLUSÃO EM MASSA COM MODAL PERSONALIZADO
  const confirmarExclusaoMassa = () => {
    if (!igrejaIdLogada) return;

    setModalConfirmacao({
      aberto: true,
      titulo: "Excluir Toda a Lista?",
      mensagem: "CUIDADO: Você está prestes a excluir permanentemente TODOS os visitantes cadastrados. Esta ação é irreversível.",
      textoBotao: "Sim, Excluir Tudo",
      acao: async () => {
        setModalConfirmacao(prev => ({ ...prev, aberto: false }));
        setCarregando(true);
        const { error } = await supabase.from("visitantes").delete().eq("igreja_id", igrejaIdLogada);
        if (!error) {
          carregarVisitantes(igrejaIdLogada);
        }
        setCarregando(false);
      }
    });
  };

  // Lógica do botão de contato
  const handleToggleClick = (v: any) => {
    if (v.contatado) {
      atualizarStatusContato(v.id, false, null);
    } else {
      setVisitanteContatoId(v.id);
      setQuemContatou(""); 
      setModalContatoAberto(true);
    }
  };

  const confirmarContato = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitanteContatoId || !quemContatou.trim()) return;
    
    atualizarStatusContato(visitanteContatoId, true, quemContatou.trim());
    setModalContatoAberto(false);
  };

  const atualizarStatusContato = async (id: number, status: boolean, quem: string | null) => {
    setVisitantes(visitantes.map(v => v.id === id ? { ...v, contatado: status, quem_contatou: quem } : v));
    const { error } = await supabase.from("visitantes").update({ contatado: status, quem_contatou: quem }).eq("id", id);
    if (error && igrejaIdLogada) {
      carregarVisitantes(igrejaIdLogada);
    }
  };

  const podeExcluirListaCompleta = perfisUsuario.includes("Secretário") || perfisUsuario.includes("Pastor/Presbítero");

  if (carregando) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">Visitantes</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie e acompanhe os visitantes da igreja</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {podeExcluirListaCompleta && visitantes.length > 0 && (
            <button
              onClick={confirmarExclusaoMassa}
              className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-lg font-medium transition-all active:scale-95 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              <span>Excluir Toda a Lista</span>
            </button>
          )}

          <button
            onClick={() => abrirModal()}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-md active:scale-95 text-sm ml-auto md:ml-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
            <span>Novo Visitante</span>
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300 border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4 font-semibold">Data</th>
                <th className="px-6 py-4 font-semibold">Visitante</th>
                <th className="px-6 py-4 font-semibold">Contato</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {visitantes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Nenhum visitante cadastrado ainda.
                  </td>
                </tr>
              ) : (
                visitantes.map((v) => (
                  <tr 
                    key={v.id} 
                    className={`transition-colors ${
                      v.contatado 
                        ? "bg-teal-50/50 dark:bg-teal-900/10 hover:bg-teal-50 dark:hover:bg-teal-900/20" 
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(v.data_visita + "T00:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 dark:text-white">{v.nome}</div>
                      {v.descricao && (
                        <div className="text-xs text-gray-500 mt-1 max-w-[200px] truncate" title={v.descricao}>
                          {v.descricao}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {v.contato ? (
                        <div className="flex items-center gap-2">
                          {v.is_whatsapp ? (
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                          ) : (
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                          )}
                          <span>{v.contato}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Não informado</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1.5">
                        <button
                          onClick={() => handleToggleClick(v)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            v.contatado 
                              ? "bg-teal-100 text-teal-700 border border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800" 
                              : "bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {v.contatado ? (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                          )}
                          {v.contatado ? "Contatado" : "Pendente"}
                        </button>

                        {v.contatado && v.quem_contatou && (
                          <span className="text-[10px] font-bold tracking-wide text-teal-600 dark:text-teal-400 bg-white/60 dark:bg-gray-800 px-2 py-0.5 rounded border border-teal-100 dark:border-teal-900/50 shadow-sm flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                            Por: {v.quem_contatou}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => abrirModal(v)}
                          className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          title="Editar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button
                          onClick={() => confirmarExclusaoVisitante(v.id)}
                          className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Excluir"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NOVO MODAL DE CONFIRMAÇÃO PERSONALIZADO (Substitui o window.confirm nativo) */}
      {modalConfirmacao.aberto && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{modalConfirmacao.titulo}</h3>
              <p className="text-sm text-gray-500">{modalConfirmacao.mensagem}</p>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setModalConfirmacao({ ...modalConfirmacao, aberto: false })}
                className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={modalConfirmacao.acao}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                {modalConfirmacao.textoBotao}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mini-Modal de Confirmação de Contato */}
      {modalContatoAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 p-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Quem realizou o contato?</h3>
            <p className="text-sm text-gray-500 mb-4">Informe o nome de quem falou com este visitante para manter o histórico organizado.</p>
            
            <form onSubmit={confirmarContato}>
              <input
                type="text"
                autoFocus
                required
                placeholder="Ex: Pr. João, Liderança..."
                value={quemContatou}
                onChange={(e) => setQuemContatou(e.target.value)}
                className="w-full px-4 py-2 mb-6 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none dark:text-white"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalContatoAberto(false)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors"
                >
                  Confirmar Contato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Cadastro / Edição Principal */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                {editandoId ? "Editar Visitante" : "Cadastrar Visitante"}
              </h2>
            </div>
            
            <form onSubmit={salvarVisitante} className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Data da Visita *
                    </label>
                    <input
                      type="date"
                      required
                      value={dataVisita}
                      onChange={(e) => setDataVisita(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nome do Visitante *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: João da Silva"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Contato (Telefone)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="text"
                      placeholder="Ex: (00) 90000-0000"
                      value={contato}
                      onChange={(e) => setContato(e.target.value)}
                      className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none dark:text-white"
                    />
                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600">
                      <input
                        type="checkbox"
                        checked={isWhatsapp}
                        onChange={(e) => setIsWhatsapp(e.target.checked)}
                        className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                        WhatsApp
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Descrição / Observações
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Veio convite de quem? Precisa de aconselhamento?"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none dark:text-white resize-none"
                  ></textarea>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={fecharModal}
                  className="px-5 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {salvando ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Salvando...
                    </>
                  ) : (
                    "Salvar"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}