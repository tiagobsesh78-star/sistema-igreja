"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase"; 
import { podeEditar, formatarPerfis } from "../../lib/permissoes";

export default function ConfiguracoesIgreja() {
  const router = useRouter();
  
  // 1. TODOS OS STATES NO TOPO (REGRA DO REACT)
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [logoArquivo, setFotoArquivo] = useState<File | null>(null);
  const [mostrarModalSucesso, setMostrarModalSucesso] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [configId, setConfigId] = useState<number | null>(null);
  const [igrejaIdLogada, setIgrejaIdLogada] = useState<string | null>(null);

  // Estados novos para o gerenciamento das Igrejas Filhas
  const [igrejasFilhas, setIgrejasFilhas] = useState<any[]>([]);
  const [modalFilhaAberto, setModalFilhaAberto] = useState(false);
  const [nomeFilha, setNomeFilha] = useState("");
  const [salvandoFilha, setSalvandoFilha] = useState(false);

  const [dadosIgreja, setDadosIgreja] = useState({
    nome_igreja: "",
    cnpj: "", 
    nome_pastor: "",
    endereco_rua: "",
    endereco_numero: "",
    endereco_bairro: "",
    endereco_cidade_uf: "",
    endereco_cep: "",
    logo_url: "",
  });

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
    // TRAVA 1: PERFIL DE ACESSO
    // Se o usuário não puder editar membros, também não pode editar as configs.
    // ==================================================
    if (!podeEditar(perfisLogado, 'membros')) {
      router.push("/");
      return; 
    }

    const igrejaId = usuario.igreja_id;
    setIgrejaIdLogada(igrejaId);

    async function buscarConfiguracoes(idIgreja: string) {
      // BUSCA AS CONFIGURAÇÕES APENAS DESTA IGREJA
      const { data, error } = await supabase
        .from("configuracao_igreja")
        .select("*")
        .eq("igreja_id", idIgreja) 
        .maybeSingle();

      // ==================================================
      // TRAVA 2: ANTI-URL BYPASS (BLOQUEIA FILIAIS)
      // Verifica se o usuário pertence à Sede. Se for de filial, é expulso para a Home.
      // ==================================================
      const nomeOficial = data?.nome_igreja?.trim() || "Sede";
      const congUsuario = usuario.congregacao?.trim() || "";
      const congLow = congUsuario.toLowerCase();
      const isUserSede = !congLow || congLow === "sede" || congLow === "matriz" || congLow === "geral" || congLow === nomeOficial.toLowerCase();

      if (!isUserSede) {
        router.push("/"); // Expulsa o invasor
        return;
      }

      if (data) {
        setConfigId(data.id);
        setDadosIgreja({
          nome_igreja: data.nome_igreja || "",
          cnpj: data.cnpj || "", 
          nome_pastor: data.nome_pastor || "",
          endereco_rua: data.endereco_rua || "",
          endereco_numero: data.endereco_numero || "",
          endereco_bairro: data.endereco_bairro || "",
          endereco_cidade_uf: data.endereco_cidade_uf || "",
          endereco_cep: data.endereco_cep || "",
          logo_url: data.logo_url || "",
        });
      }

      // Carrega também as igrejas filhas vinculadas de forma assíncrona
      await carregarIgrejasFilhas(idIgreja);
      setCarregando(false);
    }
    
    buscarConfiguracoes(igrejaId);
  }, [router]);

  // Função para buscar as igrejas filhas do banco
  const carregarIgrejasFilhas = async (idIgreja: string) => {
    const { data, error } = await supabase
      .from("igrejas_filhas")
      .select("*")
      .eq("igreja_id", idIgreja)
      .order("nome", { ascending: true });

    if (data) {
      setIgrejasFilhas(data);
    }
  };

  // Função para cadastrar uma nova igreja filha
  const handleCadastrarFilha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeFilha.trim() || !igrejaIdLogada) return;

    setSalvandoFilha(true);
    try {
      const { error } = await supabase
        .from("igrejas_filhas")
        .insert([
          {
            nome: nomeFilha.trim(),
            igreja_id: igrejaIdLogada
          }
        ]);

      if (error) throw error;

      setNomeFilha("");
      setModalFilhaAberto(false);
      await carregarIgrejasFilhas(igrejaIdLogada);
    } catch (error: any) {
      alert("Erro ao cadastrar igreja filha: " + error.message);
    } finally {
      setSalvandoFilha(false);
    }
  };

  // Função para excluir uma igreja filha cadastrada
  const handleDeletarFilha = async (id: number) => {
    if (!confirm("Tem certeza que deseja remover esta igreja filha / congregação?")) return;

    try {
      const { error } = await supabase
        .from("igrejas_filhas")
        .delete()
        .eq("id", id)
        .eq("igreja_id", igrejaIdLogada);

      if (error) throw error;

      if (igrejaIdLogada) {
        await carregarIgrejasFilhas(igrejaIdLogada);
      }
    } catch (error: any) {
      alert("Erro ao remover igreja filha: " + error.message);
    }
  };

  // 3. FUNÇÕES COMUNS
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === "cnpj") {
      let valorLimpo = value.replace(/\D/g, ""); 
      if (valorLimpo.length > 14) valorLimpo = valorLimpo.slice(0, 14); 

      valorLimpo = valorLimpo
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");

      setDadosIgreja({ ...dadosIgreja, [name]: valorLimpo });
      return;
    }

    setDadosIgreja({ ...dadosIgreja, [name]: value });
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) setFotoArquivo(e.dataTransfer.files[0]);
  };

  const salvarConfiguracoes = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!igrejaIdLogada) return;

    setSalvando(true);
    let novaLogoUrl = dadosIgreja.logo_url;

    try {
      if (logoArquivo) {
        const nomeArquivo = `logo-${igrejaIdLogada}-${Date.now()}-${logoArquivo.name}`;
        const { error: erroUpload } = await supabase.storage.from("fotos").upload(nomeArquivo, logoArquivo);
        if (erroUpload) throw erroUpload;
        const { data: dataUrl } = supabase.storage.from("fotos").getPublicUrl(nomeArquivo);
        novaLogoUrl = dataUrl.publicUrl;
      }

      const dadosParaSalvar = {
        ...dadosIgreja,
        igreja_id: igrejaIdLogada, 
        logo_url: novaLogoUrl,
      };

      if (configId) {
        const { error } = await supabase
          .from("configuracao_igreja")
          .update(dadosParaSalvar)
          .eq("id", configId)
          .eq("igreja_id", igrejaIdLogada); 
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("configuracao_igreja")
          .insert([dadosParaSalvar]);
        if (error) throw error;
      }

      setMostrarModalSucesso(true);
    } catch (error: any) {
      alert("Erro ao salvar configurações: " + error.message);
    } finally {
      setSalvando(false);
    }
  };

  // 4. RETORNOS
  if (carregando) return <div className="text-center py-20 text-gray-500 font-medium">Carregando configurações...</div>;

  const imagemPreview = logoArquivo ? URL.createObjectURL(logoArquivo) : dadosIgreja.logo_url;

  return (
    <>
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md relative">
        <div className="flex justify-between items-center mb-8 border-b pb-4">
          <h1 className="text-3xl font-bold text-gray-800">Dados da Igreja</h1>
          <button type="button" onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 font-medium">
            Voltar
          </button>
        </div>

        <form onSubmit={salvarConfiguracoes} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Oficial da Igreja *</label>
              <input required name="nome_igreja" value={dadosIgreja.nome_igreja} onChange={handleChange} type="text" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Igreja Evangélica..." />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">CNPJ</label>
              <input name="cnpj" value={dadosIgreja.cnpj} onChange={handleChange} type="text" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500" placeholder="00.000.000/0000-00" maxLength={18} inputMode="numeric" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Pastor Presidente *</label>
              <input required name="nome_pastor" value={dadosIgreja.nome_pastor} onChange={handleChange} type="text" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Pr. João Silva" />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-md space-y-4 border border-gray-100">
            <h2 className="font-bold text-blue-700 uppercase text-xs tracking-wider">Endereço da Sede</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Rua / Logradouro</label>
                <input name="endereco_rua" value={dadosIgreja.endereco_rua} onChange={handleChange} type="text" className="w-full p-2 border rounded-md outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nº</label>
                <input name="endereco_numero" value={dadosIgreja.endereco_numero} onChange={handleChange} type="text" className="w-full p-2 border rounded-md outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Bairro</label>
                <input name="endereco_bairro" value={dadosIgreja.endereco_bairro} onChange={handleChange} type="text" className="w-full p-2 border rounded-md outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Cidade/Estado</label>
                <input name="endereco_cidade_uf" value={dadosIgreja.endereco_cidade_uf} onChange={handleChange} type="text" className="w-full p-2 border rounded-md outline-none" placeholder="Natal/RN" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">CEP</label>
                <input name="endereco_cep" value={dadosIgreja.endereco_cep} onChange={handleChange} type="text" className="w-full p-2 border rounded-md outline-none" />
              </div>
            </div>
          </div>

          <div className="mt-8">
            <label className="block text-sm font-bold text-gray-700 mb-2">Logomarca Oficial da Igreja</label>
            <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`relative flex flex-col items-center justify-center w-full p-8 border-2 border-dashed rounded-xl transition-colors ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"}`}>
              <input type="file" id="logo-upload" accept="image/*" onChange={(e) => setFotoArquivo(e.target.files?.[0] || null)} className="hidden" />
              <label htmlFor="logo-upload" className="flex flex-col items-center justify-center cursor-pointer w-full h-full">
                {imagemPreview ? (
                  <div className="flex flex-col items-center text-center">
                    <img src={imagemPreview} alt="Preview Logo" className="w-32 h-32 object-contain shadow-md border p-2 bg-white rounded-lg mb-3" />
                    {logoArquivo && <span className="text-sm font-semibold text-blue-700 mb-1">Nova Imagem: {logoArquivo.name}</span>}
                    <span className="text-xs text-gray-500 hover:underline">Clique ou arraste para trocar a logo</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                    </div>
                    <p className="mb-1 text-sm text-gray-600"><span className="font-bold text-blue-600">Clique para buscar</span> ou arraste a logo aqui</p>
                    <p className="text-xs text-gray-400">Formatos recomendados: PNG ou JPG</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* NOVO BLOCO PREMIUM: GERENCIAMENTO DE IGREJAS FILHAS */}
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mt-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Igrejas Filhas / Congregações</h2>
                <p className="text-xs text-gray-500">Cadastre e gerencie as filiais que aparecerão nas telas de membros.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalFilhaAberto(true)}
                className="inline-flex items-center justify-center px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg text-sm shadow-sm transition-all transform active:scale-95 shrink-0"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Cadastrar Igreja Filha
              </button>
            </div>

            {igrejasFilhas.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-2">Nenhuma igreja filha cadastrada até o momento.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {igrejasFilhas.map((filha) => (
                  <div key={filha.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-teal-500 transition-colors">
                    <span className="text-sm font-medium text-gray-700 truncate pr-2">{filha.nome}</span>
                    <button
                      type="button"
                      onClick={() => handleDeletarFilha(filha.id)}
                      className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 transition-colors shrink-0"
                      title="Remover Congregação"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-6 border-t mt-8">
            <button type="submit" disabled={salvando} className="w-full md:w-auto px-10 py-4 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 transition duration-300 shadow-lg disabled:bg-gray-400">
              {salvando ? "Salvando Informações..." : "Salvar Configurações"}
            </button>
          </div>
        </form>
      </div>

      {/* MODAL DE CADASTRO DE IGREJA FILHA */}
      {modalFilhaAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 transform transition-all border border-gray-100 animate-fadeIn">
            <h3 className="text-xl font-bold text-gray-900 mb-1">Nova Igreja Filha</h3>
            <p className="text-xs text-gray-500 mb-4">Adicione o nome completo da nova congregação/filial.</p>
            
            <form onSubmit={handleCadastrarFilha} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nome da Congregação / Filha *</label>
                <input
                  required
                  type="text"
                  value={nomeFilha}
                  onChange={(e) => setNomeFilha(e.target.value)}
                  className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Ex: Congregação Setor Norte"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setModalFilhaAberto(false); setNomeFilha(""); }}
                  className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoFilha}
                  className="px-5 py-2 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition shadow-md disabled:bg-teal-400"
                >
                  {salvandoFilha ? "Salvando..." : "Salvar Filha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL GLOBAL DE SUCESSO */}
      {mostrarModalSucesso && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center transform transition-all">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Configurações Salvas!</h3>
            <p className="text-sm text-gray-500 mb-6">Os dados oficiais da igreja foram atualizados e já estão disponíveis para o sistema.</p>
            <button onClick={() => setMostrarModalSucesso(false)} className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition shadow-md">
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}