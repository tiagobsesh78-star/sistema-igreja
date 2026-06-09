"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function Header() {
  const router = useRouter();
  const [montado, setMontado] = useState(false);
  const [usuario, setUsuario] = useState<any>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  
  // Estados do Modal
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMontado(true); // Garante que o componente carregou no cliente
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
        console.error("Erro ao carregar usuário.");
      }
    }
  }, []);

  // Fecha o menu clicando fora
  useEffect(() => {
    const handleClickFora = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuAberto(false);
      }
    };
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, []);

  const handleSair = () => {
    localStorage.removeItem("usuarioLogado");
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
    const { error } = await supabase.from("membros").update({ senha: novaSenha }).eq("id", usuario.id);
    setSalvandoSenha(false);

    if (error) {
      alert("Erro ao alterar senha: " + error.message);
    } else {
      alert("Senha alterada com sucesso!");
      setModalSenhaAberto(false);
      setNovaSenha("");
      setConfirmarSenha("");
      setMenuAberto(false);
    }
  };

  // Previne erros de hidratação no Next.js
  if (!montado) return <div className="w-10 h-10 rounded-full bg-gray-800 animate-pulse"></div>;

  // O SEGREDO AQUI: Se não achar o usuário, ele mostra isso em vez de sumir da tela.
  if (!usuario) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400 font-medium">Não logado</span>
        <div className="w-10 h-10 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
        </div>
      </div>
    );
  }

  const nomeParaExibir = usuario.nome ? usuario.nome.split(" ")[0] : "Usuário";
  const inicial = usuario.nome ? usuario.nome.charAt(0).toUpperCase() : "U";

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button 
          type="button"
          onClick={() => setMenuAberto(!menuAberto)}
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
          
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${menuAberto ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </button>

        {/* MENU FLUTUANTE BLINDADO COM Z-INDEX ALTO */}
        {menuAberto && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden text-gray-900 origin-top-right z-[9999]">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <p className="text-sm font-bold text-gray-900 truncate">{usuario.nome || "Usuário"}</p>
              <p className="text-xs text-gray-500 truncate mt-0.5">CPF: {usuario.cpf || "Não informado"}</p>
            </div>
            
            <div className="p-2">
              <button 
                type="button"
                onClick={() => {
                  setModalSenhaAberto(true);
                  setMenuAberto(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 font-medium hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                Alterar Senha
              </button>
            </div>

            <div className="p-2 border-t border-gray-100">
              <button 
                type="button"
                onClick={handleSair}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 font-medium hover:bg-red-50 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Sair do Sistema
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE SENHA BLINDADO COM Z-INDEX ABSURDO */}
      {modalSenhaAberto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 text-gray-900">
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
                  {salvandoSenha ? "Salvando..." : "Atualizar Senha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}