"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../src/lib/supabase";

// Dicionários para inteligência dos filtros de cargo
const paraMasculino: Record<string, string> = {
  "Obreira": "Obreiro",
  "Diaconisa": "Diácono",
  "Presbítera": "Presbítero",
  "Missionária": "Missionário",
  "Pastora": "Pastor"
};

const cargosEquivalentes: Record<string, string[]> = {
  "Obreiro": ["Obreiro", "Obreira"],
  "Diácono": ["Diácono", "Diaconisa"],
  "Presbítero": ["Presbítero", "Presbítera"],
  "Missionário": ["Missionário", "Missionária"],
  "Pastor": ["Pastor", "Pastora"],
};

export default function MembrosPage() {
  const [membros, setMembros] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  
  const [busca, setBusca] = useState("");
  const [cargoFiltro, setCargoFiltro] = useState("");
  const [congregacaoFiltro, setCongregacaoFiltro] = useState("");
  
  const [ordemColuna, setOrdemColuna] = useState("nome_completo");
  const [ordemDirecao, setOrdemDirecao] = useState<"asc" | "desc">("asc");
  
  const [selecionados, setSelecionados] = useState<number[]>([]);

  useEffect(() => {
    buscarMembros();
  }, []);

  async function buscarMembros() {
    // 1. Recupera o utilizador logado para saber de qual igreja ele é
    const usuarioLocal = localStorage.getItem("usuarioLogado");
    
    if (!usuarioLocal) {
      setCarregando(false);
      return; // Se não estiver logado, nem tenta procurar
    }

    const usuario = JSON.parse(usuarioLocal);

    // 2. Faz a procura no banco FILTRANDO pela igreja_id do utilizador
    const { data, error } = await supabase
      .from("membros")
      .select("*")
      .eq("igreja_id", usuario.igreja_id); // <-- A TRAVA MULTI-TENANT AQUI

    if (!error && data) setMembros(data);
    setCarregando(false);
  }

  const membrosFiltrados = membros.filter((m) => {
    const nome = m.nome_completo || "";
    const cpf = m.cpf || "";
    const matchBusca = nome.toLowerCase().includes(busca.toLowerCase()) || cpf.includes(busca);
    
    // Nova lógica inteligente para unificar o filtro de cargo
    const matchCargo = cargoFiltro === "" || 
      (cargosEquivalentes[cargoFiltro] 
        ? cargosEquivalentes[cargoFiltro].includes(m.cargo) 
        : m.cargo === cargoFiltro);
        
    const matchCongregacao = congregacaoFiltro === "" || m.congregacao === congregacaoFiltro;
    
    return matchBusca && matchCargo && matchCongregacao;
  });

  const membrosProcessados = [...membrosFiltrados].sort((a, b) => {
    let valorA = a[ordemColuna] || "";
    let valorB = b[ordemColuna] || "";
    
    if (typeof valorA === 'string') valorA = valorA.toLowerCase();
    if (typeof valorB === 'string') valorB = valorB.toLowerCase();

    if (valorA < valorB) return ordemDirecao === "asc" ? -1 : 1;
    if (valorA > valorB) return ordemDirecao === "asc" ? 1 : -1;
    return 0;
  });

  // Unifica os cargos femininos para o masculino apenas para exibição no Menu
  const cargosUnicos = Array.from(
    new Set(membros.map(m => paraMasculino[m.cargo] || m.cargo).filter(Boolean))
  ).sort();
  
  const congregacoesUnicas = Array.from(new Set(membros.map(m => m.congregacao).filter(Boolean))).sort();

  const handleSort = (coluna: string) => {
    if (ordemColuna === coluna) {
      setOrdemDirecao(ordemDirecao === "asc" ? "desc" : "asc");
    } else {
      setOrdemColuna(coluna);
      setOrdemDirecao("asc");
    }
  };

  const toggleTodos = () => {
    if (selecionados.length === membrosProcessados.length && membrosProcessados.length > 0) {
      setSelecionados([]);
    } else {
      setSelecionados(membrosProcessados.map((m) => m.id));
    }
  };

  const toggleSelecao = (id: number) => {
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter((item) => item !== id));
    } else {
      setSelecionados([...selecionados, id]);
    }
  };

  const renderIconeOrdenacao = (coluna: string) => {
    if (ordemColuna !== coluna) return <svg className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
    if (ordemDirecao === 'asc') return <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>;
    return <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>;
  };

  if (carregando) return <div className="text-center py-20 text-gray-500 font-medium">Carregando membros...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Membros Cadastrados</h1>
          <div className="flex flex-wrap md:flex-nowrap gap-3 justify-center md:justify-end">
            {selecionados.length > 0 && (
              <Link 
                href={`/membros/lote?ids=${selecionados.join(',')}`}
                className="px-4 py-2 bg-teal-600 text-white font-medium rounded shadow-sm text-sm flex items-center justify-center gap-2 whitespace-nowrap hover:bg-teal-700 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Imprimir Lote ({selecionados.length})
              </Link>
            )}
            <Link href="/membros/novo" className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded shadow-sm text-sm flex items-center justify-center whitespace-nowrap hover:bg-blue-700 transition">
              + Novo Membro
            </Link>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6 w-full">
          
          <div className="flex-1 w-full flex items-center bg-gray-50 border border-gray-200 rounded-md focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-500 focus-within:bg-white transition overflow-hidden">
            <div className="w-12 flex items-center justify-center text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input 
              type="text" 
              placeholder="Buscar por nome ou CPF..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full py-2.5 pr-4 bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400"
            />
          </div>

          <select 
            value={cargoFiltro}
            onChange={(e) => setCargoFiltro(e.target.value)}
            className="w-full md:w-auto md:min-w-[180px] flex-shrink-0 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition text-sm text-gray-700 cursor-pointer"
          >
            <option value="">Todos os Cargos</option>
            {cargosUnicos.map((c, i) => (
              <option key={i} value={c}>{c}</option>
            ))}
          </select>

          <select 
            value={congregacaoFiltro}
            onChange={(e) => setCongregacaoFiltro(e.target.value)}
            className="w-full md:w-auto md:min-w-[180px] flex-shrink-0 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white transition text-sm text-gray-700 cursor-pointer"
          >
            <option value="">Todas Congregações</option>
            {congregacoesUnicas.map((c, i) => (
              <option key={i} value={c}>{c}</option>
            ))}
          </select>
          
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-y border-gray-200 text-gray-500 font-semibold uppercase text-xs tracking-wide select-none">
              <tr>
                <th className="py-3 px-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                    checked={selecionados.length === membrosProcessados.length && membrosProcessados.length > 0}
                    onChange={toggleTodos}
                  />
                </th>
                <th 
                  className="py-3 px-4 cursor-pointer hover:bg-gray-200 transition group"
                  onClick={() => handleSort('nome_completo')}
                >
                  <div className="flex items-center gap-1">
                    Membro {renderIconeOrdenacao('nome_completo')}
                  </div>
                </th>
                <th 
                  className="py-3 px-4 cursor-pointer hover:bg-gray-200 transition group"
                  onClick={() => handleSort('cargo')}
                >
                  <div className="flex items-center gap-1">
                    Cargo {renderIconeOrdenacao('cargo')}
                  </div>
                </th>
                <th 
                  className="py-3 px-4 hidden md:table-cell cursor-pointer hover:bg-gray-200 transition group"
                  onClick={() => handleSort('telefone')}
                >
                  <div className="flex items-center gap-1">
                    Telefone {renderIconeOrdenacao('telefone')}
                  </div>
                </th>
                <th 
                  className="py-3 px-4 text-center cursor-pointer hover:bg-gray-200 transition group"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Status {renderIconeOrdenacao('status')}
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {membrosProcessados.map((membro) => (
                <tr key={membro.id} className={`transition ${selecionados.includes(membro.id) ? 'bg-blue-50/50' : 'hover:bg-gray-50/50'}`}>
                  <td className="py-4 px-4 text-center">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                      checked={selecionados.includes(membro.id)}
                      onChange={() => toggleSelecao(membro.id)}
                    />
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 flex items-center justify-center bg-gray-100 border border-gray-200 rounded-full w-10 h-10 overflow-hidden">
                        {membro.foto_url ? (
                          <img src={membro.foto_url} alt={membro.nome_completo} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-gray-400 text-xs font-medium">SM</span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900">{membro.nome_completo}</span>
                        <span className="text-xs text-gray-500 md:hidden">{membro.congregacao || "Sem Congregação"}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-gray-700 font-medium">
                    {membro.cargo || "-"}
                    <div className="text-xs text-gray-500 hidden md:block font-normal">{membro.congregacao || ""}</div>
                  </td>
                  <td className="py-4 px-4 hidden md:table-cell text-gray-500">{membro.telefone || "-"}</td>
                  <td className="py-4 px-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-block ${membro.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {membro.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right font-medium">
                    <Link href={`/membros/${membro.id}`} className="text-blue-600 hover:text-blue-800 transition">Ver</Link>
                    <span className="text-gray-300 mx-3">|</span>
                    <Link href={`/membros/${membro.id}/editar`} className="text-orange-500 hover:text-orange-600 transition">Editar</Link>
                  </td>
                </tr>
              ))}
              {membrosProcessados.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-500">Nenhum membro encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}