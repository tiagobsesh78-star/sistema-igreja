"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  // Estados do Menu Lateral
  const [menuAberto, setMenuAberto] = useState(false);
  
  // Estados do Utilizador Logado (Header)
  const [usuario, setUsuario] = useState<any>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [userMenuAberto, setUserMenuAberto] = useState(false);
  
  // Estados do Modal de Alteração de Senha
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const ehPaginaLogin = pathname === "/login";
  const fecharMenu = () => setMenuAberto(false);

  // Carrega os dados do utilizador e a foto do Supabase
  useEffect(() => {
    if (ehPaginaLogin) return;

    const userLocal = localStorage.getItem("usuarioLogado");
    if (userLocal) {
      try {
        const parsedUser = JSON.parse(userLocal);
        setUsuario(parsedUser);

        async function buscarFoto() {
          const { data } = await supabase
            .from("membros")
            .select("foto_url")
            .eq("id", parsedUser.id)
            .single();
          if (data && data.foto_url) {
            setFotoUrl(data.foto_url);
          }
        }
        buscarFoto();
      } catch (e) {
        console.error("Erro ao carregar sessão do utilizador.");
      }
    }
  }, [pathname, ehPaginaLogin]);

  // Fecha o menu flutuante se clicar fora dele
  useEffect(() => {
    const handleClickFora = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".user-menu-container")) {
        setUserMenuAberto(false);
      }
    };
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, []);

  const handleSair = () => {
    localStorage.removeItem("usuarioLogado");
    setUsuario(null);
    setUserMenuAberto(false);
    router.push("/login");
  };

  const handleAlterarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novaSenha !== confirmarSenha) {
      alert("As senhas não coincidem!");
      return;
    }
    if (novaSenha.length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setSalvandoSenha(true);
    const { error } = await supabase
      .from("membros")
      .update({ senha: novaSenha })
      .eq("id", usuario.id);

    setSalvandoSenha(false);

    if (error) {
      alert("Erro ao atualizar senha: " + error.message);
    } else {
      alert("Senha alterada com sucesso!");
      setModalSenhaAberto(false);
      setNovaSenha("");
      setConfirmarSenha("");
      setUserMenuAberto(false);
    }
  };

  const nomeParaExibir = usuario?.nome ? usuario.nome.split(" ")[0] : "Utilizador";
  const inicial = usuario?.nome ? usuario.nome.charAt(0).toUpperCase() : "U";

  return (
    <html lang="pt-BR">
      <body className="bg-gray-100 text-gray-900 overflow-x-hidden">

        {ehPaginaLogin ? (
          children
        ) : (
          <>
            {/* MENU LATERAL */}
            <aside 
              className={`fixed top-0 left-0 h-full w-64 bg-black text-white z-50 transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col print:hidden ${
                menuAberto ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-800 h-16">
                <Link href="/" onClick={fecharMenu} className="text-xl font-bold tracking-wide hover:opacity-80 transition-opacity">
                  <span className="text-blue-500">Igreja</span>Admin
                </Link>
                <button onClick={fecharMenu} className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <nav className="p-4 space-y-3 mt-2 flex-1">
                <Link href="/" onClick={fecharMenu} className={`block px-4 py-3 rounded-lg font-medium transition-all ${pathname === '/' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>Início</Link>
                <Link href="/membros" onClick={fecharMenu} className={`block px-4 py-3 rounded-lg font-medium transition-all ${pathname?.startsWith('/membros') ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>Membros</Link>
                <Link href="/configuracoes" onClick={fecharMenu} className={`block px-4 py-3 rounded-lg font-medium transition-all ${pathname === '/configuracoes' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>Configurações</Link>
              </nav>
            </aside>

            {menuAberto && <div className="fixed inset-0 z-40 md:hidden print:hidden" onClick={fecharMenu}></div>}

            {/* ÁREA DO CONTEÚDO PRINCIPAL */}
            <div className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out ${menuAberto ? "md:ml-64" : "ml-0"} print:ml-0`}>
              
              {/* SEU CABEÇALHO PRETO ORIGINAL COM PERFIL INTEGRADO */}
              <header className="bg-black text-white h-16 flex items-center px-4 md:px-8 justify-between shadow-md z-30 sticky top-0 print:hidden">
                <div className="flex items-center gap-4">
                  <button onClick={() => setMenuAberto(!menuAberto)} className="text-white hover:text-blue-400 focus:outline-none transition-colors">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                  </button>
                  
                  <Link href="/" className="text-xl font-bold tracking-wide hover:opacity-80 transition-opacity">
                    <span className="text-blue-500">Igreja</span>Admin
                  </Link>
                </div>

                {/* BLOCO DO MENU DO UTILIZADOR (CANTO DIREITO) */}
                <div className="relative user-menu-container">
                  {usuario ? (
                    <>
                      <button 
                        type="button"
                        onClick={() => setUserMenuAberto(!userMenuAberto)}
                        className="flex items-center gap-3 p-1 pr-2 rounded-full hover:bg-gray-800 transition-colors focus:outline-none"
                      >
                        <div className="text-right hidden md:block">
                          <p className="text-sm font-semibold text-white leading-tight">{nomeParaExibir}</p>
                          <p className="text-xs text-blue-400 font-medium">{usuario.nivel_acesso || "Membro"}</p>
                        </div>
                        
                        {fotoUrl ? (
                          <img src={fotoUrl} alt="Perfil" className="w-10 h-10 rounded-full object-cover border-2 border-gray-700 shadow-sm" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 text-white flex items-center justify-center font-bold shadow-sm border-2 border-gray-700">
                            {inicial}
                          </div>
                        )}
                        
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${userMenuAberto ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      </button>

                      {/* Dropdown Menu */}
                      {userMenuAberto && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden text-gray-900 origin-top-right z-50">
                          <div className="p-4 border-b border-gray-100 bg-gray-50">
                            <p className="text-sm font-bold text-gray-900 truncate">{usuario.nome || "Utilizador"}</p>
                            <p className="text-xs text-gray-500 truncate mt-0.5">CPF: {usuario.cpf || "Não informado"}</p>
                          </div>
                          
                          <div className="p-2">
                            <button 
                              type="button"
                              onClick={() => {
                                setModalSenhaAberto(true);
                                setUserMenuAberto(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 font-medium hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors text-left"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                              Alterar Senha
                            </button>
                          </div>

                          <div className="p-2 border-t border-gray-100">
                            <button 
                              type="button"
                              onClick={handleSair}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 font-medium hover:bg-red-50 rounded-lg transition-colors text-left"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                              Sair do Sistema
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Fallback caso não encontre sessão ativa */
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400 font-medium">Sessão expirada</span>
                      <Link href="/login" className="w-10 h-10 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                      </Link>
                    </div>
                  )}
                </div>
              </header>

              <main className="flex-1 p-4 md:p-8 overflow-auto print:p-0">
                {children}
              </main>

            </div>
          </>
        )}

        {/* MODAL DE ALTERAÇÃO DE SENHA */}
        {modalSenhaAberto && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 text-gray-900">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-gray-900">Alterar Senha</h3>
                <button onClick={() => setModalSenhaAberto(false)} className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-1 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <form onSubmit={handleAlterarSenha} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nova Senha</label>
                  <input 
                    type="password" 
                    required
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="Mínimo de 6 caracteres"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Confirmar Nova Senha</label>
                  <input 
                    type="password" 
                    required
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="Repita a senha"
                  />
                </div>
                
                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={salvandoSenha}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition disabled:bg-blue-400"
                  >
                    {salvandoSenha ? "A guardar..." : "Atualizar Senha"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </body>
    </html>
  );
}