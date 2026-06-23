"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../src/lib/supabase";
import { podeEditar, formatarPerfis } from "../../../../src/lib/permissoes";

export default function ConfiguracoesTesouraria() {
  const router = useRouter();
  
  // 1. STATES GERAIS E MULTI-TENANCY
  const [configuracoes, setConfiguracoes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [igrejaIdLogada, setIgrejaIdLogada] = useState<string | null>(null);
  
  const [ehSede, setEhSede] = useState(false);
  const [nomeSedeOficial, setNomeSedeOficial] = useState("Sede");
  const [congregacoes, setCongregacoes] = useState<string[]>([]);
  const [congregacaoSelecionada, setCongregacaoSelecionada] = useState("");

  // Estados do Formulário Entradas/Saídas
  const [categoria, setCategoria] = useState("Saída");
  const [tipo, setTipo] = useState("");
  const [percentual, setPercentual] = useState<number | "">("");
  const [origemDestino, setOrigemDestino] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Estados para o PIX
  const [chavePix, setChavePix] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [qrCodeArquivo, setQrCodeArquivo] = useState<File | null>(null);
  const [salvandoPix, setSalvandoPix] = useState(false);

  const [modalFeedback, setModalFeedback] = useState<{ visivel: boolean; tipo: "sucesso" | "erro"; titulo: string; mensagem: string; }>({
    visivel: false, tipo: "sucesso", titulo: "", mensagem: "",
  });

  const mostrarNotificacao = (tipo: "sucesso" | "erro", titulo: string, mensagem: string) => {
    setModalFeedback({ visivel: true, tipo, titulo, mensagem });
  };

  // 2. EFFECT PRINCIPAL COM TRAVAS
  useEffect(() => {
    const usuarioLocal = localStorage.getItem("usuarioLogado");
    if (!usuarioLocal) {
      router.push("/login");
      return;
    }
    
    const usuario = JSON.parse(usuarioLocal);
    const perfisLogado = formatarPerfis(usuario.perfis || usuario.nivel_acesso);

    if (!podeEditar(perfisLogado, 'tesouraria')) {
      router.push("/");
      return; 
    }

    const igrejaId = usuario.igreja_id || usuario.id_igreja;
    setIgrejaIdLogada(igrejaId);

    async function inicializarDados() {
      setCarregando(true);
      try {
        // Busca o nome oficial da Igreja Mãe
        const { data: configMaster } = await supabase
          .from("configuracao_igreja")
          .select("nome_igreja")
          .eq("igreja_id", igrejaId)
          .maybeSingle();

        const nomeSede = configMaster?.nome_igreja?.trim() || "Sede Principal";
        setNomeSedeOficial(nomeSede);

        // Define se o usuário logado é da Sede
        const congUser = usuario?.congregacao?.trim() || "";
        const congLow = congUser.toLowerCase();
        const isUserSede = !congLow || congLow === "sede" || congLow === "matriz" || congLow === "geral" || congLow === nomeSede.toLowerCase();
        
        setEhSede(isUserSede);

        // Configura o Seletor de Congregações
        let congParaCarregar = nomeSede;
        if (isUserSede) {
          const { data: filhas } = await supabase
            .from("igrejas_filhas")
            .select("nome")
            .eq("igreja_id", igrejaId)
            .order("nome", { ascending: true });
          const nomesFilhas = filhas ? filhas.map(f => f.nome) : [];
          setCongregacoes([nomeSede, ...nomesFilhas]);
        } else {
          setCongregacoes([congUser]);
          congParaCarregar = congUser;
        }
        
        setCongregacaoSelecionada(congParaCarregar);
        await carregarDadosEspecificos(igrejaId, congParaCarregar, nomeSede);
      } catch (err) {
        console.error("Erro ao inicializar:", err);
      } finally {
        setCarregando(false);
      }
    }
    
    if (igrejaId) inicializarDados();
  }, [router]);

  // Carrega os dados baseado na Congregação Selecionada
  async function carregarDadosEspecificos(idIgreja: string, congregacaoAlvo: string, nomeDaSede: string) {
    setCarregando(true);
    
    // 1. Carrega as Configurações Fixas (Entradas/Saídas) travadas pela congregação
    let queryConfig = supabase
      .from("tesouraria_configuracoes")
      .select("*")
      .eq("igreja_id", idIgreja)
      .order("categoria", { ascending: false })
      .order("id", { ascending: true });

    // Trata valores antigos que estavam sem congregação assumindo que são da Sede
    if (congregacaoAlvo === nomeDaSede) {
      queryConfig = queryConfig.or(`congregacao.eq.${congregacaoAlvo},congregacao.is.null,congregacao.eq.,congregacao.ilike.sede,congregacao.ilike.geral`);
    } else {
      queryConfig = queryConfig.eq("congregacao", congregacaoAlvo);
    }

    const { data: configData } = await queryConfig;
    if (configData) setConfiguracoes(configData);

    // 2. Carrega o PIX correto (Sede = tabela global | Filial = tabela filhas)
    setChavePix("");
    setQrCodeUrl(null);
    setQrCodeArquivo(null);

    if (congregacaoAlvo === nomeDaSede) {
      const { data: pixData } = await supabase
        .from("configuracao_igreja")
        .select("chave_pix, qr_code_pix")
        .eq("igreja_id", idIgreja)
        .maybeSingle();
      if (pixData) {
        setChavePix(pixData.chave_pix || "");
        setQrCodeUrl(pixData.qr_code_pix || null);
      }
    } else {
      const { data: pixFilha } = await supabase
        .from("igrejas_filhas")
        .select("chave_pix, qr_code_pix")
        .eq("igreja_id", idIgreja)
        .eq("nome", congregacaoAlvo)
        .maybeSingle();
      if (pixFilha) {
        setChavePix(pixFilha.chave_pix || "");
        setQrCodeUrl(pixFilha.qr_code_pix || null);
      }
    }

    setCarregando(false);
  }

  // Dispara o recarregamento ao trocar de congregação no Select
  const handleTrocarCongregacao = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const novaCong = e.target.value;
    setCongregacaoSelecionada(novaCong);
    if (igrejaIdLogada) carregarDadosEspecificos(igrejaIdLogada, novaCong, nomeSedeOficial);
  };

  // 3. FUNÇÕES DE MANIPULAÇÃO DE DADOS
  const salvarConfiguracao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipo || percentual === "" || !origemDestino) {
      mostrarNotificacao("erro", "Campos Incompletos", "Por favor, preencha todos os campos da nova configuração fixa.");
      return;
    }

    setSalvando(true);
    const novaConfig = {
      igreja_id: igrejaIdLogada,
      congregacao: congregacaoSelecionada, // A MÁGICA ACONTECE AQUI
      categoria,
      tipo,
      percentual: Number(percentual),
      origem_destino: origemDestino,
    };

    const { error } = await supabase.from("tesouraria_configuracoes").insert([novaConfig]);

    setSalvando(false);

    if (error) {
      mostrarNotificacao("erro", "Erro no Servidor", "Não foi possível salvar: " + error.message);
    } else {
      setTipo(""); setPercentual(""); setOrigemDestino("");
      mostrarNotificacao("sucesso", "Configuração Adicionada", "A porcentagem fixa foi registrada com sucesso.");
      if (igrejaIdLogada) carregarDadosEspecificos(igrejaIdLogada, congregacaoSelecionada, nomeSedeOficial); 
    }
  };

  const deletarConfiguracao = async (id: number) => {
    if (!confirm("Tem certeza que deseja remover esta configuração?")) return;
    const { error } = await supabase.from("tesouraria_configuracoes").delete().eq("id", id); 
    if (error) {
      mostrarNotificacao("erro", "Erro ao Deletar", "Não foi possível excluir este registro: " + error.message);
    } else {
      mostrarNotificacao("sucesso", "Registro Removido", "A configuração foi excluída do sistema.");
      if (igrejaIdLogada) carregarDadosEspecificos(igrejaIdLogada, congregacaoSelecionada, nomeSedeOficial);
    }
  };

  // 3.1. FUNÇÃO PARA SALVAR O PIX (ROTEAMENTO INTELIGENTE)
  const salvarPix = async () => {
    if (!igrejaIdLogada) return;
    setSalvandoPix(true);
    let urlParaSalvar = qrCodeUrl;

    try {
      if (qrCodeArquivo) {
        const fileExt = qrCodeArquivo.name.split('.').pop();
        // Nome único para evitar cache do navegador e conflito entre filiais
        const fileName = `${igrejaIdLogada}-${congregacaoSelecionada.replace(/\s+/g, '')}-pix-${Math.random()}.${fileExt}`;
        const filePath = `${igrejaIdLogada}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('pix').upload(filePath, qrCodeArquivo);
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('pix').getPublicUrl(filePath);
        urlParaSalvar = publicUrlData.publicUrl;
      }

      // Direciona o salvamento para a tabela correta
      if (congregacaoSelecionada === nomeSedeOficial) {
        // Salva na Sede
        const { data: configAtual } = await supabase.from("configuracao_igreja").select("id").eq("igreja_id", igrejaIdLogada).maybeSingle();
        if (configAtual) {
          await supabase.from("configuracao_igreja").update({ chave_pix: chavePix, qr_code_pix: urlParaSalvar }).eq("id", configAtual.id);
        } else {
          await supabase.from("configuracao_igreja").insert([{ igreja_id: igrejaIdLogada, chave_pix: chavePix, qr_code_pix: urlParaSalvar }]);
        }
      } else {
        // Salva na Filial
        await supabase.from("igrejas_filhas")
          .update({ chave_pix: chavePix, qr_code_pix: urlParaSalvar })
          .eq("igreja_id", igrejaIdLogada)
          .eq("nome", congregacaoSelecionada);
      }

      mostrarNotificacao("sucesso", "PIX Configurado", `As configurações de PIX para ${congregacaoSelecionada} foram atualizadas!`);
      setQrCodeUrl(urlParaSalvar);
      setQrCodeArquivo(null); 
    } catch (err: any) {
      console.error(err);
      mostrarNotificacao("erro", "Falha Inesperada", err.message || "Ocorreu um erro interno ao salvar os dados.");
    }
    
    setSalvandoPix(false);
  };

  const configuracoesSaida = configuracoes.filter(c => c.categoria === "Saída");
  const configuracoesEntrada = configuracoes.filter(c => c.categoria === "Entrada");

  return (
    <div className="max-w-5xl mx-auto space-y-6 relative">
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-6 rounded-xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Configurações Globais</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie as porcentagens fixas e o PIX por Congregação.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* SELETOR HIERÁRQUICO */}
          {ehSede ? (
            <select
              value={congregacaoSelecionada}
              onChange={handleTrocarCongregacao}
              className="px-4 py-2.5 bg-indigo-50 border border-indigo-100 text-indigo-800 font-bold text-sm rounded-lg hover:border-indigo-300 focus:border-indigo-500 outline-none transition-all shadow-sm cursor-pointer truncate max-w-[200px]"
            >
              <option value={nomeSedeOficial}>🏢 {nomeSedeOficial} (Sede)</option>
              {congregacoes.filter(c => c !== nomeSedeOficial).map(c => (
                <option key={c} value={c}>📍 {c}</option>
              ))}
            </select>
          ) : (
            <div className="px-4 py-2.5 bg-gray-100 border border-gray-200 text-gray-600 font-bold text-sm rounded-lg shadow-sm truncate max-w-[200px] cursor-not-allowed">
              📍 {congregacaoSelecionada}
            </div>
          )}

          <button 
            onClick={() => router.push("/tesouraria")}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition text-sm whitespace-nowrap"
          >
            Voltar
          </button>
        </div>
      </div>

      {carregando ? (
        <div className="text-center py-10 text-gray-500 font-medium animate-pulse">Carregando configurações...</div>
      ) : (
        <>
          {/* BLOCO REESTRUTURADO: CONFIGURAÇÃO DO PIX COMPATÍVEL E RESPONSIVO */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="mb-6 border-b pb-3 border-gray-100">
              <h3 className="text-lg font-bold text-teal-800 flex items-center gap-2">
                Recebimento via PIX
                <span className="text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-bold">{congregacaoSelecionada}</span>
              </h3>
              <p className="text-sm text-gray-500 mt-1">Cadastre a chave e o QR Code que aparecerão no botão "Ofertar" para os membros desta congregação.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Chave PIX</label>
                  <input 
                    type="text" 
                    placeholder="Ex: CNPJ, E-mail, Celular ou Chave Aleatória"
                    value={chavePix} 
                    onChange={(e) => setChavePix(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Imagem do QR Code</label>
                  <input 
                    id="input-qr-code"
                    type="file" 
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setQrCodeArquivo(e.target.files[0]);
                      }
                    }}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer border border-gray-200 rounded-lg transition"
                  />
                  <p className="text-xs text-gray-400 mt-2">Dica: Envie uma imagem com boa resolução e recorte apenas o QR Code gerado pelo seu banco.</p>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-6 relative min-h-[220px]">
                <span className="absolute top-3 left-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Visualização</span>
                
                {(qrCodeArquivo || qrCodeUrl) && (
                  <button
                    type="button"
                    onClick={() => {
                      setQrCodeArquivo(null);
                      setQrCodeUrl(null);
                      const inputDeArquivo = document.getElementById("input-qr-code") as HTMLInputElement;
                      if (inputDeArquivo) inputDeArquivo.value = "";
                    }}
                    className="absolute top-3 right-3 p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                    title="Remover Imagem"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}

                {qrCodeArquivo ? (
                  <img src={URL.createObjectURL(qrCodeArquivo)} alt="Preview QR Code" className="w-40 h-40 object-contain rounded-lg shadow-sm border border-gray-200 bg-white p-2 mt-4" />
                ) : qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="QR Code Salvo" className="w-40 h-40 object-contain rounded-lg shadow-sm border border-gray-200 bg-white p-2 mt-4" />
                ) : (
                  <div className="w-40 h-40 bg-white border border-gray-200 flex flex-col items-center justify-center rounded-lg text-gray-400 mt-4 shadow-sm">
                    <svg className="w-10 h-10 mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <span className="text-xs">Nenhum QR Code</span>
                  </div>
                )}
                
                {chavePix && (
                  <div className="mt-3 text-center max-w-full px-2">
                    <p className="text-xs text-gray-500 font-medium">Chave Cadastrada:</p>
                    <p className="text-xs font-bold text-gray-800 break-all">{chavePix}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 border-t pt-4 border-gray-100 flex justify-end">
              <button 
                onClick={salvarPix} 
                disabled={salvandoPix}
                className="w-full md:w-auto px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg transition disabled:bg-teal-400 flex items-center justify-center gap-2 text-sm shadow-sm"
              >
                {salvandoPix ? "Salvando PIX..." : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                    Salvar PIX de {congregacaoSelecionada}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* CONFIGURAÇÕES FIXAS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
              <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2 border-gray-100">Nova Configuração</h3>
              
              <form onSubmit={salvarConfiguracao} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Categoria</label>
                  <select 
                    value={categoria} onChange={(e) => setCategoria(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="Saída">Saída Fixa</option>
                    <option value="Entrada">Entrada Fixa</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo (Nome)</label>
                  <input 
                    type="text" placeholder="Ex: Fundo de Missões..."
                    value={tipo} onChange={(e) => setTipo(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Percentual (%)</label>
                  <input 
                    type="number" step="0.01" min="0" max="100" placeholder="Ex: 10 para 10%"
                    value={percentual} onChange={(e) => setPercentual(e.target.value ? parseFloat(e.target.value) : "")}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Origem / Destino</label>
                  <input 
                    type="text" placeholder="Ex: Conta da Sede..."
                    value={origemDestino} onChange={(e) => setOrigemDestino(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <button 
                  type="submit" disabled={salvando}
                  className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-lg transition mt-2 disabled:bg-gray-400"
                >
                  {salvando ? "Adicionando..." : "Salvar Configuração"}
                </button>
              </form>
            </div>

            <div className="md:col-span-2 space-y-6">
              {/* LISTA DE SAÍDAS FIXAS */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 bg-red-50 border-b border-red-100 flex justify-between items-center">
                  <h3 className="font-bold text-red-800">Saídas Fixas</h3>
                  <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-bold">{congregacaoSelecionada}</span>
                </div>
                <div className="p-0">
                  {configuracoesSaida.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 text-center">Nenhuma saída fixa configurada.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {configuracoesSaida.map(conf => (
                        <li key={conf.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                          <div>
                            <p className="font-bold text-gray-800">{conf.tipo} <span className="text-red-600 ml-1">({conf.percentual}%)</span></p>
                            <p className="text-xs text-gray-500">Destino: {conf.origem_destino}</p>
                          </div>
                          <button onClick={() => deletarConfiguracao(conf.id)} className="text-gray-400 hover:text-red-600 transition p-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* LISTA DE ENTRADAS FIXAS */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 bg-green-50 border-b border-green-100 flex justify-between items-center">
                  <h3 className="font-bold text-green-800">Entradas Fixas</h3>
                  <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-bold">{congregacaoSelecionada}</span>
                </div>
                <div className="p-0">
                  {configuracoesEntrada.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 text-center">Nenhuma entrada fixa configurada.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {configuracoesEntrada.map(conf => (
                        <li key={conf.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                          <div>
                            <p className="font-bold text-gray-800">{conf.tipo} <span className="text-green-600 ml-1">({conf.percentual}%)</span></p>
                            <p className="text-xs text-gray-500">Origem: {conf.origem_destino}</p>
                          </div>
                          <button onClick={() => deletarConfiguracao(conf.id)} className="text-gray-400 hover:text-red-600 transition p-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* MODAL DE FEEDBACK */}
      {modalFeedback.visivel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-gray-100 transform scale-100 transition-all text-center">
            <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
              modalFeedback.tipo === "sucesso" ? "bg-teal-50 text-teal-600" : "bg-red-50 text-red-600"
            }`}>
              {modalFeedback.tipo === "sucesso" ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              )}
            </div>
            
            <h4 className="text-md font-bold text-gray-900 mb-1">{modalFeedback.titulo}</h4>
            <p className="text-xs text-gray-500 leading-relaxed mb-5">{modalFeedback.mensagem}</p>
            
            <button
              onClick={() => setModalFeedback(prev => ({ ...prev, visivel: false }))}
              className={`w-full py-2 rounded-lg text-white font-semibold text-xs transition shadow-sm ${
                modalFeedback.tipo === "sucesso" ? "bg-teal-600 hover:bg-teal-700" : "bg-red-600 hover:bg-red-700"
              }`}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}