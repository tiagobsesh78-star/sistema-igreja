"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../../src/lib/supabase"; 

const PERFIS_DISPONIVEIS = [
  'Secretário',
  'Pastor/Presbítero',
  'Tesoureiro',
  'Patrimônio',
  'Líder',
  'Membro',
  'Congregado'
];

export default function EditarMembro() {
  const { id } = useParams();
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null);
  const [mostrarModalSucesso, setMostrarModalSucesso] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [igrejaIdLogada, setIgrejaIdLogada] = useState<string | null>(null);

  const [mostrarModalExclusao, setMostrarModalExclusao] = useState(false);
  const [mostrarModalExclusaoSucesso, setMostrarModalExclusaoSucesso] = useState(false);

  const [dadosMembro, setDadosMembro] = useState({
    nome_completo: "", genero: "Masculino", cpf: "", data_nascimento: "", estado_civil: "Solteiro(a)",
    telefone: "", endereco_rua: "", endereco_numero: "", endereco_bairro: "", endereco_cidade_uf: "",
    endereco_cep: "", data_batismo: "", igreja_batismo: "", cargo: "Membro", 
    status: "Ativo", 
    foto_url: "",
    congregacao: "",
    // Campos de acesso
    acessa_sistema: false,
    senha: "",
    nivel_acesso: "Membro",
    perfis: [] as string[] // Novo array de perfis
  });

  // Função para alternar a seleção dos perfis
  const togglePerfil = (perfil: string) => {
    setDadosMembro(prev => ({
      ...prev,
      perfis: prev.perfis.includes(perfil) 
        ? prev.perfis.filter(p => p !== perfil) 
        : [...prev.perfis, perfil]
    }));
  };

  useEffect(() => {
    // 1. RECUPERA A IGREJA DO UTILIZADOR LOGADO AO ABRIR A TELA
    const usuarioLocal = localStorage.getItem("usuarioLogado");
    let currentIgrejaId = null;
    
    if (!usuarioLocal) {
      alert("Sessão expirada. Faça login novamente.");
      router.push("/login");
      return;
    } else {
      const usuario = JSON.parse(usuarioLocal);
      currentIgrejaId = usuario.igreja_id;
      setIgrejaIdLogada(currentIgrejaId);
    }

    async function buscarMembro(igrejaId: string) {
      // 2. APLICA A TRAVA NA BUSCA: Só retorna se o membro for desta igreja
      const { data, error } = await supabase
        .from("membros")
        .select("*")
        .eq("id", id)
        .eq("igreja_id", igrejaId) // A TRAVA ESTÁ AQUI
        .single();

      if (error || !data) {
        alert("Erro ao carregar dados ou acesso negado a este membro.");
        router.push("/membros");
      } else {
        const cargosParaMenu: Record<string, string> = {
          "Obreira": "Obreiro", "Diaconisa": "Diácono", "Presbítera": "Presbítero", "Missionária": "Missionário", "Pastora": "Pastor"
        };
        const cargoParaExibir = cargosParaMenu[data.cargo] || data.cargo;

        // Migração suave: se o membro é antigo e não tem o array de perfis, transforma o nivel_acesso antigo num perfil
        let perfisAtuais = data.perfis || [];
        if (perfisAtuais.length === 0 && data.nivel_acesso) {
            perfisAtuais = [data.nivel_acesso];
        }

        setDadosMembro({
          nome_completo: data.nome_completo || "", genero: data.genero || "Masculino", cpf: data.cpf || "",
          data_nascimento: data.data_nascimento || "", estado_civil: data.estado_civil || "Solteiro(a)",
          telefone: data.telefone || "", endereco_rua: data.endereco_rua || "", endereco_numero: data.endereco_numero || "",
          endereco_bairro: data.endereco_bairro || "", endereco_cidade_uf: data.endereco_cidade_uf || "",
          endereco_cep: data.endereco_cep || "", data_batismo: data.data_batismo || "", igreja_batismo: data.igreja_batismo || "",
          cargo: cargoParaExibir || "Membro", 
          status: data.status || "Ativo", 
          foto_url: data.foto_url || "",
          congregacao: data.congregacao || "",
          // Puxa os dados de acesso do banco
          acessa_sistema: data.acessa_sistema || false,
          senha: data.senha || "",
          nivel_acesso: data.nivel_acesso || "Membro",
          perfis: perfisAtuais
        });
      }
      setCarregando(false);
    }
    
    if (id && id !== "novo" && currentIgrejaId) {
      buscarMembro(currentIgrejaId);
    } else if (id === "novo") {
      setCarregando(false);
    }
  }, [id, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "cpf") {
      let v = value.replace(/\D/g, ""); 
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      setDadosMembro({ ...dadosMembro, cpf: v });
    } else {
      setDadosMembro({ ...dadosMembro, [name]: value });
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) setFotoArquivo(e.dataTransfer.files[0]);
  };

  const atualizarMembro = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSalvando(true);
    let novaFotoUrl = dadosMembro.foto_url;

    if (!igrejaIdLogada) {
      alert("Erro de autenticação.");
      setSalvando(false);
      return;
    }

    try {
      // 🚨 Validação de CPF para login
      if (dadosMembro.acessa_sistema && dadosMembro.status === "Ativo" && dadosMembro.cpf.length < 14) {
        alert("Para manter o acesso ao sistema, o CPF deve estar preenchido corretamente.");
        setSalvando(false);
        return;
      }

      // Validação dos novos perfis
      if (dadosMembro.acessa_sistema && dadosMembro.status === "Ativo" && dadosMembro.perfis.length === 0) {
        alert("Selecione pelo menos um perfil de acesso para este utilizador.");
        setSalvando(false);
        return;
      }

      if (fotoArquivo) {
        const nomeArquivo = `${Date.now()}-${fotoArquivo.name}`;
        const { error: erroUpload } = await supabase.storage.from("fotos").upload(nomeArquivo, fotoArquivo);
        if (erroUpload) throw erroUpload;
        const { data: dataUrl } = supabase.storage.from("fotos").getPublicUrl(nomeArquivo);
        novaFotoUrl = dataUrl.publicUrl;
      }

      let cargoFinal = dadosMembro.cargo;
      if (dadosMembro.genero === "Feminino") {
        const cargosFemininos: Record<string, string> = {
          "Obreiro": "Obreira", "Diácono": "Diaconisa", "Presbítero": "Presbítera", "Missionário": "Missionária", "Pastor": "Pastora"
        };
        cargoFinal = cargosFemininos[cargoFinal] || cargoFinal;
      }

      // 🚨 REGRA DE NEGÓCIO: Se Inativo, bloqueia o acesso automaticamente
      let acessoFinal = dadosMembro.acessa_sistema;
      if (dadosMembro.status === "Inativo") {
        acessoFinal = false;
      }

      const dadosParaSalvar = {
        ...dadosMembro, 
        cargo: cargoFinal, 
        data_nascimento: dadosMembro.data_nascimento || null,
        data_batismo: dadosMembro.data_batismo || null, 
        foto_url: novaFotoUrl,
        // Garante que a regra de segurança seja enviada ao banco
        acessa_sistema: acessoFinal,
        perfis: acessoFinal ? dadosMembro.perfis : [],
        nivel_acesso: acessoFinal && dadosMembro.perfis.length > 0 ? dadosMembro.perfis[0] : "Membro" // Fallback retrocompatível
      };

      if (id === "novo") {
        // Se por acaso a URL /novo for acessada por este componente
        const { error } = await supabase.from("membros").insert([{...dadosParaSalvar, igreja_id: igrejaIdLogada}]);
        if (error) throw error;
      } else {
        // 3. APLICA A TRAVA NA ATUALIZAÇÃO E NA EXCLUSÃO (Segurança extra contra injeções)
        const { error } = await supabase
          .from("membros")
          .update(dadosParaSalvar)
          .eq("id", id)
          .eq("igreja_id", igrejaIdLogada); // TRAVA DE UPDATE AQUI
        
        if (error) throw error;
      }
      
      setMostrarModalSucesso(true);
    } catch (error: any) {
      alert("Erro ao atualizar: " + error.message);
      setSalvando(false);
    }
  };

  const pedirConfirmacaoExclusao = () => { setMostrarModalExclusao(true); };

  const confirmarEExcluir = async () => {
    setMostrarModalExclusao(false);
    setCarregando(true);
    
    // Trava de segurança extra na exclusão
    if (!igrejaIdLogada) return;

    const { error } = await supabase
      .from("membros")
      .delete()
      .eq("id", id)
      .eq("igreja_id", igrejaIdLogada); // TRAVA DE DELETE AQUI

    if (error) {
      alert("Erro ao excluir: " + error.message);
      setCarregando(false);
    } else {
      setMostrarModalExclusaoSucesso(true);
    }
  };

  const finalizarERedirecionarAtualizacao = () => { 
    if (id === "novo") router.push("/membros");
    else router.push(`/membros/${id}`); 
  };
  
  const finalizarERedirecionarExclusao = () => { router.push("/membros"); };

  if (carregando) return <div className="text-center py-20 text-gray-500 font-medium">Carregando formulário...</div>;

  const imagemPreview = fotoArquivo ? URL.createObjectURL(fotoArquivo) : dadosMembro.foto_url;

  return (
    <>
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md relative">
        <div className="flex justify-between items-center mb-8 border-b pb-4">
          <h1 className="text-3xl font-bold text-gray-800">{id === "novo" ? "Novo Cadastro" : "Editar Cadastro"}</h1>
          <button type="button" onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 font-medium">
            Cancelar
          </button>
        </div>

        <form onSubmit={atualizarMembro} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Completo *</label>
              <input required name="nome_completo" value={dadosMembro.nome_completo} onChange={handleChange} type="text" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Gênero</label>
              <select name="genero" value={dadosMembro.genero} onChange={handleChange} className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Data de Nascimento</label>
              <input name="data_nascimento" value={dadosMembro.data_nascimento} onChange={handleChange} type="date" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">CPF <span className="text-xs font-normal text-gray-500 ml-1">(Apenas números)</span></label>
              <input name="cpf" value={dadosMembro.cpf} onChange={handleChange} maxLength={14} type="text" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Estado Civil</label>
              <select name="estado_civil" value={dadosMembro.estado_civil} onChange={handleChange} className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Solteiro(a)">Solteiro(a)</option>
                <option value="Casado(a)">Casado(a)</option>
                <option value="Divorciado(a)">Divorciado(a)</option>
                <option value="Viúvo(a)">Viúvo(a)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">WhatsApp / Telefone</label>
              <input name="telefone" value={dadosMembro.telefone} onChange={handleChange} type="text" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-md space-y-4 border border-gray-100">
            <h2 className="font-bold text-blue-700 uppercase text-xs tracking-wider">Endereço Residencial</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Rua / Logradouro</label>
                <input name="endereco_rua" value={dadosMembro.endereco_rua} onChange={handleChange} type="text" className="w-full p-2 border rounded-md outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nº</label>
                <input name="endereco_numero" value={dadosMembro.endereco_numero} onChange={handleChange} type="text" className="w-full p-2 border rounded-md outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Bairro</label>
                <input name="endereco_bairro" value={dadosMembro.endereco_bairro} onChange={handleChange} type="text" className="w-full p-2 border rounded-md outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Cidade/Estado</label>
                <input name="endereco_cidade_uf" value={dadosMembro.endereco_cidade_uf} onChange={handleChange} type="text" className="w-full p-2 border rounded-md outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">CEP</label>
                <input name="endereco_cep" value={dadosMembro.endereco_cep} onChange={handleChange} type="text" className="w-full p-2 border rounded-md outline-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end mt-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Data de Batismo</label>
              <input name="data_batismo" value={dadosMembro.data_batismo} onChange={handleChange} type="date" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Igreja do Batismo</label>
              <input name="igreja_batismo" value={dadosMembro.igreja_batismo} onChange={handleChange} type="text" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Cargo / Função</label>
              <select name="cargo" value={dadosMembro.cargo} onChange={handleChange} className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Membro">Membro</option>
                <option value="Obreiro">Obreiro</option>
                <option value="Diácono">Diácono</option>
                <option value="Presbítero">Presbítero</option>
                <option value="Evangelista">Evangelista</option>
                <option value="Missionário">Missionário</option>
                <option value="Pastor">Pastor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Status na Igreja</label>
              <select name="status" value={dadosMembro.status} onChange={handleChange} className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo (Afastado/Mudou)</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Congregação / Igreja *</label>
              <input required name="congregacao" value={dadosMembro.congregacao} onChange={handleChange} type="text" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* ACESSO AO SISTEMA E PERFIS */}
          <div className="bg-blue-50 p-6 rounded-md border border-blue-100 mt-6 transition-all duration-300">
            
            {dadosMembro.status === "Inativo" && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm font-medium flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                O acesso ao sistema será automaticamente revogado ao salvar, pois o status do membro é "Inativo".
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <div className={dadosMembro.status === "Inativo" ? "opacity-50" : ""}>
                <h2 className="font-bold text-blue-800 uppercase text-xs tracking-wider">Acesso ao Sistema</h2>
                <p className="text-sm text-gray-600 mt-1">Permitir que este membro faça login (O CPF será o usuário).</p>
              </div>
              
              <div className={`flex rounded-lg border border-gray-200 overflow-hidden shadow-inner flex-shrink-0 ${dadosMembro.status === "Inativo" ? "opacity-50 pointer-events-none" : ""}`}>
                <button
                  type="button"
                  onClick={() => setDadosMembro({...dadosMembro, acessa_sistema: false})}
                  className={`px-5 py-2.5 text-sm font-semibold transition-colors duration-200 ${
                    !dadosMembro.acessa_sistema
                      ? "bg-red-600 text-white shadow-md"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Não
                </button>
                <button
                  type="button"
                  onClick={() => setDadosMembro({...dadosMembro, acessa_sistema: true})}
                  className={`px-5 py-2.5 text-sm font-semibold transition-colors duration-200 border-l border-gray-200 ${
                    dadosMembro.acessa_sistema
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Sim
                </button>
              </div>
            </div>

            {dadosMembro.acessa_sistema && dadosMembro.status === "Ativo" && (
              <div className="mt-5 pt-5 border-t border-blue-200">
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Senha de Acesso *</label>
                  <input 
                    name="senha" 
                    type="text" 
                    value={dadosMembro.senha}
                    onChange={handleChange}
                    required={dadosMembro.acessa_sistema}
                    className="w-full md:w-1/2 p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                    placeholder="Defina ou altere a senha" 
                  />
                </div>

                {/* NOVO QUADRO DE SELEÇÃO MÚLTIPLA DE PERFIS */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    Perfis de Acesso <span className="text-gray-500 font-normal text-xs ml-1">(Selecione um ou mais)</span>
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {PERFIS_DISPONIVEIS.map(perfil => (
                      <label 
                        key={perfil} 
                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all duration-200 select-none ${
                          dadosMembro.perfis.includes(perfil) 
                            ? 'bg-white border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,1)]' 
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={dadosMembro.perfis.includes(perfil)}
                          onChange={() => togglePerfil(perfil)}
                        />
                        <div className={`w-5 h-5 rounded border mr-3 flex items-center justify-center flex-shrink-0 transition-colors ${
                          dadosMembro.perfis.includes(perfil) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                        }`}>
                          {dadosMembro.perfis.includes(perfil) && (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-sm font-medium break-words leading-tight ${
                          dadosMembro.perfis.includes(perfil) ? 'text-blue-900' : 'text-gray-600'
                        }`}>
                          {perfil}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8">
            <label className="block text-sm font-bold text-gray-700 mb-2">Alterar Foto (Opcional)</label>
            <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`relative flex flex-col items-center justify-center w-full p-8 border-2 border-dashed rounded-xl transition-colors ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"}`}>
              <input type="file" id="foto-upload" accept="image/*" onChange={(e) => setFotoArquivo(e.target.files?.[0] || null)} className="hidden" />
              <label htmlFor="foto-upload" className="flex flex-col items-center justify-center cursor-pointer w-full h-full">
                {imagemPreview ? (
                  <div className="flex flex-col items-center text-center">
                    <img src={imagemPreview} alt="Preview" className="w-24 h-24 rounded-full object-cover shadow-md border-4 border-white mb-3" />
                    {fotoArquivo && <span className="text-sm font-semibold text-blue-700 mb-1">Nova Foto: {fotoArquivo.name}</span>}
                    <span className="text-xs text-gray-500 hover:underline">Clique ou arraste para trocar a foto atual</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                    </div>
                    <p className="mb-1 text-sm text-gray-600"><span className="font-bold text-blue-600">Clique para buscar</span> ou arraste a foto até aqui</p>
                    <p className="text-xs text-gray-400">Suporta JPG, PNG ou GIF</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div className="pt-6 border-t mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <button type="submit" disabled={salvando} className="w-full md:w-auto px-10 py-4 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 transition duration-300 shadow-lg disabled:bg-gray-400">
              {salvando ? "Salvando Alterações..." : "Atualizar Cadastro"}
            </button>

            {id && id !== "novo" && (
              <button 
                type="button" 
                onClick={pedirConfirmacaoExclusao} 
                className="w-full md:w-auto px-6 py-4 bg-red-600 text-white font-bold rounded-md hover:bg-red-700 transition duration-300 shadow-sm flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Excluir Membro
              </button>
            )}
          </div>
        </form>
      </div>

      {mostrarModalSucesso && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center transform transition-all">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Atualização Concluída!</h3>
            <p className="text-sm text-gray-500 mb-6">Os dados do membro foram atualizados com sucesso.</p>
            <button onClick={finalizarERedirecionarAtualizacao} className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition shadow-md">
              OK, voltar
            </button>
          </div>
        </div>
      )}

      {mostrarModalExclusao && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center transform transition-all">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmar Exclusão</h3>
            <p className="text-sm text-gray-500 mb-6">
              Tem certeza que deseja excluir este membro? Todos os dados serão perdidos e esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setMostrarModalExclusao(false)} className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition">
                Cancelar
              </button>
              <button onClick={confirmarEExcluir} className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition shadow-md">
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalExclusaoSucesso && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center transform transition-all">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Ação Concluída</h3>
            <p className="text-sm text-gray-500 mb-6">Membro excluído permanentemente.</p>
            <button onClick={finalizarERedirecionarExclusao} className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition shadow-md">
              OK, voltar para lista
            </button>
          </div>
        </div>
      )}
    </>
  );
}