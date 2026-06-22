"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { podeEditar, formatarPerfis } from "../../lib/permissoes";

interface Programacao {
  id?: number;
  igreja_id: string;
  titulo: string;
  descricao: string;
  tipo: "Fixa" | "Evento" | "Reunião";
  data: string | null;
  dia_semana: string | null;
  horario: string;
  reuniao_id?: string | null;
}

// Função auxiliar que identifica links no texto e os torna clicáveis
const renderComLinks = (texto: string) => {
  if (!texto) return null;
  
  // Regex para encontrar URLs (http, https ou www)
  const urlRegex = /((?:https?:\/\/|www\.)[^\s]+)/g;
  const partes = texto.split(urlRegex);

  return partes.map((parte, index) => {
    if (parte.match(urlRegex)) {
      // Se começar só com www, adiciona o https:// para o navegador entender
      const href = parte.startsWith("www.") ? `https://${parte}` : parte;
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-700 underline hover:no-underline transition-colors break-all"
          onClick={(e) => e.stopPropagation()} // Evita que o clique acione outras ações da linha
        >
          {parte}
        </a>
      );
    }
    return <span key={index}>{parte}</span>;
  });
};

export default function ProgramacaoPage() {
  const [programacoes, setProgramacoes] = useState<Programacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [perfisUsuario, setPerfisUsuario] = useState<string[]>([]);

  const dataAtual = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(dataAtual.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(dataAtual.getFullYear());

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoItem, setEditandoItem] = useState<Programacao | null>(null);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<"Fixa" | "Evento">("Fixa");
  const [data, setData] = useState("");
  const [diaSemana, setDiaSemana] = useState("Domingo");
  const [horario, setHorario] = useState("");

  const meses = [
    { valor: 1, nome: "Janeiro" }, { valor: 2, nome: "Fevereiro" },
    { valor: 3, nome: "Março" }, { valor: 4, nome: "Abril" },
    { valor: 5, nome: "Maio" }, { valor: 6, nome: "Junho" },
    { valor: 7, nome: "Julho" }, { valor: 8, nome: "Agosto" },
    { valor: 9, nome: "Setembro" }, { valor: 10, nome: "Outubro" },
    { valor: 11, nome: "Novembro" }, { valor: 12, nome: "Dezembro" },
  ];

  const diasDaSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

  useEffect(() => {
    const userLocal = localStorage.getItem("usuarioLogado");
    if (userLocal) {
      try {
        const parsedUser = JSON.parse(userLocal);
        setPerfisUsuario(formatarPerfis(parsedUser.perfis || parsedUser.nivel_acesso));
        setIgrejaId(parsedUser.igreja_id || parsedUser.id_igreja || parsedUser.idIgreja);
      } catch (e) {
        console.error("Erro ao ler usuário");
      }
    } else {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (igrejaId) carregarProgramacoes();
  }, [igrejaId]);

  async function carregarProgramacoes() {
    if (!igrejaId) return;
    setCarregando(true);
    try {
      const { data: result, error } = await supabase
        .from("programacao")
        .select("*")
        .eq("igreja_id", igrejaId)
        .order("horario", { ascending: true });

      if (error) throw error;
      setProgramacoes(result || []);
    } catch (err) {
      console.error("Erro ao carregar programações:", err);
      alert("Não foi possível carregar a lista de programações.");
    } finally {
      setCarregando(false);
    }
  }

  function abrirModal(item: Programacao | null = null) {
    if (item) {
      setEditandoItem(item);
      setTitulo(item.titulo);
      setDescricao(item.descricao || "");
      setTipo(item.tipo === "Reunião" ? "Evento" : item.tipo); 
      setData(item.data || "");
      setDiaSemana(item.dia_semana || "Domingo");
      setHorario(item.horario ? item.horario.substring(0, 5) : "");
    } else {
      setEditandoItem(null);
      setTitulo("");
      setDescricao("");
      setTipo("Fixa");
      setData("");
      setDiaSemana("Domingo");
      setHorario("");
    }
    setModalAberto(true);
  }

  async function salvarProgramacao(e: React.FormEvent) {
    e.preventDefault();
    if (!igrejaId) return;

    const payload = {
      igreja_id: igrejaId,
      titulo,
      descricao,
      tipo,
      horario,
      data: tipo === "Evento" ? data : null,
      dia_semana: tipo === "Fixa" ? diaSemana : null,
    };

    try {
      if (editandoItem?.id) {
        const { error } = await supabase.from("programacao").update(payload).eq("id", editandoItem.id).eq("igreja_id", igrejaId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("programacao").insert([payload]);
        if (error) throw error;
      }
      setModalAberto(false);
      carregarProgramacoes();
    } catch (err) {
      console.error("Erro ao salvar programação:", err);
      alert("Ocorreu um erro ao processar sua solicitação.");
    }
  }

  async function excluirProgramacao(id: number) {
    if (!confirm("Tem certeza que deseja remover esta programação?")) return;
    try {
      const { error } = await supabase.from("programacao").delete().eq("id", id).eq("igreja_id", igrejaId);
      if (error) throw error;
      carregarProgramacoes();
    } catch (err) {
      console.error("Erro ao excluir:", err);
      alert("Erro ao remover a programação.");
    }
  }

  const programacoesFixas = programacoes.filter((p) => p.tipo === "Fixa");
  const programacoesDoMes = programacoes.filter((p) => {
    if (p.tipo === "Fixa") return false;
    if (!p.data) return false;
    const dataItem = new Date(p.data + "T00:00:00");
    return dataItem.getMonth() + 1 === mesSelecionado && dataItem.getFullYear() === anoSelecionado;
  }).sort((a, b) => new Date(a.data + "T00:00:00").getTime() - new Date(b.data + "T00:00:00").getTime());

  const ehEditor = podeEditar(perfisUsuario, 'programacao');

  if (carregando && !modalAberto) {
    return <div className="p-6 flex justify-center items-center h-screen text-indigo-600 font-medium animate-pulse">Carregando quadro de programações...</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8 animate-fade-in pb-12">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight">Quadro de Programação</h1>
            <p className="text-sm text-gray-500 mt-0.5">Gerencie as atividades fixas e os eventos periódicos.</p>
          </div>
        </div>
        
        {ehEditor && (
          <button
            onClick={() => abrirModal()}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-lg transition-all shadow-md hover:shadow-lg focus:ring-4 focus:ring-indigo-100 outline-none"
          >
            + Adicionar Programação
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        
        {/* COLUNA 1: FIXAS */}
        <div className="lg:col-span-1 bg-white border border-indigo-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="bg-indigo-600 p-4 border-b border-indigo-700">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Rotina Semanal Fixa
            </h2>
          </div>
          
          <div className="p-4 bg-indigo-50/30 flex-1">
            {programacoesFixas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-indigo-300">
                <span className="text-sm font-medium">Nenhuma rotina configurada.</span>
              </div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {programacoesFixas.map((p) => (
                  <div key={p.id} className="p-4 bg-white border border-indigo-100 rounded-xl flex justify-between items-start group shadow-sm hover:shadow-md hover:border-indigo-300 transition-all">
                    <div className="space-y-1.5 w-full">
                      <span className="inline-block text-xs font-black text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-md uppercase tracking-wide">
                        {p.dia_semana || '---'} • {p.horario ? p.horario.substring(0, 5) : '--:--'}
                      </span>
                      <h3 className="font-bold text-gray-800 text-base">{p.titulo}</h3>
                      {p.descricao && <p className="text-xs text-gray-500 line-clamp-2">{renderComLinks(p.descricao)}</p>}
                    </div>
                    
                    {ehEditor && (
                      <div className="flex flex-col gap-2 ml-3">
                        <button onClick={() => abrirModal(p)} className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => p.id && excluirProgramacao(p.id)} className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* COLUNA 2 E 3: EVENTOS DO MÊS */}
        <div className="lg:col-span-2 bg-white border border-teal-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="bg-teal-600 p-4 border-b border-teal-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Agenda do Mês
            </h2>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={mesSelecionado}
                onChange={(e) => setMesSelecionado(Number(e.target.value))}
                className="w-full sm:w-auto bg-teal-700 text-white border-none rounded-lg p-2 text-sm font-bold focus:ring-2 focus:ring-white outline-none cursor-pointer"
              >
                {meses.map((m) => <option key={m.valor} value={m.valor}>{m.nome}</option>)}
              </select>
              <select
                value={anoSelecionado}
                onChange={(e) => setAnoSelecionado(Number(e.target.value))}
                className="bg-teal-700 text-white border-none rounded-lg p-2 text-sm font-bold focus:ring-2 focus:ring-white outline-none cursor-pointer"
              >
                <option value={anoSelecionado - 1}>{anoSelecionado - 1}</option>
                <option value={anoSelecionado}>{anoSelecionado}</option>
                <option value={anoSelecionado + 1}>{anoSelecionado + 1}</option>
              </select>
            </div>
          </div>

          <div className="p-0 sm:p-4 bg-teal-50/20 flex-1">
            {programacoesDoMes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 text-teal-300">
                <span className="text-sm font-medium">Nenhum evento ou reunião neste mês.</span>
              </div>
            ) : (
              <div className="overflow-x-auto w-full bg-white rounded-xl border border-teal-50 shadow-sm">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-teal-50 text-teal-800 border-b border-teal-100">
                      <th className="p-4 font-black uppercase tracking-wider text-xs">Data / Hora</th>
                      <th className="p-4 font-black uppercase tracking-wider text-xs">Título e Descrição</th>
                      <th className="p-4 font-black uppercase tracking-wider text-xs">Tipo</th>
                      {ehEditor && (
                        <th className="p-4 font-black uppercase tracking-wider text-xs text-right">Ações</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-50">
                    {programacoesDoMes.map((p) => {
                      const dataFormatada = p.data ? new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR") : "";
                      return (
                        <tr key={p.id} className="hover:bg-teal-50/50 transition-colors">
                          <td className="p-4 whitespace-nowrap">
                            <div className="font-black text-gray-800 text-base">{dataFormatada}</div>
                            <div className="text-xs font-bold text-teal-600 bg-teal-50 inline-block px-2 py-0.5 rounded mt-1">
                              {p.horario ? p.horario.substring(0, 5) : '--:--'}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-gray-800 text-base">{p.titulo}</div>
                            {p.descricao && <div className="text-sm text-gray-500 line-clamp-2 mt-0.5">{renderComLinks(p.descricao)}</div>}
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className={`inline-block text-xs font-black px-3 py-1.5 rounded-md uppercase tracking-wide shadow-sm border ${
                                p.tipo === "Reunião" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"
                              }`}
                            >
                              {p.tipo}
                            </span>
                          </td>
                          
                          {ehEditor && (
                            <td className="p-4 text-right whitespace-nowrap">
                              <div className="flex justify-end gap-2">
                                {p.tipo !== "Reunião" && (
                                  <button onClick={() => abrirModal(p)} className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-bold text-xs transition-colors">
                                    Editar
                                  </button>
                                )}
                                <button onClick={() => p.id && excluirProgramacao(p.id)} className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg font-bold text-xs transition-colors">
                                  Remover
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL */}
      {modalAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border-t-8 border-indigo-600">
            
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-black text-gray-800">
                {editandoItem ? "Ajustar Programação" : "Nova Programação"}
              </h3>
              <button onClick={() => setModalAberto(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-red-100 hover:text-red-600 transition-colors font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={salvarProgramacao} className="p-6 space-y-5">
              
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Selecione o Tipo</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTipo("Fixa")}
                    disabled={editandoItem?.tipo === "Reunião"}
                    className={`p-3 text-sm font-black rounded-xl transition-all border-2 ${
                      tipo === "Fixa"
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md transform scale-[1.02]"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                    } disabled:opacity-50`}
                  >
                    🔄 Semanal Fixa
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipo("Evento")}
                    disabled={editandoItem?.tipo === "Reunião"}
                    className={`p-3 text-sm font-black rounded-xl transition-all border-2 ${
                      tipo === "Evento"
                        ? "bg-teal-600 border-teal-600 text-white shadow-md transform scale-[1.02]"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                    } disabled:opacity-50`}
                  >
                    📅 Evento Avulso
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">Título da Atividade</label>
                <input
                  type="text"
                  required
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex: Culto Jovem, Ensaio Coral..."
                  className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm text-gray-800 focus:border-indigo-500 focus:ring-0 outline-none bg-gray-50 focus:bg-white transition-colors font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {tipo === "Fixa" ? (
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">Dia da Semana</label>
                    <select
                      value={diaSemana}
                      onChange={(e) => setDiaSemana(e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm text-gray-800 focus:border-indigo-500 outline-none bg-gray-50 focus:bg-white font-semibold cursor-pointer"
                    >
                      {diasDaSemana.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">Data Exata</label>
                    <input
                      type="date"
                      required={tipo === "Evento"}
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm text-gray-800 focus:border-indigo-500 outline-none bg-gray-50 focus:bg-white font-semibold"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">Horário</label>
                  <input
                    type="time"
                    required
                    value={horario}
                    onChange={(e) => setHorario(e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm text-gray-800 focus:border-indigo-500 outline-none bg-gray-50 focus:bg-white font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1">Detalhes (Opcional)</label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Informações adicionais importantes..."
                  rows={2}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm text-gray-800 focus:border-indigo-500 outline-none bg-gray-50 focus:bg-white resize-none font-medium"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors shadow-md hover:shadow-lg"
                >
                  Gravar Programação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}