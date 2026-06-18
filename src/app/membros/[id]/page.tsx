"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../src/lib/supabase"; 
import { podeEditar, formatarPerfis } from "../../../../src/lib/permissoes";

export default function VerMembro() {
  const { id } = useParams(); 
  const router = useRouter(); 
  const [membro, setMembro] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  
  // Estado para armazenar os perfis do usuário logado e controlar os botões
  const [perfisUsuario, setPerfisUsuario] = useState<string[]>([]);

  useEffect(() => {
    async function buscarDetalhes() {
      // 1. RECUPERA A IGREJA DO USUÁRIO LOGADO
      const userLocal = localStorage.getItem("usuarioLogado");
      if (!userLocal) {
        router.push("/login");
        return;
      }
      
      const usuario = JSON.parse(userLocal);
      const igrejaId = usuario.igreja_id;
      
      // Carrega os perfis para a trava visual
      setPerfisUsuario(formatarPerfis(usuario.perfis || usuario.nivel_acesso));

      // 2. APLICA A TRAVA NA BUSCA DO PERFIL
      const { data, error } = await supabase
        .from("membros")
        .select("*")
        .eq("id", id)
        .eq("igreja_id", igrejaId) // <-- TRAVA DE SEGURANÇA AQUI
        .single();

      if (error || !data) {
        console.error("Membro não encontrado ou acesso negado.");
      } else {
        setMembro(data);
      }
      setCarregando(false);
    }
    
    if (id) buscarDetalhes();
  }, [id, router]);

  if (carregando && !membro) {
    return <div className="text-center py-20 text-gray-500 font-medium">Carregando perfil...</div>;
  }

  if (!membro && !carregando) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center bg-white p-8 rounded-xl shadow-sm border border-red-100">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
        <p className="text-gray-500 text-sm mb-6">Este membro não existe ou não pertence à sua congregação.</p>
        <button onClick={() => router.push("/membros")} className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition">Voltar para a Lista</button>
      </div>
    );
  }

  const formatarData = (dataSql: string) => {
    if (!dataSql) return "-";
    const [ano, mes, dia] = dataSql.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  return (
    <>
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-md relative">
        
        {/* CABEÇALHO DO PERFIL */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 border-b pb-8 mb-8">
          
          {/* FOTO */}
          <div className="flex-shrink-0 mx-auto md:mx-0">
            {membro.foto_url ? (
              <img src={membro.foto_url} alt="Foto" className="w-32 h-32 rounded-full object-cover border-4 border-blue-50 shadow-lg" />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gray-100 border-4 border-gray-200 flex items-center justify-center shadow-lg">
                <span className="text-sm font-semibold text-gray-400 uppercase text-center leading-tight">Sem<br/>Foto</span>
              </div>
            )}
          </div>

          <div className="flex-1 w-full min-w-0 mt-4 md:mt-0">
            
            <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 w-full">
              
              {/* LADO ESQUERDO: Nome e Etiquetas */}
              <div className="flex-1 min-w-0 text-center md:text-left">
                
                <h1 className="text-3xl font-bold text-gray-900 break-words leading-tight">
                  {membro.nome_completo}
                </h1>
                
                {/* O BLOCO ALINHADO E SEPARADO EM LINHAS */}
                <div className="mt-3 flex flex-col items-center md:items-start gap-2 w-full">
                  
                  {/* Linha 1: Cargo e Status */}
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 w-full">
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold border border-blue-200">
                      {membro.cargo}
                    </span>
                    
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${membro.status === 'Ativo' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                      {membro.status}
                    </span>
                  </div>

                  {/* Linha 2: Congregação (Abaixo e alinhada) */}
                  <div className="flex items-center text-sm font-medium text-gray-600 whitespace-nowrap mt-1">
                    <svg className="w-4 h-4 mr-1.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                    </svg>
                    Congregação: <span className="ml-1 text-gray-900">{membro.congregacao || "Sede"}</span>
                  </div>
                  
                </div>
              </div>

              {/* LADO DIREITO: Botões */}
              <div className="flex flex-wrap justify-center md:justify-end gap-2 flex-shrink-0 mt-4 md:mt-0">
                <Link href="/membros" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition font-medium text-sm whitespace-nowrap">
                  Voltar
                </Link>
                
                <Link href={`/membros/${membro.id}/carteirinha`} className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition font-medium shadow-sm text-sm flex items-center gap-2 whitespace-nowrap">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path></svg>
                  Carteirinha
                </Link>
                
                {/* TRAVA VISUAL DE BOTÃO: Só exibe se o usuário logado puder editar membros */}
                {podeEditar(perfisUsuario, 'membros') && (
                  <Link href={`/membros/${membro.id}/editar`} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium shadow-sm text-sm whitespace-nowrap">
                    Editar
                  </Link>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* DADOS DETALHADOS */}
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Dados Pessoais</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-6 rounded-lg border border-gray-100">
              <div><span className="block text-xs font-semibold text-gray-500 uppercase">CPF</span><span className="text-gray-900 font-medium">{membro.cpf || "-"}</span></div>
              <div><span className="block text-xs font-semibold text-gray-500 uppercase">Data de Nascimento</span><span className="text-gray-900 font-medium">{formatarData(membro.data_nascimento)}</span></div>
              <div><span className="block text-xs font-semibold text-gray-500 uppercase">Estado Civil</span><span className="text-gray-900 font-medium">{membro.estado_civil || "-"}</span></div>
              <div><span className="block text-xs font-semibold text-gray-500 uppercase">Telefone</span><span className="text-gray-900 font-medium">{membro.telefone || "-"}</span></div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Endereço</h2>
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-100">
              <p className="text-gray-900 font-medium">{membro.endereco_rua ? `${membro.endereco_rua}, nº ${membro.endereco_numero || 'S/N'} - ${membro.endereco_bairro || ''}` : "Endereço não cadastrado."}</p>
              <p className="text-gray-600 mt-1">{membro.endereco_cidade_uf} {membro.endereco_cep ? `- CEP: ${membro.endereco_cep}` : ''}</p>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Dados Eclesiásticos</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-6 rounded-lg border border-gray-100">
              <div><span className="block text-xs font-semibold text-gray-500 uppercase">Congregação</span><span className="text-gray-900 font-medium">{membro.congregacao || "Sede"}</span></div>
              <div><span className="block text-xs font-semibold text-gray-500 uppercase">Data de Batismo</span><span className="text-gray-900 font-medium">{formatarData(membro.data_batismo)}</span></div>
              <div><span className="block text-xs font-semibold text-gray-500 uppercase">Igreja do Batismo</span><span className="text-gray-900 font-medium">{membro.igreja_batismo || "-"}</span></div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}