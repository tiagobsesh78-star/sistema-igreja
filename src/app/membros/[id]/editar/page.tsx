"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../src/lib/supabase"; 

export default function EditarMembro() {
  const { id } = useParams();
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null);
  const [mostrarModalSucesso, setMostrarModalSucesso] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [dadosMembro, setDadosMembro] = useState({
    nome_completo: "", genero: "Masculino", cpf: "", data_nascimento: "", estado_civil: "Solteiro(a)",
    telefone: "", endereco_rua: "", endereco_numero: "", endereco_bairro: "", endereco_cidade_uf: "",
    endereco_cep: "", data_batismo: "", igreja_batismo: "", cargo: "Membro", 
    status: "Ativo", // ADICIONADO O STATUS AQUI
    foto_url: "",
  });

  useEffect(() => {
    async function buscarMembro() {
      const { data, error } = await supabase.from("membros").select("*").eq("id", id).single();
      if (error) {
        alert("Erro ao carregar dados.");
        router.push("/membros");
      } else {
        const cargosParaMenu: Record<string, string> = {
          "Obreira": "Obreiro", "Diaconisa": "Diácono", "Presbítera": "Presbítero", "Missionária": "Missionário", "Pastora": "Pastor"
        };
        const cargoParaExibir = cargosParaMenu[data.cargo] || data.cargo;

        setDadosMembro({
          nome_completo: data.nome_completo || "", genero: data.genero || "Masculino", cpf: data.cpf || "",
          data_nascimento: data.data_nascimento || "", estado_civil: data.estado_civil || "Solteiro(a)",
          telefone: data.telefone || "", endereco_rua: data.endereco_rua || "", endereco_numero: data.endereco_numero || "",
          endereco_bairro: data.endereco_bairro || "", endereco_cidade_uf: data.endereco_cidade_uf || "",
          endereco_cep: data.endereco_cep || "", data_batismo: data.data_batismo || "", igreja_batismo: data.igreja_batismo || "",
          cargo: cargoParaExibir || "Membro", 
          status: data.status || "Ativo", // PUXANDO DO BANCO
          foto_url: data.foto_url || "",
        });
      }
      setCarregando(false);
    }
    if (id) buscarMembro();
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

    try {
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

      const dadosParaSalvar = {
        ...dadosMembro, cargo: cargoFinal, data_nascimento: dadosMembro.data_nascimento || null,
        data_batismo: dadosMembro.data_batismo || null, foto_url: novaFotoUrl,
      };

      const { error } = await supabase.from("membros").update(dadosParaSalvar).eq("id", id);
      if (error) throw error;
      setMostrarModalSucesso(true);
    } catch (error: any) {
      alert("Erro ao atualizar: " + error.message);
      setSalvando(false);
    }
  };

  const finalizarERedirecionar = () => { router.push(`/membros/${id}`); };

  if (carregando) return <div className="text-center py-20 text-gray-500 font-medium">Carregando formulário...</div>;

  const imagemPreview = fotoArquivo ? URL.createObjectURL(fotoArquivo) : dadosMembro.foto_url;

  return (
    <>
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md relative">
      <div className="flex justify-between items-center mb-8 border-b pb-4">
  <h1 className="text-3xl font-bold text-gray-800">Editar Cadastro</h1>
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

          <div className="pt-6 border-t mt-8">
            <button type="submit" disabled={salvando} className="w-full md:w-auto px-10 py-4 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 transition duration-300 shadow-lg disabled:bg-gray-400">
              {salvando ? "Salvando Alterações..." : "Atualizar Cadastro"}
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
            <h3 className="text-lg font-bold text-gray-900 mb-2">Atualização Concluída!</h3>
            <p className="text-sm text-gray-500 mb-6">Os dados do membro foram atualizados com sucesso.</p>
            <button onClick={finalizarERedirecionar} className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition shadow-md">
              OK, voltar para o perfil
            </button>
          </div>
        </div>
      )}
    </>
  );
}