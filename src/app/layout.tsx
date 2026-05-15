"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const pathname = usePathname();

  const fecharMenu = () => setMenuAberto(false);

  return (
    <html lang="pt-BR">
      <body className="bg-gray-100 text-gray-900 overflow-x-hidden">

        {/* MENU LATERAL - Adicionado print:hidden para sumir na impressão */}
        <aside 
          className={`fixed top-0 left-0 h-full w-64 bg-black text-white z-50 transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col print:hidden ${
            menuAberto ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-5 border-b border-gray-800 h-16">
            <span className="text-xl font-bold tracking-wide"><span className="text-blue-500">Igreja</span>Admin</span>
            <button onClick={fecharMenu} className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <nav className="p-4 space-y-3 mt-2 flex-1">
            <Link href="/" onClick={fecharMenu} className={`block px-4 py-3 rounded-lg font-medium transition-all ${pathname === '/' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>Dashboard</Link>
            <Link href="/membros" onClick={fecharMenu} className={`block px-4 py-3 rounded-lg font-medium transition-all ${pathname?.startsWith('/membros') ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>Membros</Link>
          </nav>
        </aside>

        {menuAberto && <div className="fixed inset-0 z-40 md:hidden print:hidden" onClick={fecharMenu}></div>}

        {/* Adicionado print:ml-0 para a página voltar a preencher a tela na impressão */}
        <div className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out ${menuAberto ? "md:ml-64" : "ml-0"} print:ml-0`}>
          
          {/* CABEÇALHO - Adicionado print:hidden */}
          <header className="bg-black text-white h-16 flex items-center px-4 md:px-8 justify-between shadow-md z-30 sticky top-0 print:hidden">
            <div className="flex items-center gap-4">
              <button onClick={() => setMenuAberto(!menuAberto)} className="text-white hover:text-blue-400 focus:outline-none transition-colors">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <span className="text-xl font-bold tracking-wide"><span className="text-blue-500">Igreja</span>Admin</span>
            </div>
          </header>

          {/* Adicionado print:p-0 para tirar margens grossas na folha A4 */}
          <main className="flex-1 p-4 md:p-8 overflow-auto print:p-0">
            {children}
          </main>

        </div>
      </body>
    </html>
  );
}