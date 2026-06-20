"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase"; 
import { podeVisualizar, podeEditar, formatarPerfis } from "../../lib/permissoes";

export default function ReunioesPage() {
  const router = useRouter();

  // 1. TODOS OS STATES NO TOPO (REGRA DO REACT)
  const [reunioes, setReunioes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [perfisUsuario, setPerfisUsuario] = useState<string[]>([]);

  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [bloqueioAta, setBloqueioAta] = useState(false);
  
  const [formData, setFormData] = useState({
    id: "",
    data_reuniao: "",
    horario_reuniao: "19:30", 
    tema: "",
    ata_texto: "",
    anexo_url: "",
    status: "Marcada",
    updated_at: "", 
  });

  const editorRef = useRef<HTMLDivElement>(null);

  // 2. EFFECT PRINCIPAL COM A TRAVA DE ROTA (SEGURANÇA TOTAL)
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

        // ==================================================
        // TRAVA DE ROTA: CHUTA INVASORES PARA A HOME
        // ==================================================
        if (!podeVisualizar(perfisLogado, 'reunioes')) {
          router.push("/");
          return; // Interrompe a execução
        }
        // ==================================================

        setPerfisUsuario(perfisLogado);
        const idIgrejaDetectado = parsedUser.igreja_id || parsedUser.id_igreja || parsedUser.idIgreja;
        
        if (idIgrejaDetectado && idIgrejaDetectado !== "undefined" && idIgrejaDetectado !== "null") {
          const idLimpo = String(idIgrejaDetectado).trim();
          setIgrejaId(idLimpo);
          buscarReunioes(idLimpo);
        } else {
          alert("Aviso de Sessão: Não identificamos o vínculo da Igreja. Por favor, saia do sistema e faça login novamente.");
          setCarregando(false);
        }
      } catch (error) {
        console.error("Erro ao ler dados de sessão:", error);
        setCarregando(false);
      }
    };

    carregarContexto();
  }, [router]);

  useEffect(() => {
    if (modalAberto && editorRef.current) {
      editorRef.current.innerHTML = formData.ata_texto || "";
    }
  }, [modalAberto, formData.id, bloqueioAta]);

  // 3. FUNÇÕES COMUNS
  const buscarReunioes = async (idIgreja: string) => {
    try {
      const { data, error } = await supabase
        .from("reunioes")
        .select("*")
        .eq("igreja_id", idIgreja) 
        .order("data_reuniao", { ascending: false });

      if (error) throw error;
      setReunioes(data || []);
    } catch (error) {
      console.error("Erro ao buscar listagem de reuniões:", error);
    } finally {
      setCarregando(false);
    }
  };

  const handleSalvar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!igrejaId || igrejaId === "undefined" || igrejaId === "null" || igrejaId.trim() === "") {
      alert("Erro de Gravação: O código identificador da igreja está inválido.");
      return;
    }

    setSalvando(true);
    try {
      const ataHtml = editorRef.current?.innerHTML || "";

      const dadosParaSalvar = {
        igreja_id: String(igrejaId).trim(), 
        data_reuniao: formData.data_reuniao,
        horario_reuniao: formData.horario_reuniao, 
        tema: formData.tema,
        ata_texto: ataHtml,
        anexo_url: formData.anexo_url || null, 
        status: formData.status,
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
                horario: formData.horario_reuniao 
              }).eq("reuniao_id", String(formData.id));
            } else {
              await supabase.from("programacao").insert([{
                igreja_id: String(igrejaId).trim(),
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
      buscarReunioes(igrejaId);
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

      buscarReunioes(igrejaId);
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
      ata_texto: "",
      anexo_url: "",
      status: "Marcada",
      updated_at: "",
    });
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
      ata_texto: reuniao.ata_texto || "",
      anexo_url: reuniao.anexo_url || "",
      status: reuniao.status,
      updated_at: reuniao.updated_at || reuniao.created_at || "",
    });
    
    // Se a reunião já aconteceu OU se o usuário NÃO é editor, tranca a ata inteira
    if (reuniao.status !== "Marcada" || !ehEditor) {
      setBloqueioAta(true);
    } else {
      setBloqueioAta(false);
    }
    
    setModalAberto(true);
  };

  const formatarDataHora = (isoString: string) => {
    if (!isoString) return "";
    const data = new Date(isoString);
    return data.toLocaleDateString('pt-BR') + ' às ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getCorStatus = (status: string) => {
    switch (status) {
      case "Marcada": return "bg-blue-100 text-blue-800";
      case "Realizada": return "bg-green-100 text-green-800";
      case "Cancelada": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // 4. RETORNOS
  if (carregando) return <div className="p-8 text-center text-gray-600 font-medium">Sincronizando Módulo de Reuniões...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Reuniões e Atas</h1>
          <p className="text-gray-500 text-sm">Controle de pautas, atas digitadas e arquivamento de digitalizações.</p>
        </div>
        
        {/* ESCONDE BOTÃO CADASTRAR SE NÃO FOR EDITOR */}
        {ehEditor && (
          <button onClick={abrirModalNovo} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg shadow-sm font-semibold transition-all w-full md:w-auto text-sm">
            + Agendar Reunião
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-700 uppercase text-xs font-bold tracking-wider border-b border-gray-200">
                <th className="px-6 py-4">Data / Horário</th>
                <th className="px-6 py-4">Tema / Grupo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Documentação</th>
                <th className="px-6 py-4 text-center">Gestão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reunioes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">
                    Nenhuma reunião registrada para esta igreja.
                  </td>
                </tr>
              ) : (
                reunioes.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 text-gray-900 font-semibold whitespace-nowrap">
                      <div>{new Date(r.data_reuniao).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</div>
                      <div className="text-xs text-gray-400 font-bold mt-0.5">{r.horario_reuniao ? r.horario_reuniao.substring(0, 5) : '--:--'}</div>
                    </td>
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
                      
                      {/* SÓ MOSTRA O BOTÃO DE CANCELAR SE A REUNIÃO ESTIVER MARCADA E O USUÁRIO FOR EDITOR */}
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
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/70 backdrop-blur-sm">
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-2">Data Marcada</label>
                    <input
                      type="date"
                      disabled={bloqueioAta}
                      value={formData.data_reuniao}
                      onChange={(e) => setFormData({ ...formData, data_reuniao: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500"
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

                <div className="border border-gray-300 rounded-lg overflow-hidden flex flex-col shadow-sm">
                  <div className="flex flex-wrap justify-between items-center bg-gray-50 px-4 py-2.5 border-b border-gray-300 gap-2">
                    <span className="block text-xs font-bold uppercase text-gray-700">Transcrição da Ata</span>
                    {/* SÓ MOSTRA O BOTÃO "HABILITAR EDIÇÃO" SE O USUÁRIO FOR EDITOR */}
                    {bloqueioAta && ehEditor && (
                      <button onClick={() => setBloqueioAta(false)} className="flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-100 px-3 py-1.5 rounded-md border border-blue-200 transition-colors shadow-sm">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        Habilitar Edição
                      </button>
                    )}
                  </div>
                  
                  {!bloqueioAta && (
                    <div className="flex flex-wrap gap-2 p-2 bg-gray-100/80 border-b border-gray-300 items-center">
                      <button onClick={() => formatarTexto("bold")} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-gray-200 font-bold text-sm shadow-sm transition-colors">N</button>
                      <button onClick={() => formatarTexto("italic")} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-gray-200 italic text-sm shadow-sm transition-colors">I</button>
                      <button onClick={() => formatarTexto("underline")} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-gray-200 underline text-sm shadow-sm transition-colors">S</button>
                      <div className="w-px h-6 bg-gray-300 mx-1"></div>
                      <button onClick={() => formatarTexto("insertUnorderedList")} className="px-3 h-8 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-gray-200 text-xs font-medium shadow-sm transition-colors">Lista ⚪</button>
                      <button onClick={() => formatarTexto("insertOrderedList")} className="px-3 h-8 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-gray-200 text-xs font-medium shadow-sm transition-colors">Lista 1.</button>
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

                {(!bloqueioAta || formData.anexo_url) && (
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-2">Anexar Ata Digitalizada</label>
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

                {formData.updated_at && (
                  <div className="text-right text-xs font-medium text-gray-400 italic">
                    Última alteração salva em: {formatarDataHora(formData.updated_at)}
                  </div>
                )}
              </div>

              <div className="p-4 md:p-5 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-xl">
                <button onClick={() => setModalAberto(false)} className="px-5 py-2.5 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-100 font-semibold text-sm transition-colors shadow-sm">
                  Voltar
                </button>
                
                {/* ESCONDE O BOTÃO SALVAR SE TIVER BLOQUEADO */}
                {!bloqueioAta && (
                  <button onClick={(e) => handleSalvar(e)} disabled={salvando || uploading} className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 shadow-md transition-colors">
                    {salvando ? "Salvando..." : "Salvar Reunião"}
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}