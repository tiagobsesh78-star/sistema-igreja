"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation"; // Importação corrigida
import { supabase } from "../lib/supabase";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [nomeIgreja, setNomeIgreja] = useState("Carregando...");
  const router = useRouter(); // Declaração necessária para o botão Sair

  useEffect(() => {
    async function buscarNomeIgreja() {
      const userLocal = localStorage.getItem("usuarioLogado");
      if (!userLocal) {
        setNomeIgreja("Não Logado");
        return;
      }

      const usuario = JSON.parse(userLocal);
      const igrejaId = usuario.igreja_id;

      if (igrejaId) {
        // Busca o nome da igreja conectada ao usuário
        const { data, error } = await supabase
          .from("configuracao_igreja") // Busca na tabela correta
          .select("nome_igreja")
          .eq("igreja_id", igrejaId)
          .maybeSingle();

        if (data && !error) {
          setNomeIgreja(data.nome_igreja || "Igreja");
        } else {
          setNomeIgreja("Igreja");
        }
      }
    }

    buscarNomeIgreja();
  }, []);

  return (
    <>
      {/* CABEÇALHO MOBILE (Visível apenas no celular) */}
      <div className="md:hidden bg-black text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex flex-col">
          <span className="font-bold text-blue-500 text-xl leading-none mt-1">Igreja<span className="text-white">Admin</span></span>
          <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-bold truncate max-w-[200px]">
            {nomeIgreja}
          </span>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)} 
          className="text-white p-2 focus:outline-none"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* MENU LATERAL (Sidebar) */}
      <div className={`
        fixed inset-y-0 left-0 transform ${isOpen ? "translate-x-0" : "-translate-x-full"}
        md:relative md:translate-x-0 transition duration-300 ease-in-out
        w-64 bg-black text-white min-h-screen z-50 flex flex-col shadow-xl
      `}>
        
        {/* Logo do Desktop e Nome da Igreja */}
        <div className="p-6 hidden md:block border-b border-gray-800">
          <h2 className="text-2xl font-bold text-blue-500 leading-tight">Igreja<span className="text-white">Admin</span></h2>
          <p className="text-xs text-gray-400 mt-1.5 uppercase tracking-widest font-bold line-clamp-2">
            {nomeIgreja}
          </p>
        </div>

        {/* Links de Navegação */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          <Link 
            href="/" 
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 py-3 px-4 rounded-lg transition duration-200 hover:bg-gray-800 hover:text-white font-medium text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            Dashboard
          </Link>
          
          <Link 
            href="/membros" 
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 py-3 px-4 rounded-lg transition duration-200 hover:bg-gray-800 hover:text-white font-medium text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            Membros
          </Link>

          <Link 
            href="/tesouraria" 
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 py-3 px-4 rounded-lg transition duration-200 hover:bg-gray-800 hover:text-white font-medium text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Tesouraria
          </Link>

          <Link 
            href="/escalas" 
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 py-3 px-4 rounded-lg transition duration-200 hover:bg-gray-800 hover:text-white font-medium text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Escalas
          </Link>
          
          <Link 
            href="/configuracoes" 
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 py-3 px-4 rounded-lg transition duration-200 hover:bg-gray-800 hover:text-white font-medium text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path></svg>
            Configurações
          </Link>
        </nav>

        {/* Botão de Sair */}
        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={() => {
              localStorage.removeItem("usuarioLogado");
              router.push("/login");
            }}
            className="flex items-center gap-3 w-full py-3 px-4 rounded-lg transition duration-200 hover:bg-red-600 hover:text-white font-medium text-gray-400"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sair
          </button>
        </div>

      </div>

      {/* OVERLAY ESCURO */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </>
  );
}