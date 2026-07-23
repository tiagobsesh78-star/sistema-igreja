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
          
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          resolve(dataUrl);
        };
      };
      reader.onerror = error => reject(error);
    } else {
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

  // Dados Globais
  const [configIgreja, setConfigIgreja] = useState<any>(null);
  const [ehSede, setEhSede] = useState(true);
  const [membros, setMembros] = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [anotacoes, setAnotacoes] = useState<any[]>([]);
  
  // Opções de Filtro
  const [opcoesCongregacao, setOpcoesCongregacao] = useState<string[]>([]);
  const [opcoesCargo, setOpcoesCargo] = useState<string[]>([]);

  // Filtros Globais
  const [filtros, setFiltros] = useState({
    mes: "Todos",
    congregacao: "Todas",
    cargo: "Todos",
    publico: "Todos"
  });

  // Estados de Modais
  const [modalAgendaAberto, setModalAgendaAberto] = useState(false);
  const [modalGabineteAberto, setModalGabineteAberto] = useState(false);
  const [modalVisitaAberto, setModalVisitaAberto] = useState(false);
  const [modalAnotacaoAberto, setModalAnotacaoAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Sistema Multimembros
  const [buscaMembro, setBuscaMembro] = useState("");
  const [envolvidos, setEnvolvidos] = useState<{ id?: string, nome: string, tipo: 'membro' | 'visitante' }[]>([]);

  const formZerado = { id: "", tipo: "Gabinete", data_hora: "", local: "", assunto: "", descricao: "", status: "Agendado", anexo_url: "" };
  const [formRegistro, setFormRegistro] = useState(formZerado);
  const [formAnotacao, setFormAnotacao] = useState({ id: "", titulo: "", texto: "" });
  const [anexoNome, setAnexoNome] = useState("");

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
      const { data: config } = await supabase.from("configuracao_igreja").select("*").eq("igreja_id", igrejaId).maybeSingle();
      setConfigIgreja(config);

      const nomeSede = config?.nome_igreja?.trim() || "Sede Principal";
      const congUser = usuario?.congregacao?.trim() || "";
      const isUserSede = !congUser || congUser.toLowerCase() === "sede" || congUser.toLowerCase() === "matriz" || congUser.toLowerCase() === "geral" || congUser.toLowerCase() === nomeSede.toLowerCase();
      setEhSede(isUserSede);

      const { data: dadosMembros } = await supabase.from("membros").select("id, nome_completo, congregacao, cargo").eq("igreja_id", igrejaId).order("nome_completo", { ascending: true });

      let membrosProcessados = dadosMembros || [];
      if (!isUserSede) {
        membrosProcessados = membrosProcessados.filter(m => (m.congregacao?.trim() || "Sede") === congUser);
      }
      setMembros(membrosProcessados);

      if (isUserSede) {
        setOpcoesCongregacao(Array.from(new Set(membrosProcessados.map(m => m.congregacao || "Sede"))));
      } else {
        setOpcoesCongregacao([congUser]);
        setFiltros(prev => ({...prev, congregacao: congUser}));
      }

      setOpcoesCargo(Array.from(new Set(membrosProcessados.map(m => m.cargo || "Membro"))));

      const { data: dadosRegistros } = await supabase.from("pastoral_registros").select("*").eq("igreja_id", igrejaId).eq("pastor_id", pastorId).order("data_hora", { ascending: false });
      if (dadosRegistros) setRegistros(dadosRegistros);

      const { data: dadosAnotacoes } = await supabase.from("pastoral_anotacoes").select("*").eq("igreja_id", igrejaId).eq("pastor_id", pastorId).order("created_at", { ascending: false });
      if (dadosAnotacoes) setAnotacoes(dadosAnotacoes);

    } catch (error) { console.error(error); } 
    finally { setCarregando(false); }
  }

  // ==========================================
  // FILTRAGEM GLOBAL (COMPUTADA)
  // ==========================================
  const registrosFiltrados = useMemo(() => {
    return registros.filter(reg => {
      let membrosIds = reg.membro_id ? reg.membro_id.split(",").map((i: string) => i.trim()) : [];
      let membrosDoReg = membros.filter(m => membrosIds.includes(m.id));

      if (filtros.mes !== "Todos") {
        const mesReg = getMonth(parseISO(reg.data_hora)).toString();
        if (mesReg !== filtros.mes) return false;
      }

      const temMembro = membrosDoReg.length > 0;
      const temVisitante = !!reg.nome_nao_membro;
      if (filtros.publico === "Membros" && !temMembro) return false;
      if (filtros.publico === "Outros" && !temVisitante) return false;

      if (filtros.congregacao !== "Todas" || filtros.cargo !== "Todos") {
        const matchCong = membrosDoReg.some(m => {
            const cong = m.congregacao || "Sede";
            return (filtros.congregacao === "Todas" || cong === filtros.congregacao);
        });
        const matchCargo = membrosDoReg.some(m => {
            const cargo = m.cargo || "Membro";
            return (filtros.cargo === "Todos" || cargo === filtros.cargo);
        });

        if (!temMembro || !matchCong || !matchCargo) return false;
      }

      return true;
    });
  }, [registros, membros, filtros]);

  const obterNomesEnvolvidosTexto = (reg: any) => {
    let nomes: string[] = []; // Correção do TypeScript aplicada aqui
    if (reg.membro_id) {
        reg.membro_id.split(",").forEach((id: string) => {
           const m = membros.find(x => x.id === id.trim());
           if(m) nomes.push(m.nome_completo);
        });
    }
    if (reg.nome_nao_membro) {
        reg.nome_nao_membro.split(",").forEach((n: string) => {
           if(n.trim()) nomes.push(n.trim() + " (Vis)");
        });
    }
    return nomes.join(", ") || "Não informado";
  };

  const membrosFiltradosBusca = buscaMembro.trim() === "" ? [] : membros.filter(m =>
    m.nome_completo.toLowerCase().includes(buscaMembro.toLowerCase()) &&
    !envolvidos.some(e => e.id === m.id)
  );

  const addMembroLista = (m: any) => {
    setEnvolvidos([...envolvidos, { id: m.id, nome: m.nome_completo, tipo: 'membro' }]);
    setBuscaMembro("");
  };

  const addVisitanteLista = () => {
    if (buscaMembro.trim()) {
        setEnvolvidos([...envolvidos, { nome: buscaMembro.trim(), tipo: 'visitante' }]);
        setBuscaMembro("");
    }
  };

  const removerEnvolvido = (index: number) => {
    setEnvolvidos(envolvidos.filter((_, i) => i !== index));
  };

  const converterRegParaEnvolvidos = (reg: any) => {
    let envs: any[] = [];
    if (reg.membro_id) {
        reg.membro_id.split(",").forEach((id: string) => {
            const m = membros.find(x => x.id === id.trim());
            if (m) envs.push({ id: m.id, nome: m.nome_completo, tipo: 'membro' });
        });
    }
    if (reg.nome_nao_membro) {
        reg.nome_nao_membro.split(",").forEach((n: string) => {
            if (n.trim()) envs.push({ nome: n.trim(), tipo: 'visitante' });
        });
    }
    setEnvolvidos(envs);
  };

  const abrirAgendamento = () => {
    setFormRegistro({...formZerado, tipo: "Gabinete"});
    setEnvolvidos([]);
    setBuscaMembro("");
    setAnexoNome("");
    setModalAgendaAberto(true);
  };

  const clicarNoCompromisso = (registro: any) => {
    setFormRegistro(registro);
    converterRegParaEnvolvidos(registro);
    setBuscaMembro("");
    setAnexoNome("");
    
    if (registro.tipo === "Gabinete") {
      setAbaAtiva("atendimentos");
      setModalGabineteAberto(true);
    } else if (registro.tipo === "Visita") {
      setAbaAtiva("visitas");
      setModalVisitaAberto(true);
    } else {
      setAbaAtiva("agenda");
      setModalAgendaAberto(true);
    }
  };

  const handleUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert("⚠️ O arquivo é muito grande! O limite é de 500KB.");
      return;
    }
    setAnexoNome("Compactando...");
    try {
      const base64Url = await compactarParaBase64(file);
      setFormRegistro({ ...formRegistro, anexo_url: base64Url });
      setAnexoNome(file.name + " (✓ Anexado)");
    } catch (err) {
      alert("Erro ao anexar.");
      setAnexoNome("");
    }
  };

  const salvarRegistro = async () => {
    if (!formRegistro.data_hora || !formRegistro.tipo) {
      alert("Data e Tipo são obrigatórios.");
      return;
    }
    if (envolvidos.length === 0) {
      alert("Você precisa adicionar pelo menos uma pessoa.");
      return;
    }

    setSalvando(true);
    const idsMembros = envolvidos.filter(e => e.tipo === 'membro').map(e => e.id).join(",");
    const nomesVisitantes = envolvidos.filter(e => e.tipo === 'visitante').map(e => e.nome).join(",");

    const payload = {
      igreja_id: usuarioAtual.igreja_id || usuarioAtual.id_igreja,
      pastor_id: usuarioAtual.id,
      tipo: formRegistro.tipo,
      membro_id: idsMembros || null,
      nome_nao_membro: nomesVisitantes || null,
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
    let csv = "Data;Tipo;Pessoas Envolvidas;Local;Assunto;Status;Observacoes\n";
    registrosFiltrados.forEach(r => {
      const nomeTexto = obterNomesEnvolvidosTexto(r);
      const dataFormatada = format(parseISO(r.data_hora), "dd/MM/yyyy HH:mm");
      const desc = r.descricao ? r.descricao.replace(/\n/g, " ") : "";
      csv += `${dataFormatada};${r.tipo};${nomeTexto};${r.local || ""};${r.assunto || ""};${r.status};${desc}\n`;
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
          {/* CABEÇALHO DA ABA AGENDA COM TOOLTIP */}
          <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-5 rounded-3xl shadow-sm border border-gray-100 gap-4 print:hidden">
            <div className="group relative w-full sm:w-auto flex justify-center sm:justify-start">
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2 cursor-default">
                📅 Central de Marcações
                <span className="hidden md:flex text-gray-400 text-[10px] bg-gray-100 rounded-full w-5 h-5 items-center justify-center font-bold">i</span>
              </h2>
              <div className="absolute left-0 top-full mt-2 w-72 p-3 bg-gray-900 text-white text-xs font-medium rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 hidden md:block">
                Clique no botão para agendar. Para gerenciar prontuários, clique diretamente sobre o agendamento no calendário.
              </div>
            </div>
            <button onClick={abrirAgendamento} className={`${temaAba.bgBtn} w-full sm:w-auto px-8 py-3.5 rounded-full text-sm font-black shadow-md transition-all transform hover:scale-105 active:scale-95 whitespace-nowrap`}>
              + Agendar Horário
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CALENDÁRIO */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 print:border-none print:shadow-none">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-gray-800 capitalize">{format(mesAtualCalendario, "MMMM 'de' yyyy", { locale: ptBR })}</h3>
                <div className="flex gap-2 print:hidden">
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
                    <div key={idx} className={`min-h-[80px] p-2 border border-gray-50 rounded-xl flex flex-col transition-colors ${noMesAtual ? "bg-white print:border-gray-300" : "bg-gray-50/50"} ${isToday(dia) ? "ring-2 ring-indigo-500 bg-indigo-50/10" : ""}`}>
                      <span className={`text-xs font-bold mb-1 ${isToday(dia) ? "text-indigo-600" : noMesAtual ? "text-gray-700" : "text-gray-300"}`}>{format(dia, "d")}</span>
                      <div className="space-y-1.5 overflow-y-auto no-scrollbar">
                        {ags.map(ag => (
                          <div key={ag.id} onClick={() => clicarNoCompromisso(ag)} className={`text-[10px] font-bold p-1 rounded-md truncate cursor-pointer hover:opacity-80 shadow-sm print:border print:text-black ${ag.tipo === 'Gabinete' ? 'bg-emerald-500 text-white' : ag.tipo === 'Visita' ? 'bg-sky-500 text-white' : 'bg-indigo-500 text-white'}`} title={ag.assunto}>
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
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col max-h-[550px] print:hidden">
              <h3 className="font-black text-gray-800 text-md mb-4 flex items-center gap-2">📋 Lembretes Futuros</h3>
              <div className="space-y-3 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                {registrosFiltrados.filter(r => r.status === "Agendado" || r.status === "Pendente").slice(0, 10).map(comp => {
                  return (
                    <div key={comp.id} onClick={() => clicarNoCompromisso(comp)} className="p-3.5 bg-gray-50 border border-gray-100 rounded-2xl cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all group">
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${comp.tipo === 'Gabinete' ? 'bg-emerald-100 text-emerald-700' : comp.tipo === 'Visita' ? 'bg-sky-100 text-sky-700' : 'bg-indigo-100 text-indigo-700'}`}>{comp.tipo}</span>
                        <span className="text-[10px] font-bold text-gray-400 group-hover:text-indigo-500 transition-colors">{format(parseISO(comp.data_hora), "dd/MM HH:mm")}</span>
                      </div>
                      <h4 className="font-bold text-sm text-gray-800 truncate">{obterNomesEnvolvidosTexto(comp)}</h4>
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
          
          <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-5 rounded-3xl shadow-sm border border-gray-100 gap-4 print:hidden">
            <div className="group relative w-full sm:w-auto flex justify-center sm:justify-start">
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2 cursor-default">
                🛋️ Atendimentos / Gabinete
                <span className="hidden md:flex text-gray-400 text-[10px] bg-gray-100 rounded-full w-5 h-5 items-center justify-center font-bold">i</span>
              </h2>
              <div className="absolute left-0 top-full mt-2 w-72 p-3 bg-gray-900 text-white text-xs font-medium rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 hidden md:block">
                Aconselhamentos, escutas e atendimentos oficiais em ambiente seguro.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {lista.map(reg => {
              return (
                <div key={reg.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col relative group hover:shadow-md transition-all print:border-gray-300 print:shadow-none print:break-inside-avoid">
                  <div className="flex justify-between items-center mb-4">
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider print:border print:text-black ${reg.status === 'Resolvido' || reg.status === 'Finalizado' ? 'bg-green-100 text-green-700' : reg.status === 'Em Acompanhamento' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {reg.status === 'Finalizado' ? 'Resolvido' : reg.status}
                    </span>
                    <div className="flex gap-3 print:hidden">
                      <button onClick={() => clicarNoCompromisso(reg)} className="text-xs font-bold text-gray-400 hover:text-emerald-600 transition-colors">Abrir Prontuário</button>
                      <button onClick={() => excluirRegistro(reg.id, "pastoral_registros")} className="text-xs font-bold text-gray-300 hover:text-red-500 transition-colors">✕</button>
                    </div>
                  </div>
                  <h3 className="text-lg font-black text-gray-800 leading-tight">{obterNomesEnvolvidosTexto(reg)}</h3>
                  <p className="text-xs font-bold text-gray-400 mt-1">📅 {format(parseISO(reg.data_hora), "dd/MM/yyyy 'às' HH:mm")}</p>
                  {reg.assunto && <div className="mt-4 p-3 bg-gray-50 rounded-xl text-sm font-semibold text-gray-700 border border-gray-100">{reg.assunto}</div>}
                  {reg.anexo_url && (
                    <a href={reg.anexo_url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 py-2 rounded-xl hover:bg-blue-100 transition-colors print:hidden">
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
          
          <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-5 rounded-3xl shadow-sm border border-gray-100 gap-4 print:hidden">
            <div className="group relative w-full sm:w-auto flex justify-center sm:justify-start">
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2 cursor-default">
                🚗 Histórico de Visitas
                <span className="hidden md:flex text-gray-400 text-[10px] bg-gray-100 rounded-full w-5 h-5 items-center justify-center font-bold">i</span>
              </h2>
              <div className="absolute left-0 top-full mt-2 w-72 p-3 bg-gray-900 text-white text-xs font-medium rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 hidden md:block">
                Controle rápido e direto das visitas domiciliares, lares e hospitais.
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden print:border-gray-400">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] uppercase tracking-wider text-gray-500 font-black print:bg-gray-200">
                    <th className="p-5 border-b">Data</th>
                    <th className="p-5 border-b">Pessoas Visitadas</th>
                    <th className="p-5 border-b">Local / Endereço</th>
                    <th className="p-5 border-b">Observação / Foco</th>
                    <th className="p-5 text-center border-b print:hidden">Ações</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium text-gray-700 divide-y divide-gray-50">
                  {lista.map(reg => {
                    return (
                      <tr key={reg.id} className="hover:bg-sky-50/30 transition-colors print:border-b">
                        <td className="p-5 text-xs font-bold text-gray-500 whitespace-nowrap">{format(parseISO(reg.data_hora), "dd/MM/yy")}</td>
                        <td className="p-5 font-bold text-gray-900">{obterNomesEnvolvidosTexto(reg)}</td>
                        <td className="p-5 text-sky-600">{reg.local || "-"}</td>
                        <td className="p-5 text-xs text-gray-500 max-w-xs truncate">{reg.descricao || reg.assunto || "-"}</td>
                        <td className="p-5 flex justify-center gap-3 print:hidden">
                          <button onClick={() => clicarNoCompromisso(reg)} className="text-xs font-bold text-sky-600 hover:text-sky-800">Editar</button>
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
      const registrosTratados = registrosFiltrados.filter(r => r.tipo === "Gabinete" || r.tipo === "Visita");
      
      const listaIds = registrosTratados.flatMap(r => r.membro_id ? r.membro_id.split(",").map((i: string) => i.trim()) : []);
      const idsUnicos = Array.from(new Set(listaIds));
      
      const totalResolvidos = registrosTratados.filter(r => r.status === "Resolvido" || r.status === "Finalizado").length;
      const totalAndamento = registrosTratados.filter(r => r.status === "Em Acompanhamento").length;
      const totalPendentes = registrosTratados.filter(r => r.status === "Agendado" || r.status === "Pendente").length;
      const totalGeral = registrosTratados.length || 1;
      
      const contagemAssuntos: Record<string, number> = {};
      registrosTratados.forEach(r => {
        const assunto = r.assunto ? r.assunto.trim().toUpperCase() : "GERAL";
        contagemAssuntos[assunto] = (contagemAssuntos[assunto] || 0) + 1;
      });
      const topAssuntos = Object.entries(contagemAssuntos).sort((a,b) => b[1] - a[1]).slice(0, 4);

      return (
        <div className="space-y-6 animate-fadeIn">
          {/* CABEÇALHO DASHBOARD ACOMPANHADOS */}
          <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-5 rounded-3xl shadow-sm border border-gray-100 gap-4 print:hidden">
            <div className="group relative w-full flex justify-center sm:justify-start">
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2 cursor-default">
                ❤️ Dashboard de Cuidado Pastoral
                <span className="hidden md:flex text-gray-400 text-[10px] bg-gray-100 rounded-full w-5 h-5 items-center justify-center font-bold">i</span>
              </h2>
              <div className="absolute left-0 top-full mt-2 w-72 p-3 bg-gray-900 text-white text-xs font-medium rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 hidden md:block">
                Veja métricas globais e a saúde espiritual baseada nos prontuários da igreja.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center print:border-gray-300 print:shadow-none">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Vidas Assistidas</p>
              <h3 className="text-4xl font-black text-purple-600 print:text-black">{idsUnicos.length}</h3>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center print:border-gray-300 print:shadow-none">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Casos Resolvidos</p>
              <h3 className="text-4xl font-black text-green-500 print:text-black">{totalResolvidos}</h3>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center print:border-gray-300 print:shadow-none">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Em Andamento</p>
              <h3 className="text-4xl font-black text-blue-500 print:text-black">{totalAndamento}</h3>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center print:border-gray-300 print:shadow-none">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Na Fila / Pendentes</p>
              <h3 className="text-4xl font-black text-amber-500 print:text-black">{totalPendentes}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 print:border-gray-400">
              <h3 className="text-sm font-black text-gray-800 mb-6 uppercase tracking-wider">Status do Cuidado Pastoral</h3>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-green-600 print:text-black">Resolvidos / Finalizados</span>
                    <span className="text-gray-500">{Math.round((totalResolvidos/totalGeral)*100)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 print:border"><div className="bg-green-500 h-3 rounded-full print:bg-black" style={{width: `${(totalResolvidos/totalGeral)*100}%`}}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-blue-600 print:text-black">Em Acompanhamento</span>
                    <span className="text-gray-500">{Math.round((totalAndamento/totalGeral)*100)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 print:border"><div className="bg-blue-500 h-3 rounded-full print:bg-gray-500" style={{width: `${(totalAndamento/totalGeral)*100}%`}}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-amber-600 print:text-black">Aguardando</span>
                    <span className="text-gray-500">{Math.round((totalPendentes/totalGeral)*100)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 print:border"><div className="bg-amber-500 h-3 rounded-full print:bg-gray-300" style={{width: `${(totalPendentes/totalGeral)*100}%`}}></div></div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 print:border-gray-400">
              <h3 className="text-sm font-black text-gray-800 mb-6 uppercase tracking-wider">Top 4 Assuntos Tratados</h3>
              <div className="space-y-4">
                {topAssuntos.map(([assunto, count], i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 font-black flex items-center justify-center text-xs shrink-0 print:border">{count}</div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-gray-800 truncate">{assunto}</p>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5 print:border"><div className="bg-purple-500 h-1.5 rounded-full print:bg-black" style={{width: `${(count/totalGeral)*100}%`}}></div></div>
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
            <div onClick={() => { setFormAnotacao({ id: "", titulo: "", texto: "" }); setModalAnotacaoAberto(true); }} className="bg-amber-100/50 border-2 border-dashed border-amber-300 p-6 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-amber-100 hover:border-amber-400 transition-all min-h-[200px] print:hidden">
              <span className="text-4xl text-amber-400 mb-2">+</span>
              <span className="font-bold text-amber-700 text-sm">Criar Nova Nota</span>
            </div>
            {anotacoes.map(nota => (
              <div key={nota.id} className="bg-[#fffbe6] p-6 rounded-3xl shadow-sm border border-amber-100 relative group flex flex-col justify-between hover:shadow-md transition-all min-h-[200px] print:border-gray-400 print:break-inside-avoid print:bg-white">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-black text-gray-800 text-base line-clamp-1">{nota.titulo}</h3>
                    <div className="opacity-0 group-hover:opacity-100 transition-all flex gap-3 print:hidden">
                       <button onClick={() => { setFormAnotacao(nota); setModalAnotacaoAberto(true); }} className="text-gray-400 hover:text-amber-600 font-bold text-sm">✏️</button>
                       <button onClick={() => excluirRegistro(nota.id, "pastoral_anotacoes")} className="text-gray-300 hover:text-red-500 font-bold text-sm">✕</button>
                    </div>
                  </div>
                  <p className="text-xs font-medium text-gray-600 whitespace-pre-wrap line-clamp-5 leading-relaxed">
                    {renderizarTextoComLinks(nota.texto)}
                  </p>
                </div>
                <p className="text-[10px] text-gray-400 mt-4 text-right font-bold tracking-wider">{format(parseISO(nota.created_at), "dd/MM/yy")}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  if (carregando) return <div className="p-12 text-center text-sm font-bold text-gray-400">Iniciando Módulo Pastoral...</div>;

  return (
    <div className="min-h-screen bg-gray-50/30 p-4 md:p-8">
      
      {/* CABEÇALHO PARA IMPRESSÃO (PAPEL TIMBRADO) */}
      <div className="hidden print:block w-full bg-white mb-8 pb-6 border-b-2 border-gray-900">
        <div className="flex items-center">
          {configIgreja?.logo_url && <img src={configIgreja.logo_url} alt="Logo da Igreja" className="h-20 w-auto object-contain mr-6" />}
          <div className="flex-1">
            <h1 className="text-2xl font-black uppercase tracking-wider">{configIgreja?.nome_igreja || "Relatório Eclesiástico"}</h1>
            <p className="text-sm font-bold text-gray-600 uppercase tracking-widest mt-1">Gabinete Pastoral - Aba: {abaAtiva}</p>
          </div>
          <div className="text-right text-xs text-gray-600 font-bold border-l-2 border-gray-200 pl-4">
            <p>Gerado por: {usuarioAtual?.nome}</p>
            <p>Em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
          </div>
        </div>
      </div>

      {/* CABEÇALHO DA TELA (TELA NORMAL) */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Atendimento Pastoral</h1>
          <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Centro Integrado de Cuidados e Gestão</p>
        </div>
        
        {/* BOTÕES DE EXPORTAÇÃO RÁPIDOS */}
        <div className="flex flex-wrap gap-3">
          <button onClick={() => window.print()} className="flex-1 md:flex-none bg-gray-800 hover:bg-black text-white px-5 py-3 md:py-2.5 rounded-full text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2">
            📄 Gerar PDF
          </button>
          <button onClick={exportarCSV} className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-5 py-3 md:py-2.5 rounded-full text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2">
            📊 Exportar Excel
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS GLOBAIS COM GRID RESPONSIVO PARA NÃO PULAR DA TELA */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-6 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest hidden lg:block shrink-0">Filtros Globais:</span>
          
          <div className="grid grid-cols-2 lg:flex lg:flex-row gap-2 w-full">
            <select value={filtros.mes} onChange={e => setFiltros({...filtros, mes: e.target.value})} className="w-full lg:w-auto bg-gray-50 text-[11px] md:text-xs font-bold text-gray-700 px-3 py-2.5 rounded-xl border border-transparent hover:border-gray-200 outline-none transition-all cursor-pointer truncate">
              <option value="Todos">📅 Qualquer Mês</option>
              {Array.from({length: 12}).map((_, i) => <option key={i} value={i.toString()}>{format(new Date(2000, i, 1), "MMMM", {locale:ptBR})}</option>)}
            </select>
            
            <select disabled={!ehSede} value={filtros.congregacao} onChange={e => setFiltros({...filtros, congregacao: e.target.value})} className={`w-full lg:w-auto bg-gray-50 text-[11px] md:text-xs font-bold px-3 py-2.5 rounded-xl border border-transparent hover:border-gray-200 outline-none transition-all truncate ${ehSede ? "text-gray-700 cursor-pointer" : "text-gray-400 cursor-not-allowed opacity-70"}`}>
              {ehSede && <option value="Todas">⛪ Todas as Igrejas</option>}
              {opcoesCongregacao.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select value={filtros.cargo} onChange={e => setFiltros({...filtros, cargo: e.target.value})} className="w-full lg:w-auto bg-gray-50 text-[11px] md:text-xs font-bold text-gray-700 px-3 py-2.5 rounded-xl border border-transparent hover:border-gray-200 outline-none transition-all cursor-pointer truncate">
              <option value="Todos">👔 Todos Cargos</option>
              {opcoesCargo.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select value={filtros.publico} onChange={e => setFiltros({...filtros, publico: e.target.value})} className="w-full lg:w-auto bg-gray-50 text-[11px] md:text-xs font-bold text-gray-700 px-3 py-2.5 rounded-xl border border-transparent hover:border-gray-200 outline-none transition-all cursor-pointer truncate">
              <option value="Todos">👥 Todos Tipos</option>
              <option value="Membros">Apenas Membros</option>
              <option value="Outros">Apenas Visitantes</option>
            </select>
          </div>
        </div>
      </div>

      {/* MENU DE ABAS COLORIDAS */}
      <div className="flex overflow-x-auto pb-1 mb-6 gap-2 no-scrollbar print:hidden">
        {[
          { id: "agenda", rotulo: "Agenda", icone: "📅" },
          { id: "atendimentos", rotulo: "Gabinete", icone: "🛋️" },
          { id: "visitas", rotulo: "Visitas", icone: "🚗" },
          { id: "acompanhados", rotulo: "Acompanhamento", icone: "❤️" },
          { id: "anotacoes", rotulo: "Anotações", icone: "📝" }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setAbaAtiva(item.id)}
            className={`px-5 py-3 rounded-full font-bold text-[11px] uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
              abaAtiva === item.id 
              ? `${obterConfiguracaoAba(item.id).bgBtn} shadow-md transform scale-105` 
              : "bg-white text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            <span className="text-sm">{item.icone}</span> {item.rotulo}
          </button>
        ))}
      </div>

      {/* CORPO CENTRAL */}
      <div>
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

              {/* MÚLTIPLAS PESSOAS - COMPONENTE INTELIGENTE */}
              <div className="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/50">
                <label className="block text-[10px] font-black text-indigo-800 uppercase tracking-widest mb-3">Adicionar Pessoas ao Evento</label>
                
                <div className="relative mb-4">
                  <div className="flex bg-white border-2 border-indigo-100 rounded-xl overflow-hidden focus-within:border-indigo-400 transition-colors">
                    <span className="flex items-center justify-center pl-4 text-indigo-300">🔍</span>
                    <input type="text" placeholder="Digite o nome para buscar ou adicionar..." value={buscaMembro} onChange={e => setBuscaMembro(e.target.value)} className="w-full p-3 outline-none text-sm font-bold text-gray-700" />
                  </div>
                  
                  {buscaMembro.trim() !== "" && (
                     <ul className="absolute z-50 w-full bg-white border border-gray-200 shadow-xl max-h-48 overflow-y-auto mt-2 rounded-xl overflow-hidden divide-y divide-gray-50">
                        {membrosFiltradosBusca.map(m => (
                           <li key={m.id} onClick={() => addMembroLista(m)} className="p-3 hover:bg-indigo-50 cursor-pointer text-sm font-bold flex justify-between items-center group">
                              <span className="text-gray-800 group-hover:text-indigo-700">{m.nome_completo}</span>
                              <span className="text-[10px] font-black uppercase text-gray-400 bg-gray-100 px-2 py-1 rounded-md hidden sm:inline-block">{m.congregacao || 'Sede'}</span>
                           </li>
                        ))}
                        <li onClick={addVisitanteLista} className="p-3 bg-gray-50 hover:bg-indigo-600 hover:text-white cursor-pointer text-xs font-black text-indigo-600 transition-colors flex items-center justify-center gap-2">
                           ➕ ADD "{buscaMembro}" COMO VISITANTE
                        </li>
                     </ul>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                   {envolvidos.map((e, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-indigo-100 text-indigo-800 px-3 py-1.5 rounded-lg text-xs font-black shadow-sm">
                         {e.nome} {e.tipo === 'visitante' && <span className="bg-indigo-200 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-widest">Ext</span>}
                         <button onClick={() => removerEnvolvido(idx)} className="hover:text-red-500 ml-1 text-sm bg-indigo-200 w-5 h-5 rounded-md flex items-center justify-center">✕</button>
                      </div>
                   ))}
                   {envolvidos.length === 0 && <span className="text-xs font-bold text-gray-400">Ninguém adicionado ainda.</span>}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Resumo / Pauta (Opcional)</label>
                <input type="text" placeholder="Ex: Aconselhamento de Casal" value={formRegistro.assunto} onChange={e => setFormRegistro({...formRegistro, assunto: e.target.value})} className="w-full p-3 bg-gray-50 border-none rounded-xl text-sm font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>

            <div className="p-5 bg-white flex justify-end gap-3 border-t border-gray-50">
              <button disabled={salvando} onClick={salvarRegistro} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black rounded-full transition-all shadow-md transform hover:scale-[1.02]">
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

              {/* MÚLTIPLAS PESSOAS - COMPONENTE INTELIGENTE NO GABINETE */}
              <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100/50">
                <label className="block text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-3">Pessoas Atendidas</label>
                <div className="relative mb-4">
                  <div className="flex bg-white border-2 border-emerald-100 rounded-xl overflow-hidden focus-within:border-emerald-400 transition-colors">
                    <span className="flex items-center justify-center pl-4 text-emerald-300">🔍</span>
                    <input type="text" placeholder="Adicionar mais pessoas ao prontuário..." value={buscaMembro} onChange={e => setBuscaMembro(e.target.value)} className="w-full p-3 outline-none text-sm font-bold text-gray-700" />
                  </div>
                  {buscaMembro.trim() !== "" && (
                     <ul className="absolute z-50 w-full bg-white border border-gray-200 shadow-xl max-h-48 overflow-y-auto mt-2 rounded-xl overflow-hidden divide-y divide-gray-50">
                        {membrosFiltradosBusca.map(m => (
                           <li key={m.id} onClick={() => addMembroLista(m)} className="p-3 hover:bg-emerald-50 cursor-pointer text-sm font-bold flex justify-between items-center group">
                              <span className="text-gray-800 group-hover:text-emerald-700">{m.nome_completo}</span>
                           </li>
                        ))}
                        <li onClick={addVisitanteLista} className="p-3 bg-gray-50 hover:bg-emerald-600 hover:text-white cursor-pointer text-xs font-black text-emerald-600 transition-colors flex items-center justify-center gap-2">
                           ➕ ADD "{buscaMembro}" (VISITANTE)
                        </li>
                     </ul>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                   {envolvidos.map((e, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-black shadow-sm">
                         {e.nome} {e.tipo === 'visitante' && <span className="bg-emerald-200 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-widest">Ext</span>}
                         <button onClick={() => removerEnvolvido(idx)} className="hover:text-red-500 ml-1 text-sm bg-emerald-200 w-5 h-5 rounded-md flex items-center justify-center">✕</button>
                      </div>
                   ))}
                   {envolvidos.length === 0 && <span className="text-xs font-bold text-gray-400">Prontuário sem pessoas vinculadas.</span>}
                </div>
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
              <button disabled={salvando} onClick={salvarRegistro} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black rounded-full transition-all shadow-md transform hover:scale-[1.02]">
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

              {/* MÚLTIPLAS PESSOAS - COMPONENTE INTELIGENTE NA VISITA */}
              <div className="bg-sky-50/50 p-4 rounded-2xl border border-sky-100">
                <label className="block text-[10px] font-black text-sky-800 uppercase tracking-widest mb-3">Família / Pessoas Visitadas</label>
                <div className="relative mb-3">
                  <input type="text" placeholder="Buscar pessoa..." value={buscaMembro} onChange={e => setBuscaMembro(e.target.value)} className="w-full p-3 border-none bg-white shadow-sm rounded-xl outline-none text-sm font-bold text-gray-700 focus:ring-2 focus:ring-sky-400" />
                  {buscaMembro.trim() !== "" && (
                     <ul className="absolute z-50 w-full bg-white border border-gray-200 shadow-xl max-h-48 overflow-y-auto mt-2 rounded-xl overflow-hidden divide-y divide-gray-50">
                        {membrosFiltradosBusca.map(m => (
                           <li key={m.id} onClick={() => addMembroLista(m)} className="p-3 hover:bg-sky-50 cursor-pointer text-sm font-bold flex justify-between items-center group">
                              <span className="text-gray-800 group-hover:text-sky-700">{m.nome_completo}</span>
                           </li>
                        ))}
                        <li onClick={addVisitanteLista} className="p-3 bg-gray-50 hover:bg-sky-600 hover:text-white cursor-pointer text-xs font-black text-sky-600 transition-colors text-center">
                           ➕ ADCIONAR "{buscaMembro}"
                        </li>
                     </ul>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                   {envolvidos.map((e, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-sky-100 text-sky-800 px-3 py-1.5 rounded-lg text-xs font-black shadow-sm">
                         {e.nome}
                         <button onClick={() => removerEnvolvido(idx)} className="hover:text-red-500 ml-1 text-sm bg-sky-200 w-5 h-5 rounded-md flex items-center justify-center">✕</button>
                      </div>
                   ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Observações da Visita (Opcional)</label>
                <textarea rows={3} value={formRegistro.descricao} onChange={e => setFormRegistro({...formRegistro, descricao: e.target.value})} className="w-full p-3 bg-gray-50 border-none rounded-xl text-sm font-medium text-gray-700 outline-none resize-none" placeholder="Motivo da visita, orações feitas..."></textarea>
              </div>
            </div>

            <div className="p-5 bg-white border-t border-gray-50">
              <button disabled={salvando} onClick={salvarRegistro} className="w-full py-4 bg-sky-600 hover:bg-sky-700 text-white text-sm font-black rounded-full transition-all shadow-md">
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
              <h2 className="text-xl font-black text-gray-900">
                {formAnotacao.id ? "Editar Anotação" : "Nova Anotação"}
              </h2>
              <button onClick={() => setModalAnotacaoAberto(false)} className="text-amber-500 hover:text-red-500 font-bold text-xl transition-colors">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <input type="text" placeholder="Título da Nota" value={formAnotacao.titulo} onChange={e => setFormAnotacao({...formAnotacao, titulo: e.target.value})} className="w-full p-2 bg-transparent border-b-2 border-amber-200 outline-none focus:border-amber-500 font-black text-gray-800 text-lg" />
              <textarea rows={6} placeholder="Digite suas ideias livremente..." value={formAnotacao.texto} onChange={e => setFormAnotacao({...formAnotacao, texto: e.target.value})} className="w-full p-4 border border-transparent rounded-2xl bg-amber-50/50 outline-none text-gray-700 font-medium resize-none focus:border-amber-200" />
            </div>
            <div className="p-5 bg-[#fffbe6]/50">
              <button disabled={salvando} onClick={salvarAnotacao} className="w-full py-4 bg-amber-500 text-white text-sm font-black rounded-full hover:bg-amber-600 transition-all shadow-md">
                {salvando ? "Guardando..." : "Salvar no Bloco"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}