"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase"; 
import { podeVisualizar, podeEditar, formatarPerfis } from "../../lib/permissoes";

const meses = [
  { valor: 1, nome: "Janeiro" }, { valor: 2, nome: "Fevereiro" },
  { valor: 3, nome: "Março" }, { valor: 4, nome: "Abril" },
  { valor: 5, nome: "Maio" }, { valor: 6, nome: "Junho" },
  { valor: 7, nome: "Julho" }, { valor: 8, nome: "Agosto" },
  { valor: 9, nome: "Setembro" }, { valor: 10, nome: "Outubro" },
  { valor: 11, nome: "Novembro" }, { valor: 12, nome: "Dezembro" }
];

export default function ReunioesPage() {
  const router = useRouter();

  // 1. TODOS OS STATES NO TOPO (REGRA DO REACT)
  const [reunioesRaw, setReunioesRaw] = useState<any[]>([]);
  const [reunioes, setReunioes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [perfisUsuario, setPerfisUsuario] = useState<string[]>([]);
  const [configIgreja, setConfigIgreja] = useState<any>(null);

  // Estados de Filtro (Mês e Ano default = atuais)
  const dataAtual = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(dataAtual.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(dataAtual.getFullYear());

  // Estados de Multi-tenancy Hierárquico
  const [ehSede, setEhSede] = useState(false);
  const [nomeSedeOficial, setNomeSedeOficial] = useState("Sede");
  const [congregacaoUsuario, setCongregacaoUsuario] = useState("");
  const [filtroCongregacao, setFiltroCongregacao] = useState("Sede"); 
  const [congregacoesDisponiveis, setCongregacoesDisponiveis] = useState<string[]>([]);
  const [congregacaoForm, setCongregacaoForm] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [bloqueioAta, setBloqueioAta] = useState(false);
  
  const [formData, setFormData] = useState({
    id: "",
    data_reuniao: "",
    horario_reuniao: "19:30", 
    tema: "",
    local: "",
    responsavel: "",
    ata_texto: "",
    anexo_url: "",
    status: "Marcada",
    updated_at: "", 
    assinaturas_selecionadas: [] as string[],
  });

  const editorRef = useRef<HTMLDivElement>(null);

  // 2. EFFECT PRINCIPAL COM A TRAVA DE ROTA E HIERARQUIA
  useEffect(() => {
    const carregarContexto = async () => {
      try {
        const userLocal = localStorage.getItem("usuarioLogado");
        if (!userLocal) {
          router.push("/login");
          return;
        }

        const parsedUser = JSON.parse(userLocal);
        const perfisLogado = formatarPerfis(parsedUser.perfis || parsedUser.nivel_acesso);

        // TRAVA DE ROTA
        if (!podeVisualizar(perfisLogado, 'reunioes')) {
          router.push("/");
          return; 
        }

        setPerfisUsuario(perfisLogado);
        const idIgrejaDetectado = parsedUser.igreja_id || parsedUser.id_igreja || parsedUser.idIgreja;
        
        if (!idIgrejaDetectado || idIgrejaDetectado === "undefined" || idIgrejaDetectado === "null") {
          alert("Aviso de Sessão: Não identificamos o vínculo da Igreja. Faça login novamente.");
          setCarregando(false);
          return;
        }

        const idLimpo = String(idIgrejaDetectado).trim();
        setIgrejaId(idLimpo);

        // Busca Inteligente da Hierarquia E Configurações Completas
        const { data: config } = await supabase
          .from("configuracao_igreja")
          .select("*")
          .eq("igreja_id", idLimpo)
          .maybeSingle();

        setConfigIgreja(config);

        const nomeSede = config?.nome_igreja?.trim() || "Sede Principal";
        setNomeSedeOficial(nomeSede);

        const congUser = parsedUser?.congregacao?.trim() || "";
        setCongregacaoUsuario(congUser);
        
        const congLow = congUser.toLowerCase();
        const isUserSede = !congLow || congLow === "sede" || congLow === "matriz" || congLow === "geral" || congLow === nomeSede.toLowerCase();
        
        setEhSede(isUserSede);

        if (isUserSede) {
          const { data: filhas } = await supabase
            .from("igrejas_filhas")
            .select("nome")
            .eq("igreja_id", idLimpo)
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

        buscarReunioes(idLimpo, isUserSede ? null : congUser);
      } catch (error) {
        console.error("Erro ao ler dados de sessão:", error);
        setCarregando(false);
      }
    };

    carregarContexto();
  }, [router]);

  // Aplica o HTML do editor sempre que o modal abre
  useEffect(() => {
    if (modalAberto && editorRef.current) {
      editorRef.current.innerHTML = formData.ata_texto || "";
    }
  }, [modalAberto, formData.id, bloqueioAta]);


  // 3. FUNÇÕES DE DADOS E FILTROS
  const normalizarSede = (c: string) => {
    const cong = c?.trim();
    if (!cong || cong.toLowerCase() === "sede" || cong.toLowerCase() === "matriz" || cong.toLowerCase() === "geral" || cong.toLowerCase() === nomeSedeOficial.toLowerCase()) {
      return nomeSedeOficial;
    }
    return cong;
  };

  const buscarReunioes = async (idIgreja: string, filialTravada: string | null = null) => {
    try {
      let query = supabase
        .from("reunioes")
        .select("*")
        .eq("igreja_id", idIgreja) 
        .order("data_reuniao", { ascending: false });

      if (filialTravada) {
        query = query.eq("congregacao", filialTravada);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setReunioesRaw(data || []);
    } catch (error) {
      console.error("Erro ao buscar listagem de reuniões:", error);
    } finally {
      setCarregando(false);
    }
  };

  // Filtro de Tela Inteligente (Congregação + Mês + Ano)
  useEffect(() => {
    if (!reunioesRaw) return;
    
    const filtradas = reunioesRaw.filter(r => {
      // Regra 1: Congregação
      const congOk = filtroCongregacao === "Todas" || normalizarSede(r.congregacao) === filtroCongregacao;
      
      // Regra 2: Mês e Ano
      let mesOk = true;
      let anoOk = true;

      if (r.data_reuniao) {
        const [anoStr, mesStr] = r.data_reuniao.split('-');
        if (mesSelecionado !== 0) mesOk = parseInt(mesStr) === mesSelecionado;
        if (anoSelecionado !== 0) anoOk = parseInt(anoStr) === anoSelecionado;
      } else {
        if (mesSelecionado !== 0 || anoSelecionado !== 0) mesOk = false;
      }

      return congOk && mesOk && anoOk;
    });

    setReunioes(filtradas);
  }, [filtroCongregacao, reunioesRaw, nomeSedeOficial, mesSelecionado, anoSelecionado]);

  // Lista dinâmica de anos baseada nos dados (Garante que o ano atual sempre apareça)
  const anosDisponiveis = Array.from(new Set(reunioesRaw.map(r => r.data_reuniao ? r.data_reuniao.substring(0, 4) : null).filter(Boolean)));
  const anoAtualStr = String(dataAtual.getFullYear());
  if (!anosDisponiveis.includes(anoAtualStr)) {
    anosDisponiveis.push(anoAtualStr);
  }
  anosDisponiveis.sort((a, b) => Number(b) - Number(a)); // Ordem decrescente


  // --- SALVAMENTO E INTEGRAÇÕES ---
  const handleSalvar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!igrejaId || igrejaId === "undefined" || igrejaId === "null" || igrejaId.trim() === "") {
      alert("Erro de Gravação: O código identificador da igreja está inválido.");
      return;
    }

    const congregacaoFinal = ehSede ? congregacaoForm : congregacaoUsuario;
    if (!congregacaoFinal) {
      alert("Por favor, selecione a congregação responsável pela reunião.");
      return;
    }

    setSalvando(true);
    try {
      const ataHtml = editorRef.current?.innerHTML || "";

      const dadosParaSalvar = {
        igreja_id: String(igrejaId).trim(), 
        congregacao: congregacaoFinal, 
        data_reuniao: formData.data_reuniao,
        horario_reuniao: formData.horario_reuniao, 
        tema: formData.tema,
        local: formData.local,
        responsavel: formData.responsavel,
        ata_texto: ataHtml,
        anexo_url: formData.anexo_url || null, 
        status: formData.status,
        assinaturas_selecionadas: formData.assinaturas_selecionadas,
        updated_at: new Date().toISOString(), 
      };

      if (formData.id && formData.id !== "undefined" && formData.id.trim() !== "") {
        // ATUALIZAÇÃO
        const { error } = await supabase.from("reunioes").update(dadosParaSalvar).eq("id", formData.id).eq("igreja_id", igrejaId); 
        if (error) throw error;

        // --- INTEGRAÇÃO COM MÓDULO DE PROGRAMAÇÃO ---
        try {
          if (formData.status === "Cancelada") {
            await supabase.from("programacao").delete().eq("reuniao_id", String(formData.id)).eq("igreja_id", igrejaId);
          } else {
            const { data: progData } = await supabase.from("programacao").select("id").eq("reuniao_id", String(formData.id)).single();
            if (progData) {
              await supabase.from("programacao").update({
                titulo: `Reunião: ${formData.tema}`,
                data: formData.data_reuniao,
                horario: formData.horario_reuniao,
                congregacao: congregacaoFinal 
              }).eq("reuniao_id", String(formData.id));
            } else {
              await supabase.from("programacao").insert([{
                igreja_id: String(igrejaId).trim(),
                congregacao: congregacaoFinal,
                titulo: `Reunião: ${formData.tema}`,
                descricao: "Gerado automaticamente pelo Módulo de Reuniões",
                tipo: "Reunião",
                data: formData.data_reuniao,
                horario: formData.horario_reuniao, 
                reuniao_id: String(formData.id)
              }]);
            }
          }
        } catch (err) { 
          console.error("Falha ao atualizar a programação espelho.", err); 
        }

      } else {
        // INSERÇÃO NOVA
        const { data: insertedData, error } = await supabase.from("reunioes").insert([dadosParaSalvar]).select();
        if (error) throw error;

        // --- INTEGRAÇÃO COM MÓDULO DE PROGRAMAÇÃO ---
        try {
          if (insertedData && insertedData.length > 0) {
            const novaReuniaoId = insertedData[0].id;
            await supabase.from("programacao").insert([{
              igreja_id: String(igrejaId).trim(),
              congregacao: congregacaoFinal,
              titulo: `Reunião: ${formData.tema}`,
              descricao: "Gerado automaticamente pelo Módulo de Reuniões",
              tipo: "Reunião",
              data: formData.data_reuniao,
              horario: formData.horario_reuniao, 
              reuniao_id: String(novaReuniaoId)
            }]);
          }
        } catch (err) { 
          console.error("Aviso: Sincronização com programação falhou.", err); 
        }
      }

      setModalAberto(false);
      buscarReunioes(igrejaId, ehSede ? null : congregacaoUsuario);
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      alert(`Falha ao salvar no banco de dados: ${error?.message || 'Verifique a conexão.'}`);
    } finally {
      setSalvando(false);
    }
  };

  const handleCancelarReuniao = async (id: string) => {
    if (!confirm("Tem certeza que deseja marcar esta reunião como Cancelada?")) return;
    if (!igrejaId) return;

    try {
      const { error } = await supabase.from("reunioes").update({ status: "Cancelada", updated_at: new Date().toISOString() }).eq("id", id).eq("igreja_id", igrejaId);
      if (error) throw error;

      try {
        await supabase.from("programacao").delete().eq("reuniao_id", String(id)).eq("igreja_id", igrejaId);
      } catch (err) { console.error("Erro ao limpar programação:", err); }

      buscarReunioes(igrejaId, ehSede ? null : congregacaoUsuario);
    } catch (error) {
      console.error("Erro ao cancelar:", error);
      alert("Não foi possível cancelar a reunião.");
    }
  };

  const handleUploadAnexo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !igrejaId) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${igrejaId}/${fileName}`; 

      const { error } = await supabase.storage.from('anexos_reunioes').upload(filePath, file);
      if (error) throw error;

      const { data: publicUrlData } = supabase.storage.from('anexos_reunioes').getPublicUrl(filePath);
      setFormData((prev) => ({ ...prev, anexo_url: publicUrlData.publicUrl }));
    } catch (error) {
      console.error("Erro durante o upload:", error);
      alert("Erro ao enviar arquivo.");
    } finally {
      setUploading(false);
    }
  };

  const formatarTexto = (comando: string) => {
    if (bloqueioAta) return;
    document.execCommand(comando, false, undefined);
    editorRef.current?.focus();
  };

  const abrirModalNovo = () => {
    setFormData({
      id: "",
      data_reuniao: new Date().toISOString().split("T")[0],
      horario_reuniao: "19:30", 
      tema: "",
      local: "",
      responsavel: "",
      ata_texto: "",
      anexo_url: "",
      status: "Marcada",
      updated_at: "",
      assinaturas_selecionadas: [],
    });
    setCongregacaoForm(ehSede ? nomeSedeOficial : congregacaoUsuario);
    setBloqueioAta(false); 
    setModalAberto(true);
  };

  const ehEditor = podeEditar(perfisUsuario, 'reunioes');

  const abrirModalEditar = (reuniao: any) => {
    setFormData({
      id: reuniao.id,
      data_reuniao: reuniao.data_reuniao,
      horario_reuniao: reuniao.horario_reuniao ? reuniao.horario_reuniao.substring(0, 5) : "19:30", 
      tema: reuniao.tema,
      local: reuniao.local || "",
      responsavel: reuniao.responsavel || "",
      ata_texto: reuniao.ata_texto || "",
      anexo_url: reuniao.anexo_url || "",
      status: reuniao.status,
      updated_at: reuniao.updated_at || reuniao.created_at || "",
      assinaturas_selecionadas: reuniao.assinaturas_selecionadas || [],
    });
    
    setCongregacaoForm(normalizarSede(reuniao.congregacao));

    // Se a reunião já aconteceu OU se o usuário NÃO é editor, tranca a ata inteira
    if (reuniao.status !== "Marcada" || !ehEditor) {
      setBloqueioAta(true);
    } else {
      setBloqueioAta(false);
    }
    
    setModalAberto(true);
  };

  const getCorStatus = (status: string) => {
    switch (status) {
      case "Marcada": return "bg-blue-100 text-blue-800";
      case "Realizada": return "bg-green-100 text-green-800";
      case "Cancelada": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Prepara as assinaturas que serão mostradas no PDF
  const assinaturasParaImprimir = configIgreja?.assinaturas?.filter((a: any) => formData.assinaturas_selecionadas.includes(a.id)) || [];

  // 4. RETORNOS
  if (carregando) return <div className="p-8 text-center text-gray-600 font-medium animate-pulse">Sincronizando Módulo de Reuniões...</div>;

  return (
    <>
      <div className="print:hidden p-6 max-w-7xl mx-auto w-full">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Reuniões e Atas</h1>
            <p className="text-gray-500 text-sm">Controle de pautas, atas digitadas e arquivamento de digitalizações.</p>
          </div>
          
          {/* BARRA DE FILTROS E AÇÕES */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            
            {/* SELETOR HIERÁRQUICO DA TELA INICIAL */}
            {ehSede && congregacoesDisponiveis.length > 0 && (
              <select
                value={filtroCongregacao}
                onChange={(e) => setFiltroCongregacao(e.target.value)}
                className="w-full sm:w-auto max-w-full truncate px-4 py-2.5 bg-indigo-50 border border-indigo-100 text-indigo-800 font-bold text-sm rounded-lg hover:border-indigo-300 focus:border-indigo-500 outline-none transition-all shadow-sm cursor-pointer"
              >
                <option value="Todas">🌍 Todas as Congregações</option>
                <option value={nomeSedeOficial}>🏢 {nomeSedeOficial} (Sede)</option>
                {congregacoesDisponiveis.filter(c => c !== nomeSedeOficial).map(c => (
                  <option key={c} value={c}>📍 {c}</option>
                ))}
              </select>
            )}

            {/* SELETOR DE MÊS */}
            <select
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(Number(e.target.value))}
              className="w-full sm:w-auto px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold text-sm rounded-lg hover:border-gray-300 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer"
            >
              <option value={0}>Todos os Meses</option>
              {meses.map(m => (
                <option key={m.valor} value={m.valor}>{m.nome}</option>
              ))}
            </select>

            {/* SELETOR DE ANO */}
            <select
              value={anoSelecionado}
              onChange={(e) => setAnoSelecionado(Number(e.target.value))}
              className="w-full sm:w-auto px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold text-sm rounded-lg hover:border-gray-300 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer"
            >
              <option value={0}>Todos os Anos</option>
              {anosDisponiveis.map(ano => (
                <option key={String(ano)} value={ano}>{ano}</option>
              ))}
            </select>

            {/* ESCONDE BOTÃO CADASTRAR SE NÃO FOR EDITOR */}
            {ehEditor && (
              <button onClick={abrirModalNovo} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg shadow-sm font-semibold transition-all w-full sm:w-auto text-sm">
                + Agendar Reunião
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-700 uppercase text-xs font-bold tracking-wider border-b border-gray-200">
                  <th className="px-6 py-4">Data / Horário</th>
                  {filtroCongregacao === "Todas" && <th className="px-6 py-4 text-gray-500">Congregação</th>}
                  <th className="px-6 py-4">Tema / Grupo</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Documentação</th>
                  <th className="px-6 py-4 text-center">Gestão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reunioes.length === 0 ? (
                  <tr>
                    <td colSpan={filtroCongregacao === "Todas" ? 6 : 5} className="px-6 py-12 text-center text-gray-400 font-medium">
                      Nenhuma reunião registrada neste período e congregação.
                    </td>
                  </tr>
                ) : (
                  reunioes.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4 text-gray-900 font-semibold whitespace-nowrap">
                        <div>{new Date(r.data_reuniao).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</div>
                        <div className="text-xs text-gray-400 font-bold mt-0.5">{r.horario_reuniao ? r.horario_reuniao.substring(0, 5) : '--:--'}</div>
                      </td>
                      
                      {filtroCongregacao === "Todas" && (
                        <td className="px-6 py-4 text-gray-500 text-sm font-medium">
                          {normalizarSede(r.congregacao)}
                        </td>
                      )}

                      <td className="px-6 py-4 text-gray-600 font-medium">{r.tema}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getCorStatus(r.status)}`}>{r.status}</span>
                      </td>
                      <td className="px-6 py-4">
                        {r.anexo_url ? (
                          <a href={r.anexo_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 font-semibold text-sm underline transition-colors">
                            Visualizar Anexo
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Sem arquivo anexado</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center flex items-center justify-center gap-4">
                        <button onClick={() => abrirModalEditar(r)} className="text-blue-600 hover:text-blue-800 font-bold text-sm transition-colors">
                          {(!ehEditor || r.status !== 'Marcada') ? 'Ver Ata' : 'Editar'}
                        </button>
                        
                        {r.status === "Marcada" && ehEditor && (
                          <button onClick={() => handleCancelarReuniao(r.id)} className="text-red-600 hover:text-red-900 font-bold text-sm transition-colors">
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL GERAL (VISUALIZAR / EDITAR / CRIAR) */}
        {modalAberto && (
          <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/70 backdrop-blur-sm print:hidden">
            <div className="flex min-h-screen items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl my-8 relative">
                
                <div className="p-5 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                      {!ehEditor 
                        ? "Visualizar Reunião" 
                        : formData.id ? "Ajustar Informações da Reunião" : "Agendar Nova Reunião"}
                    </h2>
                    <button onClick={() => setModalAberto(false)} className="text-gray-400 hover:text-red-600 text-3xl font-light transition-colors">
                      &times;
                    </button>
                  </div>
                </div>

                <div className="p-5 md:p-6 space-y-6">
                  
                  {/* SELETOR DE CONGREGAÇÃO */}
                  <div className="mb-2">
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-2">Congregação Responsável *</label>
                    {ehSede ? (
                      <select 
                        required
                        value={congregacaoForm}
                        onChange={(e) => setCongregacaoForm(e.target.value)}
                        disabled={bloqueioAta}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 font-bold cursor-pointer disabled:bg-gray-100 disabled:text-gray-500"
                      >
                        <option value="" disabled>Selecione a Congregação</option>
                        {congregacoesDisponiveis.map((c) => (
                          <option key={c} value={c}>{c === nomeSedeOficial ? `🏢 ${c} (Sede)` : `📍 ${c}`}</option>
                        ))}
                      </select>
                    ) : (
                      <select 
                        disabled
                        className="w-full px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-lg outline-none text-sm text-gray-500 font-bold cursor-not-allowed"
                      >
                        <option value={congregacaoUsuario}>📍 {congregacaoUsuario}</option>
                      </select>
                    )}
                  </div>

                  {/* GRID DO CABEÇALHO REESTRUTURADO */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-600 mb-2">Data Marcada</label>
                      <input
                        type="date"
                        disabled={bloqueioAta}
                        value={formData.data_reuniao}
                        onChange={(e) => setFormData({ ...formData, data_reuniao: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-600 mb-2">Horário de Início</label>
                      <input
                        type="time"
                        required
                        disabled={bloqueioAta}
                        value={formData.horario_reuniao}
                        onChange={(e) => setFormData({ ...formData, horario_reuniao: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500 bg-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-600 mb-2">Local da Reunião</label>
                      <input
                        type="text"
                        disabled={bloqueioAta}
                        placeholder="Ex: Sala 02, Salão Principal..."
                        value={formData.local}
                        onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-600 mb-2">Tema / Departamento</label>
                      <input
                        type="text"
                        disabled={bloqueioAta}
                        placeholder="Ex: Líderes, EBD..."
                        value={formData.tema}
                        onChange={(e) => setFormData({ ...formData, tema: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-600 mb-2">Responsável Pela Reunião</label>
                      <input
                        type="text"
                        disabled={bloqueioAta}
                        placeholder="Ex: Pr. João, Liderança..."
                        value={formData.responsavel}
                        onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-600 mb-2">Status do Trabalho</label>
                      <select
                        value={formData.status}
                        disabled={bloqueioAta}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-all disabled:bg-gray-100 disabled:text-gray-500"
                      >
                        <option value="Marcada">Marcada</option>
                        <option value="Realizada">Realizada</option>
                        <option value="Cancelada">Cancelada</option>
                      </select>
                    </div>
                  </div>

                  {/* TRANSCRIÇÃO DA ATA */}
                  <div className="border border-gray-300 rounded-lg overflow-hidden flex flex-col shadow-sm">
                    <div className="flex flex-wrap justify-between items-center bg-gray-50 px-4 py-2.5 border-b border-gray-300 gap-2">
                      <span className="block text-xs font-bold uppercase text-gray-700">Transcrição da Ata</span>
                      {bloqueioAta && ehEditor && (
                        <button onClick={() => setBloqueioAta(false)} className="flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-100 px-3 py-1.5 rounded-md border border-blue-200 transition-colors shadow-sm">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          Habilitar Edição
                        </button>
                      )}
                    </div>
                    
                    {!bloqueioAta && (
                      <div className="flex flex-wrap gap-2 p-2 bg-gray-100/80 border-b border-gray-300 items-center">
                        <button type="button" onClick={() => formatarTexto("bold")} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-gray-200 font-bold text-sm shadow-sm transition-colors">N</button>
                        <button type="button" onClick={() => formatarTexto("italic")} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-gray-200 italic text-sm shadow-sm transition-colors">I</button>
                        <button type="button" onClick={() => formatarTexto("underline")} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-gray-200 underline text-sm shadow-sm transition-colors">S</button>
                        <div className="w-px h-6 bg-gray-300 mx-1"></div>
                        <button type="button" onClick={() => formatarTexto("insertUnorderedList")} className="px-3 h-8 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-gray-200 text-xs font-medium shadow-sm transition-colors">Lista ⚪</button>
                        <button type="button" onClick={() => formatarTexto("insertOrderedList")} className="px-3 h-8 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-gray-200 text-xs font-medium shadow-sm transition-colors">Lista 1.</button>
                      </div>
                    )}

                    <div
                      ref={editorRef}
                      contentEditable={!bloqueioAta}
                      className={`w-full min-h-[250px] max-h-[400px] overflow-y-auto p-4 focus:outline-none prose max-w-none text-sm leading-relaxed transition-colors ${bloqueioAta ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-800'}`}
                      onBlur={() => {
                        if (editorRef.current && !bloqueioAta) {
                           setFormData(prev => ({ ...prev, ata_texto: editorRef.current ? editorRef.current.innerHTML : prev.ata_texto }));
                        }
                      }}
                    ></div>
                  </div>

                  {/* BLOCO DE ASSINATURAS */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-3">Assinaturas do Documento (Exportação em PDF)</label>
                    {configIgreja?.assinaturas && configIgreja.assinaturas.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {configIgreja.assinaturas.map((ass: any) => (
                          <label key={ass.id} className={`flex items-center gap-2 cursor-pointer px-4 py-2 border rounded-lg shadow-sm transition-all ${formData.assinaturas_selecionadas.includes(ass.id) ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-300 hover:border-gray-400'}`}>
                            <input
                              type="checkbox"
                              disabled={bloqueioAta}
                              checked={formData.assinaturas_selecionadas.includes(ass.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData(prev => ({ ...prev, assinaturas_selecionadas: [...prev.assinaturas_selecionadas, ass.id] }));
                                } else {
                                  setFormData(prev => ({ ...prev, assinaturas_selecionadas: prev.assinaturas_selecionadas.filter(id => id !== ass.id) }));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                            />
                            <span className="text-sm font-semibold text-gray-700">{ass.titulo}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic">Nenhuma assinatura digital configurada. Vá até as Configurações Globais da Igreja para cadastrá-las.</p>
                    )}
                  </div>

                  {/* ANEXOS */}
                  {(!bloqueioAta || formData.anexo_url) && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <label className="block text-xs font-bold uppercase text-gray-600 mb-2">Anexar Ata Digitalizada Manual</label>
                      <div className="flex flex-wrap items-center gap-4">
                        {!bloqueioAta && (
                          <input
                            type="file"
                            disabled={bloqueioAta}
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={handleUploadAnexo}
                            className="block text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer disabled:opacity-50 transition-all w-full md:w-auto"
                          />
                        )}
                        {uploading && <span className="text-blue-600 text-xs font-bold animate-pulse">Enviando documento...</span>}
                      </div>
                      {formData.anexo_url && !uploading && (
                        <p className="mt-3 text-xs text-green-600 font-bold flex items-center gap-1">✓ Documento anexado no servidor. (Link na listagem)</p>
                      )}
                    </div>
                  )}

                  {/* Mostrar Data da Última Edição */}
                  {formData.updated_at && (
                    <div className="text-right text-xs font-medium text-gray-400 italic">
                      Última alteração salva em: {new Date(formData.updated_at).toLocaleDateString('pt-BR')} às {new Date(formData.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>

                <div className="p-4 md:p-5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 rounded-b-xl">
                  
                  {/* BOTÃO GERAR PDF (ESQUERDA) */}
                  <button type="button" onClick={() => window.print()} className="w-full sm:w-auto px-5 py-2.5 bg-gray-800 text-white rounded-lg shadow-sm hover:bg-gray-900 font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Gerar PDF da Ata
                  </button>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button type="button" onClick={() => setModalAberto(false)} className="w-full sm:w-auto px-5 py-2.5 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-100 font-semibold text-sm transition-colors shadow-sm">
                      Voltar
                    </button>
                    
                    {!bloqueioAta && (
                      <button onClick={(e) => handleSalvar(e)} disabled={salvando || uploading} className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 shadow-md transition-colors">
                        {salvando ? "Salvando..." : "Salvar Reunião"}
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================================================== */}
      {/* LAYOUT DE IMPRESSÃO EM PDF (SÓ APARECE AO IMPRIMIR) */}
      {/* ================================================== */}
      {modalAberto && (
        <div className="hidden print:flex flex-col min-h-screen bg-white text-black font-sans px-8 py-10 w-full relative z-[100000]">
          
          {/* Cabeçalho Oficial */}
          <div className="flex items-center border-b-2 border-black pb-4 mb-6">
            {configIgreja?.logo_url && (
              <img src={configIgreja.logo_url} alt="Logo" className="h-16 w-auto object-contain mr-6" crossOrigin="anonymous" />
            )}
            <div>
              <h1 className="text-xl font-bold uppercase tracking-wide">{configIgreja?.nome_igreja || "Nome da Igreja"}</h1>
              <p className="text-xs uppercase text-gray-800 font-semibold">{configIgreja?.cnpj ? `CNPJ: ${configIgreja.cnpj}` : "MINISTÉRIO / CONGREGAÇÃO"}</p>
              <p className="text-xs text-gray-600">
                {configIgreja?.endereco_rua || ""}, {configIgreja?.endereco_numero || "S/N"} - {configIgreja?.endereco_cidade_uf || "Cidade/UF"}
              </p>
            </div>
          </div>

          <h2 className="text-center text-2xl font-bold mb-6 uppercase tracking-widest underline decoration-2 underline-offset-4">Ata de Reunião Oficial</h2>

          {/* Dados do Cabeçalho da Reunião */}
          <div className="grid grid-cols-2 gap-y-3 gap-x-8 mb-8 border-2 border-gray-800 p-5 rounded-lg bg-gray-50/30 break-inside-avoid">
            <p className="text-sm"><span className="font-bold uppercase text-gray-900 mr-2">Tema / Pauta:</span> {formData.tema || "-"}</p>
            <p className="text-sm"><span className="font-bold uppercase text-gray-900 mr-2">Congregação:</span> {congregacaoForm || "-"}</p>
            <p className="text-sm"><span className="font-bold uppercase text-gray-900 mr-2">Data e Hora:</span> {formData.data_reuniao ? formData.data_reuniao.split('-').reverse().join('/') : "-"} às {formData.horario_reuniao}</p>
            <p className="text-sm"><span className="font-bold uppercase text-gray-900 mr-2">Local:</span> {formData.local || "-"}</p>
            <p className="text-sm col-span-2"><span className="font-bold uppercase text-gray-900 mr-2">Responsável Pela Reunião:</span> {formData.responsavel || "-"}</p>
          </div>

          {/* Conteúdo / Transcrição */}
          <div className="flex-grow">
            <h3 className="font-bold uppercase text-gray-900 border-b border-gray-400 pb-2 mb-4">Registro / Deliberações</h3>
            <div 
              className="prose max-w-none text-justify text-sm leading-relaxed text-black" 
              dangerouslySetInnerHTML={{ __html: formData.ata_texto || "<p><i>Nenhuma ata registrada para esta reunião.</i></p>" }}
            ></div>
          </div>

          {/* Área das Assinaturas */}
          {assinaturasParaImprimir.length > 0 && (
            <div className="mt-auto pt-16 pb-8 flex flex-wrap justify-center gap-12 md:gap-24 break-inside-avoid w-full">
              {assinaturasParaImprimir.map((ass: any) => (
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
        </div>
      )}
    </>
  );
}