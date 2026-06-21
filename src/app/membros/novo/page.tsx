"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { podeEditar, formatarPerfis } from "../../../lib/permissoes";

const PERFIS_DISPONIVEIS = [
  'Secretário',
  'Pastor/Presbítero',
  'Tesoureiro',
  'Patrimônio',
  'Líder',
  'Membro',
  'Congregado'
];

export default function NovoMembro() {
  const router = useRouter();

  // 1. TODOS OS STATES DEVEM FICAR NO TOPO DA FUNÇÃO
  const [carregando, setCarregando] = useState(false);
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null);
  const [mostrarModalSucesso, setMostrarModalSucesso] = useState(false);
  const [cpfFormatado, setCpfFormatado] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [acessaSistema, setAcessaSistema] = useState(false);
  const [perfisSelecionados, setPerfisSelecionados] = useState<string[]>(['Membro']);

  // 2. O EFFECT EXECUTA A TRAVA DE SEGURANÇA SEM QUEBRAR A ORDEM DE RENDERIZAÇÃO
  useEffect(() => {
    const usuarioLocal = localStorage.getItem("usuarioLogado");
    if (!usuarioLocal) {
      router.push("/login");
      return;
    }
    
    const usuario = JSON.parse(usuarioLocal);
    const perfisUsuarioLogado = formatarPerfis(usuario.perfis || usuario.nivel_acesso);
    
    // ==================================================
    // TRAVA DE ROTA: CHUTA INVASORES PELA URL PARA A HOME
    // ==================================================
    if (!podeEditar(perfisUsuarioLogado, 'membros')) {
      router.push("/");
    }
    // ==================================================
  }, [router]);

  // ==================================================
  // FUNÇÃO DE COMPRESSÃO DE IMAGEM NO LADO DO CLIENTE
  // ==================================================
  const comprimirImagem = (arquivoOriginal: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      
      leitor.onload = (eventoBase64) => {
        const imagemElemento = new Image();
        imagemElemento.src = eventoBase64.target?.result as string;
        
        imagemElemento.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          
          if (!ctx) {
            reject(new Error("Não foi possível processar a imagem."));
            return;
          }

          // Define as dimensões máximas (800x800 é ótimo para perfil/carteirinha mantendo proporção)
          const MAX_LARGURA = 800;
          const MAX_ALTURA = 800;
          let largura = imagemElemento.width;
          let altura = imagemElemento.height;

          // Calcula a nova proporção sem distorcer a imagem
          if (largura > altura) {
            if (largura > MAX_LARGURA) {
              altura *= MAX_LARGURA / largura;
              largura = MAX_LARGURA;
            }
          } else {
            if (altura > MAX_ALTURA) {
              largura *= MAX_ALTURA / altura;
              altura = MAX_ALTURA;
            }
          }

          canvas.width = largura;
          canvas.height = altura;

          // Desenha a imagem redimensionada no canvas
          ctx.drawImage(imagemElemento, 0, 0, largura, altura);

          // Converte o canvas para um arquivo JPG (qualidade 0.8 = 80%, excelente equilíbrio)
          canvas.toBlob(
            (blob) => {
              if (blob) {
                // Cria o novo arquivo compactado
                const arquivoComprimido = new File([blob], arquivoOriginal.name.replace(/\.[^/.]+$/, ".jpg"), {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(arquivoComprimido);
              } else {
                reject(new Error("Falha ao criar o arquivo da imagem."));
              }
            },
            "image/jpeg",
            0.8 
          );
        };
        
        imagemElemento.onerror = () => reject(new Error("Falha ao carregar a imagem selecionada."));
      };

      leitor.onerror = () => reject(new Error("Falha na leitura do arquivo."));
      
      // Inicia a leitura do arquivo original
      leitor.readAsDataURL(arquivoOriginal);
    });
  };

  // Processa o arquivo selecionado ou solto na área de drag
  const processarArquivoFoto = async (arquivoOriginal: File) => {
    // 1MB = 1 * 1024 * 1024 bytes (Trava Inicial de Segurança para arquivos absurdamente gigantes que travariam o navegador, ex 50MB)
    const TRAVA_SEGURANCA_MB = 15 * 1024 * 1024; 
    if (arquivoOriginal.size > TRAVA_SEGURANCA_MB) {
        alert("A imagem selecionada é muito grande (acima de 15MB). Por favor, selecione uma foto um pouco menor.");
        return;
    }

    try {
        setCarregando(true); // Opcional, para dar feedback que está processando
        const arquivoFinal = await comprimirImagem(arquivoOriginal);
        
        // Verifica o tamanho final após a compressão (1MB máximo estrito)
        if (arquivoFinal.size > 1024 * 1024) {
            alert("A imagem ainda ficou muito pesada após otimização. Selecione uma imagem com menos detalhes ou resolução menor.");
            setFotoArquivo(null);
        } else {
            setFotoArquivo(arquivoFinal);
        }
    } catch (erro) {
        console.error("Erro na compressão:", erro);
        alert("Ocorreu um erro ao otimizar a imagem. Tente enviar outra foto.");
    } finally {
        setCarregando(false);
    }
  };


  // 3. FUNÇÕES COMUNS
  const togglePerfil = (perfil: string) => {
    setPerfisSelecionados(prev => 
      prev.includes(perfil) 
        ? prev.filter(p => p !== perfil) 
        : [...prev, perfil]
    );
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e || !e.target) return;
    const val = e.target.value || "";
    let valor = val.replace(/\D/g, ""); 
    
    if (valor && valor.length > 11) valor = valor.slice(0, 11);
    
    valor = valor.replace(/(\d{3})(\d)/, "$1.$2"); 
    valor = valor.replace(/(\d{3})(\d)/, "$1.$2"); 
    valor = valor.replace(/(\d{3})(\d{1,2})$/, "$1-$2"); 
    setCpfFormatado(valor);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processarArquivoFoto(e.dataTransfer.files[0]);
    }
  };

  const salvarMembro = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCarregando(true);

    try {
      const usuarioLocal = localStorage.getItem("usuarioLogado");
      if (!usuarioLocal) {
        alert("Sessão expirada. Faça login novamente.");
        router.push("/login");
        return;
      }
      
      const usuario = JSON.parse(usuarioLocal) || {};
      let igrejaId = usuario?.igreja_id || usuario?.id_igreja || usuario?.idIgreja;
      
      if (!igrejaId && Array.isArray(usuario?.igrejas) && usuario.igrejas.length > 0) {
        igrejaId = usuario.igrejas[0]?.id || usuario.igrejas[0]?.igreja_id;
      }

      if (!igrejaId) {
        alert("Ação negada: O Administrador não está vinculado a nenhuma igreja no momento.");
        setCarregando(false);
        return;
      }

      const formData = new FormData(e.currentTarget);
      let fotoUrl = null;

      const tamanhoCpf = cpfFormatado ? cpfFormatado.length : 0;
      if (acessaSistema && tamanhoCpf < 14) {
        alert("Para dar acesso ao sistema, o CPF deve ser preenchido corretamente, pois será o login.");
        setCarregando(false);
        return;
      }

      if (acessaSistema && perfisSelecionados.length === 0) {
        alert("Selecione pelo menos um perfil de acesso para este utilizador.");
        setCarregando(false);
        return;
      }

      if (fotoArquivo) {
        const nomeArquivo = `${Date.now()}-${fotoArquivo.name}`;
        const { error: erroUpload } = await supabase.storage.from("fotos").upload(nomeArquivo, fotoArquivo);
        if (erroUpload) throw erroUpload;
        const { data: dataUrl } = supabase.storage.from("fotos").getPublicUrl(nomeArquivo);
        fotoUrl = dataUrl.publicUrl;
      }

      const generoSelecionado = (formData.get("genero") as string) || "Masculino";
      let cargoFinal = (formData.get("cargo") as string) || "Membro";
      
      if (generoSelecionado === "Feminino") {
        const cargosFemininos: Record<string, string> = {
          "Obreiro": "Obreira", "Diácono": "Diaconisa", "Presbítero": "Presbítera", "Missionário": "Missionária", "Pastor": "Pastora"
        };
        cargoFinal = cargosFemininos[cargoFinal] || cargoFinal;
      }

      const dadosMembro = {
        igreja_id: igrejaId,
        nome_completo: formData.get("nome_completo") || "", 
        genero: generoSelecionado, 
        cpf: cpfFormatado || "",
        data_nascimento: formData.get("data_nascimento") || null, 
        estado_civil: formData.get("estado_civil") || "",
        telefone: formData.get("telefone") || "", 
        endereco_rua: formData.get("endereco_rua") || "", 
        endereco_numero: formData.get("endereco_numero") || "",
        endereco_bairro: formData.get("endereco_bairro") || "", 
        endereco_cidade_uf: formData.get("endereco_cidade_uf") || "",
        endereco_cep: formData.get("endereco_cep") || "", 
        data_batismo: formData.get("data_batismo") || null,
        igreja_batismo: formData.get("igreja_batismo") || "", 
        cargo: cargoFinal, 
        foto_url: fotoUrl, 
        congregacao: formData.get("congregacao") || "",
        acessa_sistema: acessaSistema,
        senha: acessaSistema ? formData.get("senha") : null,
        perfis: acessaSistema ? perfisSelecionados : [], 
        nivel_acesso: acessaSistema ? perfisSelecionados[0] : "Membro" 
      };

      const { error } = await supabase.from("membros").insert([dadosMembro]);
      if (error) throw error;

      setMostrarModalSucesso(true);
    } catch (error: any) {
      alert("Erro no processo: " + (error?.message || "Erro desconhecido."));
    } finally {
      setCarregando(false);
    }
  };

  const finalizarERedirecionar = () => { router.push("/membros"); };

  return (
    <>
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md relative">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 border-b pb-4">Novo Cadastro de Membro</h1>

        <form onSubmit={salvarMembro} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Completo *</label>
              <input required name="nome_completo" type="text" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Maria Silva" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Gênero</label>
              <select name="genero" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Data de Nascimento</label>
              <input name="data_nascimento" type="date" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                CPF <span className="text-xs font-normal text-gray-500 ml-1">(Apenas números)</span>
              </label>
              <input 
                name="cpf" 
                value={cpfFormatado}
                onChange={handleCpfChange}
                maxLength={14}
                type="text" 
                className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500" 
                placeholder="000.000.000-00" 
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Estado Civil</label>
              <select name="estado_civil" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Solteiro(a)">Solteiro(a)</option>
                <option value="Casado(a)">Casado(a)</option>
                <option value="Divorciado(a)">Divorciado(a)</option>
                <option value="Viúvo(a)">Viúvo(a)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">WhatsApp / Telefone</label>
              <input name="telefone" type="text" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500" placeholder="(84) 99999-9999" />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-md space-y-4 mt-6 border border-gray-100">
            <h2 className="font-bold text-blue-700 uppercase text-xs tracking-wider">Endereço Residencial</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Rua / Logradouro</label>
                <input name="endereco_rua" type="text" className="w-full p-2 border rounded-md outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nº</label>
                <input name="endereco_numero" type="text" className="w-full p-2 border rounded-md outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Bairro</label>
                <input name="endereco_bairro" type="text" className="w-full p-2 border rounded-md outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Cidade/Estado</label>
                <input name="endereco_cidade_uf" type="text" className="w-full p-2 border rounded-md outline-none" placeholder="Natal/RN" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">CEP</label>
                <input name="endereco_cep" type="text" className="w-full p-2 border rounded-md outline-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end mt-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Data de Batismo</label>
              <input name="data_batismo" type="date" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Igreja do Batismo</label>
              <input name="igreja_batismo" type="text" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Cargo / Função</label>
              <select name="cargo" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500">
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
              <label className="block text-sm font-semibold text-gray-700 mb-1">Congregação / Igreja *</label>
              <input required name="congregacao" type="text" className="w-full p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Sede, Extensão..." />
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-md border border-blue-100 mt-6 transition-all duration-300">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-blue-800 uppercase text-xs tracking-wider">Acesso ao Sistema</h2>
                <p className="text-sm text-gray-600 mt-1">Permitir que este membro faça login (O CPF será o usuário).</p>
              </div>
              
              <div className="flex rounded-lg border border-gray-200 overflow-hidden shadow-inner flex-shrink-0">
                <button
                  type="button" 
                  onClick={() => setAcessaSistema(false)}
                  className={`px-5 py-2.5 text-sm font-semibold transition-colors duration-200 ${
                    !acessaSistema ? "bg-red-600 text-white shadow-md" : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Não
                </button>

                <button
                  type="button" 
                  onClick={() => setAcessaSistema(true)}
                  className={`px-5 py-2.5 text-sm font-semibold transition-colors duration-200 border-l border-gray-200 ${
                    acessaSistema ? "bg-blue-600 text-white shadow-md" : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Sim
                </button>
              </div>
            </div>

            {acessaSistema && (
              <div className="mt-5 pt-5 border-t border-blue-200">
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Senha Provisória *</label>
                  <input 
                    name="senha" 
                    type="text" 
                    required={acessaSistema}
                    className="w-full md:w-1/2 p-3 border rounded-md outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                    placeholder="Defina uma senha" 
                  />
                </div>

                {/* QUADRO DE SELEÇÃO MÚLTIPLA DE PERFIS */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    Perfis de Acesso <span className="text-gray-500 font-normal text-xs ml-1">(Selecione um ou mais)</span>
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {PERFIS_DISPONIVEIS.map(perfil => (
                      <label 
                        key={perfil} 
                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all duration-200 select-none ${
                          perfisSelecionados.includes(perfil) 
                            ? 'bg-white border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,1)]' 
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={perfisSelecionados.includes(perfil)}
                          onChange={() => togglePerfil(perfil)}
                        />
                        <div className={`w-5 h-5 rounded border mr-3 flex items-center justify-center flex-shrink-0 transition-colors ${
                          perfisSelecionados.includes(perfil) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                        }`}>
                          {perfisSelecionados.includes(perfil) && (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-sm font-medium break-words leading-tight ${
                          perfisSelecionados.includes(perfil) ? 'text-blue-900' : 'text-gray-600'
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
            <label className="block text-sm font-bold text-gray-700 mb-2">Foto do Perfil (Opcional)</label>
            <div 
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center w-full p-8 border-2 border-dashed rounded-xl transition-colors ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"}`}
            >
              <input 
                type="file" 
                id="foto-upload" 
                accept="image/*" 
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    processarArquivoFoto(e.target.files[0]);
                  }
                }} 
                className="hidden" 
              />
              <label htmlFor="foto-upload" className="flex flex-col items-center justify-center cursor-pointer w-full h-full">
                {fotoArquivo ? (
                  <div className="flex flex-col items-center text-center">
                    <img src={URL.createObjectURL(fotoArquivo)} alt="Preview" className="w-24 h-24 rounded-full object-cover shadow-md border-4 border-white mb-3" />
                    <span className="text-sm font-semibold text-blue-700">{fotoArquivo.name}</span>
                    <span className="text-xs text-gray-500 mt-1 hover:underline">Clique para trocar a foto</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                    </div>
                    <p className="mb-1 text-sm text-gray-600"><span className="font-bold text-blue-600">Clique para buscar</span> ou arraste a foto até aqui</p>
                    <p className="text-xs text-gray-400">A imagem será otimizada automaticamente</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div className="pt-6 border-t mt-8 flex flex-col md:flex-row items-center gap-4">
            <button type="submit" disabled={carregando} className="w-full md:w-auto px-10 py-4 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 transition duration-300 shadow-lg disabled:bg-gray-400">
              {carregando ? "Enviando Dados..." : "Finalizar Cadastro"}
            </button>
            
            <button type="button" onClick={() => router.back()} disabled={carregando} className="w-full md:w-auto px-10 py-4 bg-white border border-gray-300 text-gray-700 font-bold rounded-md hover:bg-gray-50 transition duration-300 shadow-sm disabled:opacity-50">
              Cancelar
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
            <h3 className="text-lg font-bold text-gray-900 mb-2">Cadastro Concluído!</h3>
            <p className="text-sm text-gray-500 mb-6">O novo membro foi salvo com sucesso no sistema.</p>
            <button onClick={finalizarERedirecionar} className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition shadow-md">
              OK, ver lista de membros
            </button>
          </div>
        </div>
      )}
    </>
  );
}