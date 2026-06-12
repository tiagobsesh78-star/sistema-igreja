"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  parseISO
} from "date-fns";
import { ptBR } from "date-fns/locale";

export default function NovaEscala() {
  const router = useRouter();
  
  const [salvando, setSalvando] = useState(false);
  const [modalSucesso, setModalSucesso] = useState(false);
  
  const [tipo, setTipo] = useState("Culto");
  const [tipoOutro, setTipoOutro] = useState("");
  
  const [mesCalendario, setMesCalendario] = useState(new Date());
  const [datasSelecionadas, setDatasSelecionadas] = useState<string[]>([]);
  const [dataExpandida, setDataExpandida] = useState<string | null>(null);
  
  const [dadosPorData, setDadosPorData] = useState<Record<string, any[]>>({});
  const [descricoesPorData, setDescricoesPorData] = useState<Record<string, string>>({}); // NOVO ESTADO PARA DESCRIÇÃO

  const inicioMes = startOfMonth(mesCalendario);
  const fimMes = endOfMonth(mesCalendario);
  const diasDoCalendario = eachDayOfInterval({
    start: startOfWeek(inicioMes),
    end: endOfWeek(fimMes)
  });

  const toggleDataStr = (dataStr: string) => {
    if (datasSelecionadas.includes(dataStr)) {
      const novasDatas = datasSelecionadas.filter(d => d !== dataStr);
      setDatasSelecionadas(novasDatas);
      
      const novosDados = { ...dadosPorData };
      delete novosDados[dataStr];
      setDadosPorData(novosDados);

      const novasDescricoes = { ...descricoesPorData };
      delete novasDescricoes[dataStr];
      setDescricoesPorData(novasDescricoes);
      
      if (dataExpandida === dataStr) {
        setDataExpandida(null);
      }
    } else {
      const novasDatas = [...datasSelecionadas, dataStr].sort();
      setDatasSelecionadas(novasDatas);
      
      let camposIniciais: any[] = [];
      if (tipo === "Culto") {
        camposIniciais = [
          { id: 1, funcao: "Dirigente", nome: "" },
          { id: 2, funcao: "Pregador", nome: "" }
        ];
      } else if (tipo === "EBD" || tipo === "DEPIN") {
        camposIniciais = [{ id: 1, sala: "", professor: "", auxiliar: "" }];
      } else if (tipo === "Louvor") {
        camposIniciais = [{ id: 1, instrumento: "Voz", instrumento_outro: "", nome: "" }];
      } else {
        camposIniciais = [{ id: 1, funcao: "", nome: "" }];
      }
      
      setDadosPorData({ ...dadosPorData, [dataStr]: camposIniciais });
      setDescricoesPorData({ ...descricoesPorData, [dataStr]: "" });
      
      if (novasDatas.length === 1) {
        setDataExpandida(dataStr);
      }
    }
  };

  const atualizarCampo = (data: string, idLinha: number, campo: string, valor: string) => {
    const linesAtualizadas = dadosPorData[data].map(linha => {
      if (linha.id === idLinha) {
        return { ...linha, [campo]: valor };
      }
      return linha;
    });
    setDadosPorData({ ...dadosPorData, [data]: linesAtualizadas });
  };

  const adicionarLinha = (data: string) => {
    const linhasAtuais = dadosPorData[data];
    const novoId = Math.max(...linhasAtuais.map((l: any) => l.id)) + 1;
    
    let novaLinha = {};
    if (tipo === "Louvor") {
      novaLinha = { id: novoId, instrumento: "Voz", nome: "" };
    } else if (tipo === "EBD" || tipo === "DEPIN") {
      novaLinha = { id: novoId, sala: "", professor: "", auxiliar: "" };
    } else {
      novaLinha = { id: novoId, funcao: "", nome: "" };
    }
    
    setDadosPorData({ ...dadosPorData, [data]: [...linhasAtuais, novaLinha] });
  };

  const removerLinha = (data: string, idLinha: number) => {
    const linhasFiltradas = dadosPorData[data].filter((l: any) => l.id !== idLinha);
    setDadosPorData({ ...dadosPorData, [data]: linhasFiltradas });
  };

  const salvarEscalas = async () => {
    if (datasSelecionadas.length === 0) {
      alert("Selecione os dias da escala no calendário primeiro!");
      return;
    }
    
    setSalvando(true);
    
    try {
      const inserts = datasSelecionadas.map(d => ({
        tipo: tipo,
        tipo_personalizado: tipo === "Outro" ? tipoOutro : null,
        data: d,
        detalhes: dadosPorData[d],
        descricao: descricoesPorData[d] || null // ENVIA A DESCRIÇÃO PARA O BANCO
      }));
      
      const { error } = await supabase.from("escalas").insert(inserts);
      if (error) throw error;
      
      setModalSucesso(true);
      
      setTimeout(() => {
        router.push("/escalas");
      }, 1500);

    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
      setSalvando(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto animate-fade-in pb-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl md:text-[28px] font-bold text-gray-900 tracking-tight">Criar Escala</h1>
          <p className="text-sm text-gray-500 mt-1">Configure o tipo, os dias e preencha os nomes.</p>
        </div>
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 font-medium">
          Voltar
        </button>
      </div>

      <div className="space-y-8">
        
        {/* PASSO 1: TIPO */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
          <label className="block text-sm font-bold text-gray-700 mb-4 uppercase tracking-tighter">
            1. Tipo de Escala
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select 
              value={tipo} 
              onChange={(e) => {
                setTipo(e.target.value); 
                setDatasSelecionadas([]); 
                setDadosPorData({});
                setDescricoesPorData({});
              }} 
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition"
            >
              <option value="Culto">Culto</option>
              <option value="EBD">EBD (Escola Bíblica)</option>
              <option value="Louvor">Louvor</option>
              <option value="DEPIN">DEPIN (Infantil)</option>
              <option value="Outro">Outro...</option>
            </select>
            
            {tipo === "Outro" && (
              <input 
                type="text" 
                value={tipoOutro} 
                onChange={(e) => setTipoOutro(e.target.value)} 
                placeholder="Qual o tipo de escala?" 
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none transition" 
              />
            )}
          </div>
        </div>

        {/* PASSO 2: CALENDÁRIO */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
          <label className="block text-sm font-bold text-gray-700 mb-4 uppercase tracking-tighter">
            2. Selecione os Dias do Mês
          </label>
          <div className="flex flex-col md:flex-row gap-8 items-start">
            
            {/* Calendário Redondo */}
            <div className="w-full md:w-[320px] bg-white border border-gray-100 shadow-sm rounded-2xl p-5 flex-shrink-0">
              <div className="flex justify-between items-center mb-6">
                <button type="button" onClick={() => setMesCalendario(subMonths(mesCalendario, 1))} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">
                  {format(mesCalendario, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <button type="button" onClick={() => setMesCalendario(addMonths(mesCalendario, 1))} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', marginBottom: '12px' }}>
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                  <div key={i} className="text-[10px] font-black text-gray-400 uppercase">{d}</div>
                ))}
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center' }}>
                {diasDoCalendario.map((dia, index) => {
                  const dataStr = format(dia, "yyyy-MM-dd");
                  const isSelecionado = datasSelecionadas.includes(dataStr);
                  const isMesmoMes = isSameMonth(dia, mesCalendario);

                  if (!isMesmoMes) return <div key={index} className="h-9 w-9"></div>;

                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => toggleDataStr(dataStr)}
                      className={`h-9 w-9 mx-auto flex items-center justify-center rounded-full text-sm transition-all duration-200 ${
                        isSelecionado
                          ? 'bg-teal-600 text-white font-bold shadow-md transform scale-110'
                          : 'text-gray-700 hover:bg-teal-50 hover:text-teal-700 border border-transparent'
                      }`}
                    >
                      {format(dia, 'd')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lista de Selecionados */}
            <div className="flex-1 w-full bg-gray-50/50 rounded-2xl p-6 border border-dashed border-gray-200 h-full min-h-[200px]">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                Dias Selecionados ({datasSelecionadas.length})
              </p>
              
              {datasSelecionadas.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {datasSelecionadas.map(d => (
                    <div key={d} className="flex items-center gap-2 bg-white border border-teal-200 shadow-sm text-teal-800 px-4 py-2 rounded-full text-sm font-bold animate-fade-in">
                      {format(parseISO(d), "dd/MM/yyyy")}
                      <button type="button" onClick={() => toggleDataStr(d)} className="text-teal-400 hover:text-red-500 transition-colors ml-1">✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center h-full text-gray-400 space-y-3 pt-6">
                  <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <p className="text-sm">Clique nos dias do calendário para adicionar à escala.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PASSO 3: PREENCHIMENTO */}
        {datasSelecionadas.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800 mb-4 px-2">3. Preencha os Responsáveis</h2>
            
            {datasSelecionadas.map((data, idx) => {
              const isExpandida = dataExpandida === data;

              return (
                <div key={data} className={`bg-white rounded-2xl border transition-colors duration-200 overflow-hidden ${isExpandida ? 'border-teal-500 shadow-md ring-1 ring-teal-500' : 'border-gray-200 hover:border-teal-300 shadow-sm'}`}>
                  
                  <button onClick={() => setDataExpandida(isExpandida ? null : data)} className="w-full px-6 py-4 flex justify-between items-center bg-gray-50/30">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isExpandida ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                        {idx + 1}
                      </div>
                      <span className="font-bold text-gray-800 text-lg">
                        Escala de {format(parseISO(data), "dd/MM/yyyy")}
                      </span>
                    </div>
                    <svg className={`w-6 h-6 text-gray-400 transition-transform duration-200 ${isExpandida ? 'rotate-180 text-teal-600' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  
                  {isExpandida && (
                    <div className="p-6 space-y-6 border-t border-gray-100 animate-fade-in">
                      
                      {/* CAIXA DE DESCRIÇÃO / TEMA */}
                      <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <label className="block text-[11px] font-black text-gray-500 uppercase tracking-wider mb-2">
                          Tema / Descrição / Observação (Opcional)
                        </label>
                        <textarea 
                          value={descricoesPorData[data] || ""}
                          onChange={(e) => setDescricoesPorData({ ...descricoesPorData, [data]: e.target.value })}
                          placeholder="Ex: Tema do culto, assunto da lição da EBD ou um aviso geral..."
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none resize-none bg-white text-sm"
                          rows={2}
                        ></textarea>
                      </div>

                      {dadosPorData[data]?.map((linha: any) => (
                        <div key={linha.id} className="flex items-end gap-3 pb-6 border-b border-gray-100 last:border-0 last:pb-0">
                          
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {tipo === "Louvor" ? (
                              <>
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Instrumento</label>
                                  <select value={linha.instrumento} onChange={(e) => atualizarCampo(data, linha.id, "instrumento", e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                                    <option value="Voz">Voz</option><option value="Teclado">Teclado</option><option value="Violão">Violão</option><option value="Guitarra">Guitarra</option><option value="Baixo">Baixo</option><option value="Bateria">Bateria</option><option value="Outro">Outro...</option>
                                  </select>
                                  {linha.instrumento === "Outro" && (
                                    <input type="text" value={linha.instrumento_outro} onChange={(e) => atualizarCampo(data, linha.id, "instrumento_outro", e.target.value)} placeholder="Qual?" className="w-full mt-2 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                                  )}
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Nome do Membro</label>
                                  <input type="text" value={linha.nome} onChange={(e) => atualizarCampo(data, linha.id, "nome", e.target.value)} placeholder="Nome completo" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                                </div>
                              </>
                            ) : tipo === "EBD" || tipo === "DEPIN" ? (
                              <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Sala</label>
                                  <input type="text" value={linha.sala} onChange={(e) => atualizarCampo(data, linha.id, "sala", e.target.value)} placeholder="Ex: Jovens" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Professor</label>
                                  <input type="text" value={linha.professor} onChange={(e) => atualizarCampo(data, linha.id, "professor", e.target.value)} placeholder="Nome do prof." className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Auxiliar (Opcional)</label>
                                  <input type="text" value={linha.auxiliar} onChange={(e) => atualizarCampo(data, linha.id, "auxiliar", e.target.value)} placeholder="Nome do aux." className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                                </div>
                              </div>
                            ) : (
                              <>
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Função / Cargo</label>
                                  <input type="text" value={linha.funcao} onChange={(e) => atualizarCampo(data, linha.id, "funcao", e.target.value)} placeholder="Ex: Dirigente" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Nome do Membro</label>
                                  <input type="text" value={linha.nome} onChange={(e) => atualizarCampo(data, linha.id, "nome", e.target.value)} placeholder="Nome completo" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
                                </div>
                              </>
                            )}
                          </div>

                          <button 
                            onClick={() => removerLinha(data, linha.id)} 
                            className="p-3 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 rounded-xl transition-colors flex-shrink-0 mb-[2px]"
                            title="Remover linha"
                          >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>

                        </div>
                      ))}
                      
                      <button onClick={() => adicionarLinha(data)} className="mt-4 flex items-center gap-2 text-sm font-bold text-teal-600 hover:text-teal-800 transition">
                        <span className="bg-teal-50 p-1 rounded-md">+</span> Adicionar mais pessoas neste dia
                      </button>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        <div className="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-end items-center gap-4">
           <button type="button" onClick={() => router.back()} className="w-full sm:w-auto px-6 py-3 text-gray-500 hover:text-gray-800 font-bold transition">Cancelar</button>
           <button type="button" onClick={salvarEscalas} disabled={salvando || datasSelecionadas.length === 0} className="w-full sm:w-auto px-8 py-3.5 bg-teal-600 text-white font-black uppercase tracking-wide rounded-xl shadow-md hover:bg-teal-700 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none">
             {salvando ? "Processando..." : "FINALIZAR E SALVAR"}
           </button>
        </div>

      </div>

      {modalSucesso && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-fade-in-up">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Escala Pronta!</h2>
            <p className="text-gray-500 mb-6">A escala foi organizada e salva.</p>
            <div className="flex items-center justify-center gap-3 text-teal-600 font-bold mt-4">
               <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-600"></div> Redirecionando...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}