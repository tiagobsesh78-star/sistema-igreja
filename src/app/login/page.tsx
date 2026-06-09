"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  // Máscara simples de CPF enquanto o usuário digita
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valor = e.target.value.replace(/\D/g, "");
    if (valor.length > 11) valor = valor.slice(0, 11);
    
    if (valor.length > 9) valor = valor.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
    else if (valor.length > 6) valor = valor.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    else if (valor.length > 3) valor = valor.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    
    setCpf(valor);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      const { data, error } = await supabase
        .from("membros")
        .select("*")
        .eq("cpf", cpf)
        .eq("senha", senha.trim())
        .eq("acessa_sistema", true) // Trava de segurança: só entra se a flag estiver ativa
        .single();

      if (error || !data) {
        setErro("CPF, senha incorretos ou acesso negado.");
        setCarregando(false);
        return;
      }

      // Salva os dados da sessão
      localStorage.setItem("usuarioLogado", JSON.stringify({
        id: data.id,
        nome: data.nome_completo,
        cpf: data.cpf,
        nivel_acesso: data.nivel_acesso || "Membro"
      }));

      router.push("/membros");
    } catch (err) {
      setErro("Erro de conexão com o banco de dados.");
      setCarregando(false);
    }
  };

  return (
    <div className="fixed inset-0 min-h-screen w-screen flex items-center justify-center bg-gray-50 px-4 z-50">
      <div className="w-full max-w-sm bg-white p-6 md:p-8 rounded-xl shadow-xl border border-gray-100">
        
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm border border-blue-50">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Evolui Sistema</h1>
          <p className="text-xs text-gray-400 mt-1">Insira suas credenciais para entrar</p>
        </div>

        {erro && (
          <div className="mb-4 p-2.5 bg-red-50 border border-red-200 text-red-600 text-xs rounded-md text-center font-semibold animate-pulse">
            {erro}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">CPF</label>
            <input 
              type="text" 
              required
              value={cpf}
              onChange={handleCpfChange}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition text-sm text-gray-900 placeholder-gray-400"
              placeholder="000.000.000-00"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Senha</label>
            <input 
              type="password" 
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition text-sm text-gray-900 placeholder-gray-400"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={carregando}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-all text-sm flex justify-center items-center"
          >
            {carregando ? (
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : "Acessar Painel"}
          </button>
        </form>

      </div>
    </div>
  );
}