"use client";

import { useState } from "react";
import Link from "next/link";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* CABEÇALHO MOBILE (Visível apenas no celular) */}
      <div className="md:hidden bg-black text-white p-4 flex justify-between items-center shadow-md">
        <span className="font-bold text-blue-500 text-xl">Igreja<span className="text-white">Admin</span></span>
        <button 
          onClick={() => setIsOpen(!isOpen)} 
          className="text-white p-2 focus:outline-none"
        >
          {/* Ícone SVG oficial de Menu (Hamburger) */}
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
        {/* Logo do Desktop */}
        <div className="p-6 hidden md:block border-b border-gray-800">
          <h2 className="text-2xl font-bold text-blue-500">Igreja<span className="text-white">Admin</span></h2>
        </div>

        {/* Links de Navegação */}
        <nav className="flex-1 px-4 py-6 space-y-3">
          <Link 
            href="/" 
            onClick={() => setIsOpen(false)}
            className="block py-2.5 px-4 rounded transition duration-200 hover:bg-blue-600 hover:text-white font-medium"
          >
            Dashboard
          </Link>
          <Link 
            href="/membros" 
            onClick={() => setIsOpen(false)}
            className="block py-2.5 px-4 rounded transition duration-200 hover:bg-blue-600 hover:text-white font-medium"
          >
            Membros
          </Link>
        </nav>
      </div>

      {/* OVERLAY ESCURO (Fundo embaçado no celular quando o menu abre) */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </>
  );
}