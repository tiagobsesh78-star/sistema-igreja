"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function ConfiguraçõesIgreja() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [logoArquivo, setFotoArquivo] = useState<File | null>(null);
  const [mostrarModalSucesso, setMostrarModalSucesso] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [configId, setConfigId] = useState<number | null>(null);

  const [dadosIgreja, setDadosIgreja] = useState({
    nome_igreja: "",
    nome_pastor: "",
    endereco_rua: "",
    endereco_numero: "",
    endereco_bairro: "",
    endereco_cidade_uf: "",
    endereco_cep: "",
    logo_url: "",
  });

  useEffect(() => {
    async function buscarConfiguracoes() {
      const { data, error } = await supabase
        .from("configuracao_igreja")
        .select("*")
        .maybeSingle();

      if (data) {
        setConfigId(data.id);
        setDadosIgreja({
          nome_igreja: data.nome_igreja || "",
          nome_pastor: data.nome_pastor || "",
          endereco_rua: data.endereco_rua || "",
          endereco_numero: data.endereco_numero || "",
          endereco_bairro: data.endereco_bairro || "",
          endereco_cidade_uf: data.endereco_cidade_uf || "",
          endereco_cep: data.endereco_cep || "",
          logo_url: data.logo_url || "",
        });
      }
      setCarregando(false);
    }
    buscarConfiguracoes();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
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
    setSalvando(true);
    let novaLogoUrl = dadosIgreja.logo_url;

    try {
      if (logoArquivo) {
        const nomeArquivo = `logo-${Date.now()}-${logoArquivo.name}`;
        const { error: erroUpload } = await supabase.storage.from("fotos").upload(nomeArquivo, logoArquivo);
        if (erroUpload) throw erroUpload;
        const { data: dataUrl } = supabase.storage.from("fotos").getPublicUrl(nomeArquivo);
        novaLogoUrl = dataUrl.publicUrl;
      }

      const dadosParaSalvar = {
        ...dadosIgreja,
        logo_url: novaLogoUrl,
      };

      if (configId) {
        const { error } = await supabase.from("configuracao_igreja").update(dadosParaSalvar).eq("id", configId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("configuracao_igreja").insert([dadosParaSalvar]);
        if (error) throw error;
      }

      setMostrarModalSucesso(true);
    } catch (error: any) {
      alert("Erro ao salvar configurações: " + error.message);
    } finally {
      setSalvando(false);
    }
  };

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
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Oficial da Igreja *</label>
              <input required name="nome_igreja" value={dadosIgreja.nome_igreja} onChange={handleChange} type="text" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Igreja Evangélica..." />
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

          <div className="pt-6 border-t mt-8">
            <button type="submit" disabled={salvando} className="w-full md:w-auto px-10 py-4 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 transition duration-300 shadow-lg disabled:bg-gray-400">
              {salvando ? "Salvando Informações..." : "Salvar Configurações"}
            </button>
          </div>
        </form>
      </div>

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