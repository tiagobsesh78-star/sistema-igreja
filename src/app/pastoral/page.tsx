"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase"; 
import { ptBR } from "date-fns/locale";
import { 
  format, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  startOfWeek, 
  endOfWeek, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  getMonth
} from "date-fns";

// ==========================================
// FUNÇÕES UTILITÁRIAS
// ==========================================
const renderizarTextoComLinks = (texto: string) => {
  if (!texto) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return texto.split(urlRegex).map((parte, idx) => {
    if (parte.match(urlRegex)) {
      return (
        <a key={idx} href={parte} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 transition-colors">
          {parte}
        </a>
      );
    }
    return <span key={idx}>{parte}</span>;
  });
};

const compactarParaBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const maxSize = 500 * 1024; // 500 KB
    
    // Se for imagem, tenta compactar
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const MAX_WIDTH = 1000;
          const MAX_HEIGHT = 1000;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }
          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Exporta com qualidade 0.7 para reduzir tamanho
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          resolve(dataUrl);
        };
      };
      reader.onerror = error => reject(error);
    } else {
      // Se for PDF ou outro documento, apenas converte (limite checado antes)
      if (file.size > maxSize) {
        reject(new Error("Arquivo maior que 500KB."));
        return;
      }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    }
  });
};

export default function Pastoral() {
  const router = useRouter();

  // Estados Gerais
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState("agenda");
  const [usuarioAtual, setUsuarioAtual] = useState<any>(null);
  const [mesAtualCalendario, setMesAtualCalendario] = useState(new Date());

  // Dados
  const [membros, setMembros] = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [anotacoes, setAnotacoes] = useState<any[]>([]);
  
  // Opções de Filtro (Extraídas da base de dados)
  const [opcoesCongregacao, setOpcoesCongregacao] = useState<string[]>([]);
  const [opcoesCargo, setOpcoesCargo] = useState<string[]>([]);

  // Filtros Globais (Aplicados em todas as abas)
  const [filtros, setFiltros] = useState({
    mes: "Todos",
    congregacao: "Todas",
    cargo: "Todos",
    publico: "Todos" // "Todos", "Membros", "Outros"
  });

  // Estados de Modais
  const [modalAgendaAberto, setModalAgendaAberto] = useState(false);
  const [modalGabineteAberto, setModalGabineteAberto] = useState(false);
  const [modalVisitaAberto, setModalVisitaAberto] = useState(false);
  const [modalAnotacaoAberto, setModalAnotacaoAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const formZerado = { id: "", tipo: "Gabinete", membro_id: "", nome_nao_membro: "", data_hora: "", local: "", assunto: "", descricao: "", status: "Agendado", anexo_url: "" };
  const [formRegistro, setFormRegistro] = useState(formZerado);
  const [formAnotacao, setFormAnotacao] = useState({ id: "", titulo: "", texto: "" });
  const [anexoNome, setAnexoNome] = useState("");

  // Pesquisa local dentro do select de membro
  const [buscaMembroModal, setBuscaMembroModal] = useState("");

  useEffect(() => {
    const userLocal = localStorage.getItem("usuarioLogado");
    if (!userLocal) { router.push("/login"); return; }

    const usuario = JSON.parse(userLocal);
    const perfisStr = Array.isArray(usuario.perfis) ? usuario.perfis.join(", ") : (usuario.perfis || usuario.nivel_acesso || "");
    
    if (!perfisStr.includes("Pastor") && !perfisStr.includes("Presbítero") && !perfisStr.includes("Administrador")) {
      router.push("/");
      return;
    }

    setUsuarioAtual(usuario);
    carregarDados(usuario);
  }, [router]);

  async function carregarDados(usuario: any) {
    setCarregando(true);
    const igrejaId = usuario.igreja_id || usuario.id_igreja;
    const pastorId = usuario.id;

    try {
      const { data: dadosMembros } = await supabase
        .from("membros")
        .select("id, nome_completo, congregacao, cargo")
        .eq("igreja_id", igrejaId)
        .order("nome_completo", { ascending: true });

      if (dadosMembros) {
        setMembros(dadosMembros);
        setOpcoesCongregacao(Array.from(new Set(dadosMembros.map(m => m.congregacao || "Sede"))));
        setOpcoesCargo(Array.from(new Set(dadosMembros.map(m => m.cargo || "Membro"))));
      }

      const { data: dadosRegistros } = await supabase
        .from("pastoral_registros")
        .select("*")
        .eq("igreja_id", igrejaId)
        .eq("pastor_id", pastorId)
        .order("data_hora", { ascending: false });

      if (dadosRegistros) setRegistros(dadosRegistros);

      const { data: dadosAnotacoes } = await supabase
        .from("pastoral_anotacoes")
        .select("*")
        .eq("igreja_id", igrejaId)
        .eq("pastor_id", pastorId)
        .order("created_at", { ascending: false });

      if (dadosAnotacoes) setAnotacoes(dadosAnotacoes);

    } catch (error) { console.error(error); } 
    finally { setCarregando(false); }
  }

  // ==========================================
  // FILTRAGEM GLOBAL (COMPUTADA)
  // ==========================================
  const registrosFiltrados = useMemo(() => {
    return registros.filter(reg => {
      const membro = membros.find(m => m.id === reg.membro_id);
      
      // Filtro Mês
      if (filtros.mes !== "Todos") {
        const mesReg = getMonth(parseISO(reg.data_hora)).toString();
        if (mesReg !== filtros.mes) return false;
      }

      // Filtro Público
      if (filtros.publico === "Membros" && !membro) return false;
      if (filtros.publico === "Outros" && membro) return false;

      // Filtros Específicos de Membro (Congregação e Cargo)
      if (membro) {
        const congNormalizada = membro.congregacao || "Sede";
        const cargoNormalizado = membro.cargo || "Membro";
        if (filtros.congregacao !== "Todas" && congNormalizada !== filtros.congregacao) return false;
        if (filtros.cargo !== "Todos" && cargoNormalizado !== filtros.cargo) return false;
      } else {
        // Se for "Outro" (visitante), e houver filtro de congregacao/cargo estrito, ocultamos (pois visitante não tem cargo)
        if (filtros.congregacao !== "Todas" || filtros.cargo !== "Todos") return false;
      }

      return true;
    });
  }, [registros, membros, filtros]);


  // ==========================================
  // AÇÕES E MODAIS
  // ==========================================
  const abrirAgendamento = () => {
    setFormRegistro({...formZerado, tipo: "Gabinete"});
    setBuscaMembroModal("");
    setAnexoNome("");
    setModalAgendaAberto(true);
  };

  const clicarNoCompromisso = (registro: any) => {
    setFormRegistro(registro);
    setAnexoNome("");
    if (registro.tipo === "Gabinete") {
      setAbaAtiva("atendimentos");
      setModalGabineteAberto(true);
    } else if (registro.tipo === "Visita") {
      setAbaAtiva("visitas");
      setModalVisitaAberto(true);
    } else {
      // Abre no próprio modal de agenda caso seja "Outro"
      setAbaAtiva("agenda");
      setModalAgendaAberto(true);
    }
  };

  const handleUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert("⚠️ O arquivo é muito grande! Por favor, escolha um anexo de no máximo 500KB.");
      return;
    }
    setAnexoNome("Compactando e anexando...");
    try {
      const base64Url = await compactarParaBase64(file);
      setFormRegistro({ ...formRegistro, anexo_url: base64Url });
      setAnexoNome(file.name + " (Anexado com sucesso ✓)");
    } catch (err) {
      alert("Erro ao anexar documento.");
      setAnexoNome("");
    }
  };

  const salvarRegistro = async () => {
    if (!formRegistro.data_hora || !formRegistro.tipo) return;
    setSalvando(true);
    const payload = {
      igreja_id: usuarioAtual.igreja_id || usuarioAtual.id_igreja,
      pastor_id: usuarioAtual.id,
      tipo: formRegistro.tipo,
      membro_id: formRegistro.membro_id === "outros" ? null : formRegistro.membro_id,
      nome_nao_membro: formRegistro.membro_id === "outros" ? formRegistro.nome_nao_membro : null,
      data_hora: formRegistro.data_hora,
      local: formRegistro.local,
      assunto: formRegistro.assunto,
      descricao: formRegistro.descricao,
      status: formRegistro.status,
      anexo_url: formRegistro.anexo_url,
    };

    if (formRegistro.id) await supabase.from("pastoral_registros").update(payload).eq("id", formRegistro.id);
    else await supabase.from("pastoral_registros").insert([payload]);

    setModalAgendaAberto(false);
    setModalGabineteAberto(false);
    setModalVisitaAberto(false);
    carregarDados(usuarioAtual);
    setSalvando(false);
  };

  const salvarAnotacao = async () => {
    if (!formAnotacao.titulo) return;
    setSalvando(true);
    const payload = {
      igreja_id: usuarioAtual.igreja_id || usuarioAtual.id_igreja,
      pastor_id: usuarioAtual.id,
      titulo: formAnotacao.titulo,
      texto: formAnotacao.texto,
    };
    if (formAnotacao.id) await supabase.from("pastoral_anotacoes").update(payload).eq("id", formAnotacao.id);
    else await supabase.from("pastoral_anotacoes").insert([payload]);
    setModalAnotacaoAberto(false);
    carregarDados(usuarioAtual);
    setSalvando(false);
  };

  const excluirRegistro = async (id: string, tabela: string) => {
    if (confirm("Tem certeza que deseja excluir permanentemente?")) {
      await supabase.from(tabela).delete().eq("id", id);
      carregarDados(usuarioAtual);
    }
  };

  const exportarCSV = () => {
    let csv = "Data;Tipo;Pessoa;Local;Assunto;Status;Observacoes\n";
    registrosFiltrados.forEach(r => {
      const nome = r.membro_id ? membros.find(m => m.id === r.membro_id)?.nome_completo : r.nome_nao_membro;
      const dataFormatada = format(parseISO(r.data_hora), "dd/MM/yyyy HH:mm");
      const desc = r.descricao ? r.descricao.replace(/\n/g, " ") : "";
      csv += `${dataFormatada};${r.tipo};${nome || ""};${r.local || ""};${r.assunto || ""};${r.status};${desc}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_Pastoral_${new Date().getTime()}.csv`;
    link.click();
  };

  const obterConfiguracaoAba = (aba: string) => {
    switch(aba) {
      case "agenda": return { cor: "indigo", bgBtn: "bg-indigo-600 hover:bg-indigo-700 text-white" };
      case "atendimentos": return { cor: "emerald", bgBtn: "bg-emerald-600 hover:bg-emerald-700 text-white" };
      case "visitas": return { cor: "sky", bgBtn: "bg-sky-600 hover:bg-sky-700 text-white" };
      case "acompanhados": return { cor: "purple", bgBtn: "bg-purple-600 hover:bg-purple-700 text-white" };
      case "anotacoes": return { cor: "amber", bgBtn: "bg-amber-600 hover:bg-amber-700 text-white" };
      default: return { cor: "blue", bgBtn: "bg-blue-600 hover:bg-blue-700 text-white" };
    }
  };

  const temaAba = obterConfiguracaoAba(abaAtiva);
  const membrosFiltradosBusca = membros.filter(m => m.nome_completo?.toLowerCase().includes(buscaMembroModal.toLowerCase()));

  // ==========================================
  // RENDERIZAÇÃO DAS ABAS
  // ==========================================
  const renderAbaConteudo = () => {

    if (abaAtiva === "agenda") {
      const inicioMes = startOfMonth(mesAtualCalendario);
      const fimMes = endOfMonth(mesAtualCalendario);
      const inicioSemana = startOfWeek(inicioMes, { weekStartsOn: 0 });
      const fimSemana = endOfWeek(fimMes, { weekStartsOn: 0 });
      const diasCalendario = eachDayOfInterval({ start: inicioSemana, end: fimSemana });

      return (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div>
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">📅 Central de Marcações</h2>
              <p className="text-xs text-gray-400 mt-0.5">Clique em '+ Agendar' para criar um evento. Clique em um agendamento para iniciar o prontuário.</p>
            </div>
            <button onClick={abrirAgendamento} className={`${temaAba.bgBtn} px-6 py-3 rounded-xl text-sm font-bold shadow-sm transition-all transform hover:scale-105`}>
              + Agendar Horário
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CALENDÁRIO */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-gray-800 capitalize">{format(mesAtualCalendario, "MMMM 'de' yyyy", { locale: ptBR })}</h3>
                <div className="flex gap-2">
                  <button onClick={() => setMesAtualCalendario(subMonths(mesAtualCalendario, 1))} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 font-bold">‹</button>
                  <button onClick={() => setMesAtualCalendario(addMonths(mesAtualCalendario, 1))} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 font-bold">›</button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-gray-400 mb-2">
                {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map(d => <div key={d} className="py-2">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {diasCalendario.map((dia, idx) => {
                  const noMesAtual = dia.getMonth() === mesAtualCalendario.getMonth();
                  const ags = registrosFiltrados.filter(r => isSameDay(parseISO(r.data_hora), dia));
                  
                  return (
                    <div key={idx} className={`min-h-[80px] p-2 border border-gray-50 rounded-xl flex flex-col transition-colors ${noMesAtual ? "bg-white" : "bg-gray-50/50"} ${isToday(dia) ? "ring-2 ring-indigo-500 bg-indigo-50/10" : ""}`}>
                      <span className={`text-xs font-bold mb-1 ${isToday(dia) ? "text-indigo-600" : noMesAtual ? "text-gray-700" : "text-gray-300"}`}>{format(dia, "d")}</span>
                      <div className="space-y-1.5 overflow-y-auto no-scrollbar">
                        {ags.map(ag => (
                          <div key={ag.id} onClick={() => clicarNoCompromisso(ag)} className={`text-[10px] font-bold p-1 rounded-md truncate cursor-pointer hover:opacity-80 shadow-sm ${ag.tipo === 'Gabinete' ? 'bg-emerald-500 text-white' : ag.tipo === 'Visita' ? 'bg-sky-500 text-white' : 'bg-indigo-500 text-white'}`} title={ag.assunto}>
                            {format(parseISO(ag.data_hora), "HH:mm")} - {ag.assunto || ag.tipo}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PRÓXIMOS EVENTOS */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col max-h-[550px]">
              <h3 className="font-black text-gray-800 text-md mb-4 flex items-center gap-2">📋 Lembretes Futuros</h3>
              <div className="space-y-3 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                {registrosFiltrados.filter(r => r.status === "Agendado" || r.status === "Pendente").slice(0, 10).map(comp => {
                  const nomePessoa = comp.membro_id ? membros.find(m => m.id === comp.membro_id)?.nome_completo : comp.nome_nao_membro;
                  return (
                    <div key={comp.id} onClick={() => clicarNoCompromisso(comp)} className="p-3.5 bg-gray-50 border border-gray-100 rounded-2xl cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all group">
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${comp.tipo === 'Gabinete' ? 'bg-emerald-100 text-emerald-700' : comp.tipo === 'Visita' ? 'bg-sky-100 text-sky-700' : 'bg-indigo-100 text-indigo-700'}`}>{comp.tipo}</span>
                        <span className="text-[10px] font-bold text-gray-400 group-hover:text-indigo-500 transition-colors">{format(parseISO(comp.data_hora), "dd/MM HH:mm")}</span>
                      </div>
                      <h4 className="font-bold text-sm text-gray-800 truncate">{nomePessoa || "Compromisso Geral"}</h4>
                      {comp.assunto && <p className="text-xs text-gray-500 truncate mt-0.5 font-medium">{comp.assunto}</p>}
                    </div>
                  );
                })}
                {registrosFiltrados.filter(r => r.status === "Agendado" || r.status === "Pendente").length === 0 && (
                  <div className="text-center text-xs font-medium text-gray-400 py-10">Agenda limpa.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (abaAtiva === "atendimentos") {
      const lista = registrosFiltrados.filter(r => r.tipo === "Gabinete");
      return (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {lista.map(reg => {
              const nome = reg.membro_id ? membros.find(m => m.id === reg.membro_id)?.nome_completo : reg.nome_nao_membro;
              return (
                <div key={reg.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col relative group hover:shadow-md transition-all">
                  <div className="flex justify-between items-center mb-4">
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${reg.status === 'Resolvido' || reg.status === 'Finalizado' ? 'bg-green-100 text-green-700' : reg.status === 'Em Acompanhamento' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {reg.status === 'Finalizado' ? 'Resolvido' : reg.status}
                    </span>
                    <div className="flex gap-3">
                      <button onClick={() => { setFormRegistro(reg); setModalGabineteAberto(true); }} className="text-xs font-bold text-gray-400 hover:text-emerald-600 transition-colors">Abrir Prontuário</button>
                      <button onClick={() => excluirRegistro(reg.id, "pastoral_registros")} className="text-xs font-bold text-gray-300 hover:text-red-500 transition-colors">✕</button>
                    </div>
                  </div>
                  <h3 className="text-lg font-black text-gray-800 leading-tight">{nome || "Não informado"}</h3>
                  <p className="text-xs font-bold text-gray-400 mt-1">📅 {format(parseISO(reg.data_hora), "dd/MM/yyyy 'às' HH:mm")}</p>
                  {reg.assunto && <div className="mt-4 p-3 bg-gray-50 rounded-xl text-sm font-semibold text-gray-700 border border-gray-100">{reg.assunto}</div>}
                  {reg.anexo_url && (
                    <a href={reg.anexo_url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 py-2 rounded-xl hover:bg-blue-100 transition-colors">
                      📎 Ver Documento Anexo
                    </a>
                  )}
                </div>
              );
            })}
            {lista.length === 0 && <div className="col-span-full p-12 text-center text-sm font-bold text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">Nenhum atendimento em gabinete filtrado.</div>}
          </div>
        </div>
      );
    }

    if (abaAtiva === "visitas") {
      const lista = registrosFiltrados.filter(r => r.tipo === "Visita");
      return (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center gap-3">
              <span className="text-2xl">🚗</span>
              <div>
                <h2 className="text-lg font-black text-gray-800">Dashboard de Visitas Domiciliares</h2>
                <p className="text-xs font-medium text-gray-400">Histórico rápido de assistência nos lares e hospitais.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] uppercase tracking-wider text-gray-500 font-black">
                    <th className="p-4">Data</th>
                    <th className="p-4">Membro / Pessoa</th>
                    <th className="p-4">Local / Endereço</th>
                    <th className="p-4">Observação / Foco</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium text-gray-700 divide-y divide-gray-50">
                  {lista.map(reg => {
                    const nome = reg.membro_id ? membros.find(m => m.id === reg.membro_id)?.nome_completo : reg.nome_nao_membro;
                    return (
                      <tr key={reg.id} className="hover:bg-sky-50/30 transition-colors">
                        <td className="p-4 text-xs font-bold text-gray-500">{format(parseISO(reg.data_hora), "dd/MM/yy")}</td>
                        <td className="p-4 font-bold text-gray-900">{nome}</td>
                        <td className="p-4 text-sky-600">{reg.local || "-"}</td>
                        <td className="p-4 text-xs text-gray-500 max-w-xs truncate">{reg.descricao || reg.assunto || "-"}</td>
                        <td className="p-4 flex justify-center gap-3">
                          <button onClick={() => { setFormRegistro(reg); setModalVisitaAberto(true); }} className="text-xs font-bold text-sky-600 hover:text-sky-800">Editar</button>
                          <button onClick={() => excluirRegistro(reg.id, "pastoral_registros")} className="text-xs font-bold text-red-400 hover:text-red-600">Excluir</button>
                        </td>
                      </tr>
                    );
                  })}
                  {lista.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-xs font-bold text-gray-400">Nenhuma visita registrada no período.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (abaAtiva === "acompanhados") {
      // Cálculo de Métricas para o Dashboard
      const registrosTratados = registrosFiltrados.filter(r => r.tipo === "Gabinete" || r.tipo === "Visita");
      const idsUnicos = Array.from(new Set(registrosTratados.filter(r => r.membro_id).map(r => r.membro_id)));
      
      const totalResolvidos = registrosTratados.filter(r => r.status === "Resolvido" || r.status === "Finalizado").length;
      const totalAndamento = registrosTratados.filter(r => r.status === "Em Acompanhamento").length;
      const totalPendentes = registrosTratados.filter(r => r.status === "Agendado" || r.status === "Pendente").length;
      const totalGeral = registrosTratados.length || 1; // evitar divisao por zero
      
      // Contagem de Assuntos para Ranking
      const contagemAssuntos: Record<string, number> = {};
      registrosTratados.forEach(r => {
        const assunto = r.assunto ? r.assunto.trim().toUpperCase() : "GERAL";
        contagemAssuntos[assunto] = (contagemAssuntos[assunto] || 0) + 1;
      });
      const topAssuntos = Object.entries(contagemAssuntos).sort((a,b) => b[1] - a[1]).slice(0, 4);

      return (
        <div className="space-y-6 animate-fadeIn">
          {/* MÉTRICAS TOP */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Vidas Assistidas</p>
              <h3 className="text-4xl font-black text-purple-600">{idsUnicos.length}</h3>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Casos Resolvidos</p>
              <h3 className="text-4xl font-black text-green-500">{totalResolvidos}</h3>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Em Acompanhamento</p>
              <h3 className="text-4xl font-black text-blue-500">{totalAndamento}</h3>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Na Fila / Pendentes</p>
              <h3 className="text-4xl font-black text-amber-500">{totalPendentes}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* GRÁFICO DE EFETIVIDADE (PROGRESS BARS) */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-black text-gray-800 mb-6 uppercase tracking-wider">Status do Cuidado Pastoral</h3>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-green-600">Resolvidos / Finalizados</span>
                    <span className="text-gray-500">{Math.round((totalResolvidos/totalGeral)*100)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3"><div className="bg-green-500 h-3 rounded-full" style={{width: `${(totalResolvidos/totalGeral)*100}%`}}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-blue-600">Em Acompanhamento Contínuo</span>
                    <span className="text-gray-500">{Math.round((totalAndamento/totalGeral)*100)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3"><div className="bg-blue-500 h-3 rounded-full" style={{width: `${(totalAndamento/totalGeral)*100}%`}}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-amber-600">Aguardando Atendimento</span>
                    <span className="text-gray-500">{Math.round((totalPendentes/totalGeral)*100)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3"><div className="bg-amber-500 h-3 rounded-full" style={{width: `${(totalPendentes/totalGeral)*100}%`}}></div></div>
                </div>
              </div>
            </div>

            {/* GRÁFICO DE INCIDÊNCIA DE ASSUNTOS */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-black text-gray-800 mb-6 uppercase tracking-wider">Top 4 Assuntos Tratados</h3>
              <div className="space-y-4">
                {topAssuntos.map(([assunto, count], i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 font-black flex items-center justify-center text-xs shrink-0">{count}</div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-gray-800 truncate">{assunto}</p>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5"><div className="bg-purple-500 h-1.5 rounded-full" style={{width: `${(count/totalGeral)*100}%`}}></div></div>
                    </div>
                  </div>
                ))}
                {topAssuntos.length === 0 && <p className="text-xs text-gray-400 font-medium text-center py-4">Dados insuficientes para gerar gráficos.</p>}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (abaAtiva === "anotacoes") {
      return (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Botão de Adicionar como Card */}
            <div onClick={() => { setFormAnotacao({ id: "", titulo: "", texto: "" }); setModalAnotacaoAberto(true); }} className="bg-amber-100/50 border-2 border-dashed border-amber-300 p-6 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-amber-100 hover:border-amber-400 transition-all min-h-[200px]">
              <span className="text-4xl text-amber-400 mb-2">+</span>
              <span className="font-bold text-amber-700 text-sm">Criar Nova Nota</span>
            </div>
            {anotacoes.map(nota => (
              <div key={nota.id} className="bg-[#fffbe6] p-6 rounded-3xl shadow-sm border border-amber-100 relative group flex flex-col justify-between hover:shadow-md transition-all min-h-[200px]">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-black text-gray-800 text-base line-clamp-1">{nota.titulo}</h3>
                    <button onClick={() => excluirRegistro(nota.id, "pastoral_anotacoes")} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 font-bold transition-all">✕</button>
                  </div>
                  <p className="text-xs font-medium text-gray-600 whitespace-pre-wrap line-clamp-5 leading-relaxed">{nota.texto}</p>
                </div>
                <p className="text-[10px] text-gray-400 mt-4 text-right font-bold tracking-wider">{format(parseISO(nota.created_at), "dd/MM/yy")}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (abaAtiva === "relatorios") {
      return (
        <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 text-center max-w-2xl mx-auto mt-8 animate-fadeIn">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl shadow-sm">📊</div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">Relatórios Dinâmicos</h2>
          <p className="text-sm font-medium text-gray-500 mb-8 max-w-md mx-auto leading-relaxed">
            O relatório gerado respeitará os filtros globais aplicados no topo da tela (Mês, Congregação, Cargo, etc).
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button onClick={() => window.print()} className="bg-gray-800 hover:bg-black text-white px-8 py-3.5 rounded-xl text-sm font-bold shadow-md transition-all transform hover:-translate-y-0.5">
              Imprimir / Salvar PDF
            </button>
            <button onClick={exportarCSV} className="bg-green-600 hover:bg-green-700 text-white px-8 py-3.5 rounded-xl text-sm font-bold shadow-md transition-all transform hover:-translate-y-0.5">
              Exportar para Excel
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  if (carregando) return <div className="p-12 text-center text-sm font-bold text-gray-400">Iniciando Módulo Pastoral...</div>;

  return (
    <div className="min-h-screen bg-gray-50/30 p-4 md:p-8">
      {/* CABEÇALHO */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Atendimento Pastoral</h1>
          <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Centro Integrado de Cuidados e Gestão</p>
        </div>
      </div>

      {/* BARRA DE FILTROS GLOBAIS (ESTILO DASHBOARD) */}
      <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-3 items-center print:hidden">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Filtros Globais:</span>
        <select value={filtros.mes} onChange={e => setFiltros({...filtros, mes: e.target.value})} className="bg-gray-50 text-xs font-bold text-gray-700 px-4 py-2 rounded-xl border border-transparent hover:border-gray-200 outline-none transition-all cursor-pointer">
          <option value="Todos">📅 Todos os Meses</option>
          {Array.from({length: 12}).map((_, i) => <option key={i} value={i.toString()}>{format(new Date(2000, i, 1), "MMMM", {locale:ptBR})}</option>)}
        </select>
        <select value={filtros.congregacao} onChange={e => setFiltros({...filtros, congregacao: e.target.value})} className="bg-gray-50 text-xs font-bold text-gray-700 px-4 py-2 rounded-xl border border-transparent hover:border-gray-200 outline-none transition-all cursor-pointer">
          <option value="Todas">⛪ Todas Congregações</option>
          {opcoesCongregacao.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filtros.cargo} onChange={e => setFiltros({...filtros, cargo: e.target.value})} className="bg-gray-50 text-xs font-bold text-gray-700 px-4 py-2 rounded-xl border border-transparent hover:border-gray-200 outline-none transition-all cursor-pointer">
          <option value="Todos">👔 Todos os Cargos</option>
          {opcoesCargo.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filtros.publico} onChange={e => setFiltros({...filtros, publico: e.target.value})} className="bg-gray-50 text-xs font-bold text-gray-700 px-4 py-2 rounded-xl border border-transparent hover:border-gray-200 outline-none transition-all cursor-pointer">
          <option value="Todos">👥 Membros & Visitantes</option>
          <option value="Membros">Apenas Membros</option>
          <option value="Outros">Apenas Não-Membros</option>
        </select>
      </div>

      {/* MENU DE ABAS COLORIDAS */}
      <div className="flex overflow-x-auto pb-1 mb-6 gap-2 no-scrollbar print:hidden">
        {[
          { id: "agenda", rotulo: "Agenda", icone: "📅" },
          { id: "atendimentos", rotulo: "Gabinete", icone: "🛋️" },
          { id: "visitas", rotulo: "Visitas", icone: "🚗" },
          { id: "acompanhados", rotulo: "Acompanhamento", icone: "❤️" },
          { id: "anotacoes", rotulo: "Anotações", icone: "📝" },
          { id: "relatorios", rotulo: "Relatórios", icone: "📊" }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setAbaAtiva(item.id)}
            className={`px-5 py-3 rounded-2xl font-bold text-[11px] uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
              abaAtiva === item.id 
              ? `${obterConfiguracaoAba(item.id).bgBtn} shadow-md transform scale-105` 
              : "bg-white text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            <span className="text-sm">{item.icone}</span> {item.rotulo}
          </button>
        ))}
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="print:m-0 print:p-0">
        {renderAbaConteudo()}
      </div>

      {/* ==================================================== */}
      {/* MODAL 1: AGENDAMENTO BÁSICO (APENAS MARCAR O COMPROMISSO) */}
      {/* ==================================================== */}
      {modalAgendaAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-xl font-black text-gray-900">Novo Agendamento</h2>
                <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider mt-1">Marcação Simples</p>
              </div>
              <button onClick={() => setModalAgendaAberto(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-500 font-bold transition-colors">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Tipo de Evento</label>
                  <select value={formRegistro.tipo} onChange={e => setFormRegistro({...formRegistro, tipo: e.target.value})} className="w-full p-3 bg-gray-50 border-none rounded-xl text-sm font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="Gabinete">Atendimento Gabinete</option>
                    <option value="Visita">Visita Domiciliar</option>
                    <option value="Outro">Outro Compromisso</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Data e Hora</label>
                  <input type="datetime-local" value={formRegistro.data_hora} onChange={e => setFormRegistro({...formRegistro, data_hora: e.target.value})} className="w-full p-3 bg-gray-50 border-none rounded-xl text-sm font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Pessoa Relacionada</label>
                <div className="flex gap-2 mb-2">
                  <input type="text" placeholder="Buscar na lista..." value={buscaMembroModal} onChange={e => setBuscaMembroModal(e.target.value)} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs font-medium outline-none focus:border-indigo-500" />
                </div>
                <select value={formRegistro.membro_id} onChange={e => setFormRegistro({...formRegistro, membro_id: e.target.value})} className="w-full p-3 bg-indigo-50 text-indigo-900 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="">Selecione quem será atendido...</option>
                  {membrosFiltradosBusca.map(m => <option key={m.id} value={m.id}>{m.nome_completo}</option>)}
                  <option value="outros">Outra Pessoa (Visitante / Externo)</option>
                </select>
              </div>

              {formRegistro.membro_id === "outros" && (
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Nome do Visitante/Externo</label>
                  <input type="text" value={formRegistro.nome_nao_membro} onChange={e => setFormRegistro({...formRegistro, nome_nao_membro: e.target.value})} className="w-full p-3 bg-gray-50 border-none rounded-xl text-sm font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Resumo / Pauta (Opcional)</label>
                <input type="text" placeholder="Ex: Aconselhamento de Casal" value={formRegistro.assunto} onChange={e => setFormRegistro({...formRegistro, assunto: e.target.value})} className="w-full p-3 bg-gray-50 border-none rounded-xl text-sm font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>

            <div className="p-5 bg-white flex justify-end gap-3 border-t border-gray-50">
              <button disabled={salvando} onClick={salvarRegistro} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black rounded-xl transition-all shadow-md transform hover:scale-[1.02]">
                {salvando ? "Salvando..." : "Confirmar Agendamento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: PRONTUÁRIO DE GABINETE (EXECUÇÃO COMPLETA) */}
      {/* ==================================================== */}
      {modalGabineteAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-xl font-black text-gray-900">Prontuário de Atendimento</h2>
                <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mt-1">Gabinete Pastoral</p>
              </div>
              <button onClick={() => setModalGabineteAberto(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-500 font-bold transition-colors">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50">
                  <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1.5">Status do Atendimento</label>
                  <select value={formRegistro.status} onChange={e => setFormRegistro({...formRegistro, status: e.target.value})} className="w-full p-2 bg-transparent border-none text-sm font-black text-gray-900 outline-none cursor-pointer">
                    <option value="Agendado">Aguardando Dia/Hora</option>
                    <option value="Em Acompanhamento">Em Acompanhamento</option>
                    <option value="Resolvido">Caso Resolvido / Finalizado</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Data Ocorrência</label>
                  <input type="datetime-local" value={formRegistro.data_hora} onChange={e => setFormRegistro({...formRegistro, data_hora: e.target.value})} className="w-full p-1 bg-transparent border-none text-sm font-black text-gray-900 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Pessoa Atendida</label>
                <div className="flex gap-2 mb-2">
                  <input type="text" placeholder="Buscar..." value={buscaMembroModal} onChange={e => setBuscaMembroModal(e.target.value)} className="w-full p-2.5 bg-gray-50 border-none rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <select value={formRegistro.membro_id} onChange={e => setFormRegistro({...formRegistro, membro_id: e.target.value})} className="w-full p-3 bg-gray-50 border-none rounded-xl text-sm font-bold text-gray-900 outline-none">
                  <option value="">Selecione...</option>
                  {membrosFiltradosBusca.map(m => <option key={m.id} value={m.id}>{m.nome_completo}</option>)}
                  <option value="outros">Visitante / Externo</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Pauta / Foco Principal</label>
                <input type="text" value={formRegistro.assunto} onChange={e => setFormRegistro({...formRegistro, assunto: e.target.value})} className="w-full p-3 bg-gray-50 border-none rounded-xl text-sm font-bold text-gray-900 outline-none" />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Registro Detalhado (Links são clicáveis após salvar)</label>
                <textarea rows={5} value={formRegistro.descricao} onChange={e => setFormRegistro({...formRegistro, descricao: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed" placeholder="Descreva os pontos tratados, orientações bíblicas dadas, próximos passos..."></textarea>
              </div>

              {/* UPLOAD INTELIGENTE */}
              <div className="bg-emerald-50/30 border border-emerald-100 p-4 rounded-2xl">
                <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Anexar Documento / Imagem (Máx 500kb)</label>
                <input type="file" accept="image/*,.pdf,.doc,.docx" onChange={handleUpload} className="block w-full text-xs text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer" />
                {anexoNome && <p className="text-xs font-bold text-emerald-600 mt-3">{anexoNome}</p>}
                {formRegistro.anexo_url && !anexoNome && <p className="text-xs font-bold text-gray-500 mt-3">✓ Um documento já está salvo neste prontuário.</p>}
              </div>
            </div>

            <div className="p-5 bg-white flex justify-end gap-3 border-t border-gray-50">
              <button disabled={salvando} onClick={salvarRegistro} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black rounded-xl transition-all shadow-md transform hover:scale-[1.02]">
                {salvando ? "Processando..." : "Salvar Prontuário"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 3: REGISTRO DE VISITA SIMPLIFICADO */}
      {/* ==================================================== */}
      {modalVisitaAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-xl font-black text-gray-900">Registro de Visita</h2>
                <p className="text-xs font-bold text-sky-500 uppercase tracking-wider mt-1">Histórico Rápido</p>
              </div>
              <button onClick={() => setModalVisitaAberto(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-500 font-bold transition-colors">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Local / Endereço</label>
                <input type="text" placeholder="Lar da família, Hospital X..." value={formRegistro.local} onChange={e => setFormRegistro({...formRegistro, local: e.target.value})} className="w-full p-3 bg-gray-50 border-none rounded-xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Data Ocorrência</label>
                  <input type="datetime-local" value={formRegistro.data_hora} onChange={e => setFormRegistro({...formRegistro, data_hora: e.target.value})} className="w-full p-3 bg-gray-50 border-none rounded-xl text-sm font-bold text-gray-800 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Status</label>
                  <select value={formRegistro.status} onChange={e => setFormRegistro({...formRegistro, status: e.target.value})} className="w-full p-3 bg-sky-50 text-sky-900 border-none rounded-xl text-sm font-bold outline-none">
                    <option value="Agendado">Planejada</option>
                    <option value="Finalizado">Realizada ✓</option>
                    <option value="Cancelado">Cancelada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Quem foi visitado?</label>
                <select value={formRegistro.membro_id} onChange={e => setFormRegistro({...formRegistro, membro_id: e.target.value})} className="w-full p-3 bg-gray-50 border-none rounded-xl text-sm font-bold text-gray-900 outline-none">
                  <option value="">Selecione...</option>
                  {membros.map(m => <option key={m.id} value={m.id}>{m.nome_completo}</option>)}
                  <option value="outros">Visitante / Externo</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Observações (Opcional)</label>
                <textarea rows={3} value={formRegistro.descricao} onChange={e => setFormRegistro({...formRegistro, descricao: e.target.value})} className="w-full p-3 bg-gray-50 border-none rounded-xl text-sm font-medium text-gray-700 outline-none resize-none" placeholder="Nota rápida sobre a visita..."></textarea>
              </div>
            </div>

            <div className="p-5 bg-white border-t border-gray-50">
              <button disabled={salvando} onClick={salvarRegistro} className="w-full py-4 bg-sky-600 hover:bg-sky-700 text-white text-sm font-black rounded-xl transition-all shadow-md">
                {salvando ? "Salvando..." : "Gravar Visita"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL DE ANOTAÇÕES GERAIS */}
      {/* ==================================================== */}
      {modalAnotacaoAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-[#fffdf0] rounded-[2rem] w-full max-w-md overflow-hidden flex flex-col shadow-2xl border border-amber-100">
            <div className="p-6 border-b border-amber-100 bg-[#fffbe6] flex justify-between items-center">
              <h2 className="text-xl font-black text-gray-900">Nova Anotação</h2>
              <button onClick={() => setModalAnotacaoAberto(false)} className="text-amber-500 hover:text-red-500 font-bold text-xl transition-colors">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <input type="text" placeholder="Título da Nota" value={formAnotacao.titulo} onChange={e => setFormAnotacao({...formAnotacao, titulo: e.target.value})} className="w-full p-2 bg-transparent border-b-2 border-amber-200 outline-none focus:border-amber-500 font-black text-gray-800 text-lg" />
              <textarea rows={6} placeholder="Digite suas ideias livremente..." value={formAnotacao.texto} onChange={e => setFormAnotacao({...formAnotacao, texto: e.target.value})} className="w-full p-4 border border-transparent rounded-2xl bg-amber-50/50 outline-none text-gray-700 font-medium resize-none focus:border-amber-200" />
            </div>
            <div className="p-5 bg-[#fffbe6]/50">
              <button disabled={salvando} onClick={salvarAnotacao} className="w-full py-4 bg-amber-500 text-white text-sm font-black rounded-xl hover:bg-amber-600 transition-all shadow-md">
                {salvando ? "Guardando..." : "Salvar no Bloco"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}