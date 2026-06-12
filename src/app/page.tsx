"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase"; 

export default function Dashboard() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  
  const [stats, setStats] = useState({
    total: 0,
    ativos: 0,
    inativos: 0, 
    homens: 0,
    mulheres: 0,
  });

  const [recentes, setRecentes] = useState<any[]>([]);

  useEffect(() => {
    // TRAVA DE SEGURANÇA: Verifica se o usuário está logado
    const userLocal = localStorage.getItem("usuarioLogado");
    if (!userLocal) {
      router.push("/login");
      return; // Para a execução aqui e redireciona
    }

    const usuario = JSON.parse(userLocal);
    const igrejaId = usuario.igreja_id;

    async function carregarDados() {
      // TRAVA MULTI-TENANT APLICADA: Busca apenas os membros desta igreja
      const { data, error } = await supabase
        .from("membros")
        .select("*")
        .eq("igreja_id", igrejaId)
        .order("id", { ascending: false });

      if (error) {
        console.error("Erro ao buscar dados:", error);
      } else if (data) {
        const total = data.length;
        const ativos = data.filter((m) => m.status === "Ativo").length;
        const inativos = data.filter((m) => m.status === "Inativo").length; 
        const homens = data.filter((m) => m.genero === "Masculino").length;
        const mulheres = data.filter((m) => m.genero === "Feminino").length;

        setStats({ total, ativos, inativos, homens, mulheres });
        setRecentes(data.slice(0, 5));
      }
      setCarregando(false);
    }
    
    carregarDados();
  }, [router]);

  if (carregando) return <div className="flex h-screen items-center justify-center"><div className="text-xl text-gray-500 font-medium">Carregando painel...</div></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Visão Geral</h1>
          <p className="text-gray-500 text-sm mt-1">Bem-vindo ao painel administrativo da Igreja.</p>
        </div>
        <div className="mt-4 md:mt-0 flex flex-wrap gap-3">
          <Link href="/escalas" className="px-5 py-2.5 bg-teal-600 text-white font-medium text-sm rounded-lg hover:bg-teal-700 transition shadow-sm">Ver Escalas</Link>
          <Link href="/membros/novo" className="px-5 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition shadow-sm">+ Novo Membro</Link>
          <Link href="/membros" className="px-5 py-2.5 bg-gray-100 text-gray-700 font-medium text-sm rounded-lg hover:bg-gray-200 transition">Ver Todos</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
        
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-center gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Total</p>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 ml-1">{stats.total}</h3>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-center gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Ativos</p>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 ml-1">{stats.ativos}</h3>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-center gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Inativos</p>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 ml-1">{stats.inativos}</h3>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-center gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Homens</p>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 ml-1">{stats.homens}</h3>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-center gap-2 col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Mulheres</p>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 ml-1">{stats.mulheres}</h3>
        </div>

      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">Últimos Cadastrados</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">Membro</th>
                <th className="p-4 font-semibold">Cargo</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentes.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-400">Nenhum membro encontrado.</td></tr>
              ) : (
                recentes.map((membro) => (
                  <tr key={membro.id} className="hover:bg-gray-50 transition">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {membro.foto_url ? (
                          <img src={membro.foto_url} alt="Foto" className="w-9 h-9 rounded-full object-cover border border-gray-200" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
                            <span className="text-[8px] font-bold text-gray-400 uppercase">Foto</span>
                          </div>
                        )}
                        <span className="font-medium text-gray-900">{membro.nome_completo}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-600">{membro.cargo}</td>
                    <td className="p-4">
                      
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${membro.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {membro.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Link href={`/membros/${membro.id}`} className="text-blue-600 hover:text-blue-800 text-sm font-semibold">Ver Perfil</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}