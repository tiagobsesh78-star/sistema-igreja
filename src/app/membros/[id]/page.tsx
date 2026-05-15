"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../src/lib/supabase"; 

export default function VerMembro() {
  const { id } = useParams(); 
  const router = useRouter(); 
  const [membro, setMembro] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);

  // --- NOVOS ESTADOS PARA AS JANELAS FLUTUANTES (MODAIS) ---
  const [mostrarModalExclusao, setMostrarModalExclusao] = useState(false);
  const [mostrarModalSucesso, setMostrarModalSucesso] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  useEffect(() => {
    async function buscarDetalhes() {
      const { data, error } = await supabase.from("membros").select("*").eq("id", id).single();
      if (error) {
        alert("Erro ao carregar os dados do membro.");
      } else {
        setMembro(data);
      }
      setCarregando(false);
    }
    if (id) buscarDetalhes();
  }, [id]);

  // Função que APENAS abre a caixinha de pergunta
  const pedirConfirmacaoExclusao = () => {
    setMostrarModalExclusao(true);
  };

  // Função que REALMENTE vai no banco e apaga
  const confirmarEExcluir = async () => {
    setMostrarModalExclusao(false); // Fecha a pergunta
    setCarregando(true); // Mostra que está processando

    const { error } = await supabase.from("membros").delete().eq("id", id);

    if (error) {
      alert("Erro ao excluir: " + error.message);
      setCarregando(false);
    } else {
      // Em vez do alert feio, abrimos nossa modal bonita
      setMensagemSucesso("Membro excluído permanentemente.");
      setMostrarModalSucesso(true);
    }
  };

  // Função para quando a pessoa clicar em "OK" na tela de sucesso
  const finalizarERedirecionar = () => {
    router.push("/membros");
  };

  if (carregando && !membro) {
    return <div className="text-center py-20 text-gray-500 font-medium">Carregando perfil...</div>;
  }

  if (!membro && !carregando) {
    return <div className="text-center py-20 text-red-500 font-medium">Membro não encontrado.</div>;
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
          <div className="flex-shrink-0">
            {membro.foto_url ? (
              <img src={membro.foto_url} alt="Foto" className="w-32 h-32 rounded-full object-cover border-4 border-blue-50 shadow-lg" />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gray-100 border-4 border-gray-200 flex items-center justify-center shadow-lg">
                <span className="text-sm font-semibold text-gray-400 uppercase text-center leading-tight">Sem<br/>Foto</span>
              </div>
            )}
          </div>

          <div className="flex-1 text-center md:text-left mt-4 md:mt-0">
            <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{membro.nome_completo}</h1>
                <div className="mt-2 space-x-3">
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">{membro.cargo}</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${membro.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{membro.status}</span>
                </div>
              </div>

{/* BOTÕES */}
<div className="flex flex-wrap gap-2">
  <Link href="/membros" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition font-medium text-sm">Voltar</Link>
  
  {/* NOVO BOTÃO DA CARTEIRINHA */}
  <Link href={`/membros/${membro.id}/carteirinha`} className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition font-medium shadow-sm text-sm flex items-center gap-2">
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path></svg>
    Carteirinha
  </Link>
  
  <Link href={`/membros/${membro.id}/editar`} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium shadow-sm text-sm">Editar</Link>
  <button onClick={pedirConfirmacaoExclusao} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition font-medium shadow-sm text-sm">Excluir</button>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-lg border border-gray-100">
              <div><span className="block text-xs font-semibold text-gray-500 uppercase">Data de Batismo</span><span className="text-gray-900 font-medium">{formatarData(membro.data_batismo)}</span></div>
              <div><span className="block text-xs font-semibold text-gray-500 uppercase">Igreja do Batismo</span><span className="text-gray-900 font-medium">{membro.igreja_batismo || "-"}</span></div>
            </div>
          </section>
        </div>
      </div>

      {/* ========================================== */}
      {/* NOSSAS CAIXINHAS FLUTUANTES (MODAIS) AQUI! */}
      {/* ========================================== */}

      {/* 1. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {mostrarModalExclusao && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center transform transition-all">
            {/* Ícone de Alerta */}
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmar Exclusão</h3>
            <p className="text-sm text-gray-500 mb-6">
              Tem certeza que deseja excluir <strong>{membro.nome_completo}</strong>? Todos os dados serão perdidos e esta ação não pode ser desfeita.
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

      {/* 2. MODAL DE SUCESSO */}
      {mostrarModalSucesso && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center transform transition-all">
            {/* Ícone de Sucesso */}
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Ação Concluída</h3>
            <p className="text-sm text-gray-500 mb-6">{mensagemSucesso}</p>
            <button onClick={finalizarERedirecionar} className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition shadow-md">
              OK, voltar para lista
            </button>
          </div>
        </div>
      )}
    </>
  );
}