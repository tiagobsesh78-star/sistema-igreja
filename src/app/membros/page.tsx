"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function ListaMembros() {
  const [membros, setMembros] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  // --- NOVOS ESTADOS PARA OS FILTROS ---
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroCargo, setFiltroCargo] = useState("Todos");

  useEffect(() => {
    async function buscarMembros() {
      const { data, error } = await supabase
        .from("membros")
        .select("*")
        .order("nome_completo", { ascending: true });

      if (error) {
        alert("Erro ao carregar a lista: " + error.message);
      } else {
        setMembros(data || []);
      }
      setCarregando(false);
    }

    buscarMembros();
  }, []);

  // --- INTELIGÊNCIA DE FILTRAGEM (Roda instantaneamente ao digitar) ---
  const membrosFiltrados = membros.filter((membro) => {
    // 1. Verifica se o texto digitado bate com o NOME ou o CPF
    const textoMatch = 
      membro.nome_completo?.toLowerCase().includes(termoBusca.toLowerCase()) ||
      (membro.cpf && membro.cpf.includes(termoBusca));
    
    // 2. Verifica se o cargo bate (ou se está selecionado "Todos")
    // Como temos masculino/feminino, verificamos se a palavra base está contida no cargo salvo
    const cargoMatch = 
      filtroCargo === "Todos" || 
      (membro.cargo && membro.cargo.includes(filtroCargo.replace("(a)", "").trim()));

    return textoMatch && cargoMatch;
  });
  // ------------------------------------------------------------------

  return (
    <div className="max-w-6xl mx-auto bg-white p-6 md:p-8 rounded-lg shadow-md">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800">
          Membros Cadastrados
        </h1>
        <Link 
          href="/membros/novo" 
          className="w-full md:w-auto text-center px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition duration-300 shadow-sm"
        >
          + Novo Membro
        </Link>
      </div>

      {/* BARRA DE PESQUISA E FILTROS */}
      <div className="flex flex-col md:flex-row gap-4 mb-8 bg-gray-50 p-4 rounded-lg border border-gray-100">
        
        {/* Busca por Texto */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          <input
            type="text"
            className="w-full p-3 pl-10 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="Buscar por nome ou CPF..."
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
          />
        </div>

        {/* Filtro por Cargo */}
        <div className="w-full md:w-64">
          <select
            className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer"
            value={filtroCargo}
            onChange={(e) => setFiltroCargo(e.target.value)}
          >
            <option value="Todos">Todos os Cargos</option>
            <option value="Membro">Membros</option>
            <option value="Obreir">Obreiros(as)</option>
            <option value="Diácon">Diáconos / Diaconisas</option>
            <option value="Presbíter">Presbíteros(as)</option>
            <option value="Evangelista">Evangelistas</option>
            <option value="Missionári">Missionários(as)</option>
            <option value="Pastor">Pastores(as)</option>
          </select>
        </div>
      </div>

      {/* TABELA DE MEMBROS */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        {carregando ? (
          <div className="text-center py-10 text-gray-500 font-medium">Carregando membros...</div>
        ) : (
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider border-b">
                <th className="p-4 font-semibold">Membro</th>
                <th className="p-4 font-semibold">Cargo</th>
                <th className="p-4 font-semibold">Telefone</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              
              {membros.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-gray-500">
                    Nenhum membro cadastrado ainda.
                  </td>
                </tr>
              ) : membrosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      Nenhum resultado encontrado para "<strong>{termoBusca}</strong>".
                    </div>
                  </td>
                </tr>
              ) : (
                // Usamos a lista FILTRADA para desenhar a tabela
                membrosFiltrados.map((membro) => (
                  <tr key={membro.id} className="border-b hover:bg-gray-50 transition duration-150">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {membro.foto_url ? (
                          <img src={membro.foto_url} alt="Foto" className="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-sm"/>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shadow-sm">
                            <span className="text-[9px] font-semibold text-gray-400 uppercase text-center leading-tight">Sem<br/>Foto</span>
                          </div>
                        )}
                        <span className="font-medium text-gray-900">{membro.nome_completo}</span>
                      </div>
                    </td>

                    <td className="p-4 font-medium text-gray-700">{membro.cargo}</td>
                    <td className="p-4">{membro.telefone || "-"}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${membro.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {membro.status}
                      </span>
                    </td>
                    <td className="p-4 text-center space-x-3 flex justify-center items-center h-full mt-2">
                      <Link href={`/membros/${membro.id}`} className="text-blue-600 hover:text-blue-800 font-bold text-sm transition">
                        Ver
                      </Link>
                      <span className="text-gray-300">|</span>
                      <Link href={`/membros/${membro.id}/editar`} className="text-orange-500 hover:text-orange-700 font-bold text-sm transition">
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))
              )}

            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}