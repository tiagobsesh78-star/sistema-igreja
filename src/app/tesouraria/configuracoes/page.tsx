"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../src/lib/supabase";
import { podeEditar, formatarPerfis } from "../../../../src/lib/permissoes";

export default function ConfiguracoesTesouraria() {
  const router = useRouter();
  
  // 1. TODOS OS STATES DEVEM FICAR NO TOPO
  const [configuracoes, setConfiguracoes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [igrejaIdLogada, setIgrejaIdLogada] = useState<string | null>(null);

  // Estados do Formulário Entradas/Saídas
  const [categoria, setCategoria] = useState("Saída");
  const [tipo, setTipo] = useState("");
  const [percentual, setPercentual] = useState<number | "">("");
  const [origemDestino, setOrigemDestino] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Novos Estados para o PIX
  const [chavePix, setChavePix] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [qrCodeArquivo, setQrCodeArquivo] = useState<File | null>(null);
  const [salvandoPix, setSalvandoPix] = useState(false);

  // Estados para o Modal de Feedback do Sistema
  const [modalFeedback, setModalFeedback] = useState<{
    visivel: boolean;
    tipo: "sucesso" | "erro";
    titulo: string;
    mensagem: string;
  }>({
    visivel: false,
    tipo: "sucesso",
    titulo: "",
    mensagem: "",
  });

  // Função para disparar a notificação customizada do sistema
  const mostrarNotificacao = (tipo: "sucesso" | "erro", titulo: string, mensagem: string) => {
    setModalFeedback({
      visivel: true,
      tipo,
      titulo,
      mensagem,
    });
  };

  // 2. EFFECT PRINCIPAL COM A TRAVA DE SEGURANÇA NA ROTA
  useEffect(() => {
    const usuarioLocal = localStorage.getItem("usuarioLogado");
    if (!usuarioLocal) {
      router.push("/login");
      return;
    }
    
    const usuario = JSON.parse(usuarioLocal);
    const perfisLogado = formatarPerfis(usuario.perfis || usuario.nivel_acesso);

    // ==================================================
    // TRAVA DE ROTA: CHUTA INVASORES PELA URL PARA A HOME
    // ==================================================
    if (!podeEditar(perfisLogado, 'tesouraria')) {
      router.push("/");
      return; // Interrompe a execução
    }
    // ==================================================

    const igrejaId = usuario.igreja_id || usuario.id_igreja;
    setIgrejaIdLogada(igrejaId);

    async function carregarDados(idIgreja: string) {
      setCarregando(true);
      
      // Carregar configurações fixas (Entradas/Saídas)
      const { data: configData, error: configError } = await supabase
        .from("tesouraria_configuracoes")
        .select("*")
        .eq("igreja_id", idIgreja) 
        .order("categoria", { ascending: false })
        .order("id", { ascending: true });

      if (!configError && configData) {
        setConfiguracoes(configData);
      }

      // Carregar configurações do PIX
      const { data: pixData } = await supabase
        .from("configuracao_igreja")
        .select("chave_pix, qr_code_pix")
        .eq("igreja_id", idIgreja)
        .maybeSingle();

      if (pixData) {
        setChavePix(pixData.chave_pix || "");
        setQrCodeUrl(pixData.qr_code_pix || null);
      }

      setCarregando(false);
    }
    
    if (igrejaId) {
      carregarDados(igrejaId);
    }
  }, [router]);

  // Função isolada de carregamento para uso local (após inserção/deleção)
  async function recarregarConfiguracoesLocalmente() {
    if (!igrejaIdLogada) return;
    setCarregando(true);
    const { data, error } = await supabase
      .from("tesouraria_configuracoes")
      .select("*")
      .eq("igreja_id", igrejaIdLogada)
      .order("categoria", { ascending: false })
      .order("id", { ascending: true });

    if (!error && data) {
      setConfiguracoes(data);
    }
    setCarregando(false);
  }

  // 3. FUNÇÕES COMUNS DE MANIPULAÇÃO DE DADOS (Entradas/Saídas)
  const salvarConfiguracao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipo || percentual === "" || !origemDestino) {
      mostrarNotificacao("erro", "Campos Incompletos", "Por favor, preencha todos os campos da nova configuração fixa.");
      return;
    }

    if (!igrejaIdLogada) {
      mostrarNotificacao("erro", "Sessão Expirada", "Erro de autenticação da igreja. Por favor, faça login novamente.");
      return;
    }

    setSalvando(true);
    const novaConfig = {
      igreja_id: igrejaIdLogada,
      categoria,
      tipo,
      percentual: Number(percentual),
      origem_destino: origemDestino,
    };

    const { error } = await supabase.from("tesouraria_configuracoes").insert([novaConfig]);

    setSalvando(false);

    if (error) {
      mostrarNotificacao("erro", "Erro no Servidor", "Não foi possível salvar a configuração fixa: " + error.message);
    } else {
      setTipo("");
      setPercentual("");
      setOrigemDestino("");
      mostrarNotificacao("sucesso", "Configuração Adicionada", "A porcentagem fixa foi registrada com sucesso.");
      recarregarConfiguracoesLocalmente(); 
    }
  };

  const deletarConfiguracao = async (id: number) => {
    if (!confirm("Tem certeza que deseja remover esta configuração?")) return;
    if (!igrejaIdLogada) return;

    const { error } = await supabase
      .from("tesouraria_configuracoes")
      .delete()
      .eq("id", id)
      .eq("igreja_id", igrejaIdLogada); 

    if (error) {
      mostrarNotificacao("erro", "Erro ao Deletar", "Não foi possível excluir este registro: " + error.message);
    } else {
      mostrarNotificacao("sucesso", "Registro Removido", "A configuração foi excluída do sistema.");
      recarregarConfiguracoesLocalmente();
    }
  };

  // 3.1. FUNÇÃO PARA SALVAR O PIX
  const salvarPix = async () => {
    if (!igrejaIdLogada) {
      mostrarNotificacao("erro", "Sessão Expirada", "Identificação da igreja não encontrada.");
      return;
    }
    
    setSalvandoPix(true);
    let urlParaSalvar = qrCodeUrl;

    try {
      // Se houver arquivo selecionado, faz o upload primeiro
      if (qrCodeArquivo) {
        const fileExt = qrCodeArquivo.name.split('.').pop();
        const fileName = `${igrejaIdLogada}-pix-${Math.random()}.${fileExt}`;
        const filePath = `${igrejaIdLogada}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('pix')
          .upload(filePath, qrCodeArquivo);

        if (uploadError) {
          mostrarNotificacao("erro", "Falha de Upload", "Erro ao fazer upload da imagem do QR Code: " + uploadError.message);
          setSalvandoPix(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from('pix')
          .getPublicUrl(filePath);

        urlParaSalvar = publicUrlData.publicUrl;
      }

      // Verifica se já existe um registro na configuracao_igreja
      const { data: configAtual } = await supabase
          .from("configuracao_igreja")
          .select("id")
          .eq("igreja_id", igrejaIdLogada)
          .maybeSingle();

      let errorUpdate;
      if (configAtual) {
          const { error } = await supabase
              .from("configuracao_igreja")
              .update({ chave_pix: chavePix, qr_code_pix: urlParaSalvar })
              .eq("id", configAtual.id);
          errorUpdate = error;
      } else {
          const { error } = await supabase
              .from("configuracao_igreja")
              .insert([{ igreja_id: igrejaIdLogada, chave_pix: chavePix, qr_code_pix: urlParaSalvar }]);
          errorUpdate = error;
      }

      if (errorUpdate) {
        mostrarNotificacao("erro", "Erro no Banco", "Erro ao registrar as credenciais de PIX: " + errorUpdate.message);
      } else {
        mostrarNotificacao("sucesso", "PIX Configurado", "As configurações de PIX foram atualizadas com sucesso!");
        setQrCodeUrl(urlParaSalvar);
        setQrCodeArquivo(null); 
      }
    } catch (err) {
      console.error(err);
      mostrarNotificacao("erro", "Falha Inesperada", "Ocorreu um erro interno de processamento ao salvar os dados.");
    }
    
    setSalvandoPix(false);
  };

  const configuracoesSaida = configuracoes.filter(c => c.categoria === "Saída");
  const configuracoesEntrada = configuracoes.filter(c => c.categoria === "Entrada");

  // 4. RETORNOS E COMPONENTES VISUAIS
  return (
    <div className="max-w-5xl mx-auto space-y-6 relative">
      
      {/* CABEÇALHO */}
      <div className="flex items-center justify-between bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Configurações Globais</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie as porcentagens fixas de entradas/saídas e o PIX da Igreja.</p>
        </div>
        <button 
          onClick={() => router.push("/tesouraria")}
          className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition text-sm"
        >
          Voltar à Tesouraria
        </button>
      </div>

      {/* BLOCO REESTRUTURADO: CONFIGURAÇÃO DO PIX COMPATÍVEL E RESPONSIVO */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="mb-6 border-b pb-3 border-gray-100">
          <h3 className="text-lg font-bold text-teal-800">Recebimento via PIX (Dízimos e Ofertas)</h3>
          <p className="text-sm text-gray-500">Cadastre a chave e o QR Code que aparecerão no botão "Ofertar" da tela inicial.</p>
        </div>

        {/* Grid paraInputs e Preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Inputs */}
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

          {/* Container de Preview da Imagem com Opção de Lixeira */}
          <div className="flex flex-col items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-6 relative min-h-[220px]">
            <span className="absolute top-3 left-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Visualização</span>
            
            {/* NOVO BOTÃO: Excluir a Imagem do QR Code */}
            {(qrCodeArquivo || qrCodeUrl) && (
              <button
                type="button"
                onClick={() => {
                  setQrCodeArquivo(null);
                  setQrCodeUrl(null);
                  // Reseta o input de arquivo visualmente
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
              <img 
                src={URL.createObjectURL(qrCodeArquivo)} 
                alt="Preview QR Code" 
                className="w-40 h-40 object-contain rounded-lg shadow-sm border border-gray-200 bg-white p-2 mt-4"
              />
            ) : qrCodeUrl ? (
              <img 
                src={qrCodeUrl} 
                alt="QR Code Salvo" 
                className="w-40 h-40 object-contain rounded-lg shadow-sm border border-gray-200 bg-white p-2 mt-4"
              />
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

        {/* Botão posicionado ao fim de toda a seção */}
        <div className="mt-6 border-t pt-4 border-gray-100 flex justify-end">
          <button 
            onClick={salvarPix} 
            disabled={salvandoPix}
            className="w-full md:w-auto px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg transition disabled:bg-teal-400 flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            {salvandoPix ? "Salvando PIX..." : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                Salvar Configurações PIX
              </>
            )}
          </button>
        </div>
      </div>

      {/* BLOCO EXISTENTE: CONFIGURAÇÕES FIXAS (GRID) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* FORMULÁRIO DE ADIÇÃO */}
        <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
          <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2 border-gray-100">Nova Configuração Fixa</h3>
          
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
                type="text" placeholder="Ex: Sede, Missões..."
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
                type="text" placeholder="Ex: Conta da Sede, Fundo X..."
                value={origemDestino} onChange={(e) => setOrigemDestino(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <button 
              type="submit" disabled={salvando}
              className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-lg transition mt-2 disabled:bg-gray-400"
            >
              {salvando ? "Adicionando..." : "Adicionar Configuração"}
            </button>
          </form>
        </div>

        {/* LISTAGEM DAS CONFIGURAÇÕES */}
        <div className="md:col-span-2 space-y-6">
          
          {/* LISTA DE SAÍDAS FIXAS */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-red-50 border-b border-red-100">
              <h3 className="font-bold text-red-800">Saídas Fixas Cadastradas</h3>
            </div>
            <div className="p-0">
              {carregando ? (
                <p className="p-4 text-sm text-gray-500">Carregando...</p>
              ) : configuracoesSaida.length === 0 ? (
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
            <div className="p-4 bg-green-50 border-b border-green-100">
              <h3 className="font-bold text-green-800">Entradas Fixas Cadastradas</h3>
            </div>
            <div className="p-0">
              {carregando ? (
                <p className="p-4 text-sm text-gray-500">Carregando...</p>
              ) : configuracoesEntrada.length === 0 ? (
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

      {/* MODAL DE FEEDBACK CUSTOMIZADO EXCLUSIVO DO DOXO HUB */}
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