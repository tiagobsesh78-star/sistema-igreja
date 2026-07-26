"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function OnboardingPage() {
  const router = useRouter();

  // Estados do formulário
  const [nomeIgreja, setNomeIgreja] = useState("");
  const [cnpj, setCnpj] = useState("");
  
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [perfilSelecionado, setPerfilSelecionado] = useState("Pastor/Presbítero");

  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(true);

  // Estados do Token de Convite
  const [tokenValido, setTokenValido] = useState(false);
  const [tokenId, setTokenId] = useState("");
  const [erroToken, setErroToken] = useState("");

  // Validação do Token no carregamento
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setErroToken("Link de convite inválido ou ausente. Você precisa de um convite para acessar esta página.");
      setCarregando(false);
      return;
    }

    async function validarToken() {
      try {
        const { data, error } = await supabase
          .from("onboarding_links")
          .select("*")
          .eq("id", token)
          .single();

        if (error || !data) {
          setErroToken("Convite inválido ou não encontrado.");
          return;
        }

        if (data.usado) {
          setErroToken("Este link de convite já foi utilizado.");
          return;
        }

        if (new Date(data.data_expiracao) < new Date()) {
          setErroToken("Este link de convite expirou.");
          return;
        }

        // Token válido!
        setNomeCompleto(data.nome);
        setCpf(data.cpf);
        setTokenId(data.id);
        setTokenValido(true);
      } catch (err) {
        setErroToken("Erro ao validar convite.");
      } finally {
        setCarregando(false);
      }
    }

    validarToken();
  }, []);

  // Máscara simples de CPF enquanto o usuário digita
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valor = e.target.value.replace(/\D/g, "");
    if (valor.length > 11) valor = valor.slice(0, 11);
    
    if (valor.length > 9) valor = valor.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
    else if (valor.length > 6) valor = valor.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    else if (valor.length > 3) valor = valor.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    
    setCpf(valor);
  };

  // Máscara simples de CNPJ enquanto o usuário digita
  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valor = e.target.value.replace(/\D/g, "");
    if (valor.length > 14) valor = valor.slice(0, 14);
    
    if (valor.length > 12) valor = valor.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, "$1.$2.$3/$4-$5");
    else if (valor.length > 8) valor = valor.replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, "$1.$2.$3/$4");
    else if (valor.length > 5) valor = valor.replace(/(\d{2})(\d{3})(\d{1,3})/, "$1.$2.$3");
    else if (valor.length > 2) valor = valor.replace(/(\d{2})(\d{1,3})/, "$1.$2");
    
    setCnpj(valor);
  };

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    if (senha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      setCarregando(false);
      return;
    }

    if (senha.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      setCarregando(false);
      return;
    }

    try {
      // 1. Inserir a Igreja
      const { data: igrejaData, error: igrejaError } = await supabase
        .from("igrejas")
        .insert([{ nome: nomeIgreja, cnpj: cnpj || null }])
        .select("id")
        .single();

      if (igrejaError || !igrejaData) {
        throw new Error("Erro ao criar a igreja. Verifique os dados e tente novamente.");
      }

      const igrejaId = igrejaData.id;

      // 2. Inserir a Configuração da Igreja
      const { error: configError } = await supabase
        .from("configuracao_igreja")
        .insert([{ 
          igreja_id: igrejaId, 
          nome_igreja: nomeIgreja,
          cnpj: cnpj || null
        }]);

      if (configError) {
        throw new Error("Erro ao salvar as configurações da igreja.");
      }

      // 3. Inserir o Membro Inicial
      const { error: membroError } = await supabase
        .from("membros")
        .insert([{
          igreja_id: igrejaId,
          nome_completo: nomeCompleto,
          cpf: cpf,
          senha: senha.trim(),
          acessa_sistema: true,
          perfis: [perfilSelecionado], // Apenas o perfil selecionado
          nivel_acesso: perfilSelecionado,
          cargo: perfilSelecionado,
          status: "Ativo",
          congregacao: "Sede"
        }]);

      if (membroError) {
        throw new Error("Erro ao criar o usuário inicial. Verifique se o CPF já está em uso.");
      }

      // 4. Queimar o token de convite
      if (tokenId) {
        await supabase.from("onboarding_links").update({ usado: true }).eq("id", tokenId);
      }

      // Sucesso
      setSucesso(true);
      
      // Redireciona para o login após 3 segundos
      setTimeout(() => {
        router.push("/login");
      }, 3000);

    } catch (err: any) {
      setErro(err.message || "Erro inesperado ao realizar o cadastro.");
    } finally {
      setCarregando(false);
    }
  };

  if (erroToken) {
    return (
      <div className="fixed inset-0 min-h-screen w-screen flex items-center justify-center bg-gray-50 px-4 z-50">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-red-100 text-center space-y-4 animate-fade-in-up">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-2">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Acesso Negado</h2>
          <p className="text-gray-600 font-medium">
            {erroToken}
          </p>
          <button onClick={() => router.push("/login")} className="mt-6 px-6 py-2.5 bg-gray-900 text-white font-bold rounded-lg shadow-sm hover:bg-black transition">
            Voltar para o Login
          </button>
        </div>
      </div>
    );
  }

  if (carregando && !tokenValido) {
    return <div className="fixed inset-0 flex items-center justify-center bg-gray-50 z-50 text-blue-600 font-bold animate-pulse">Validando convite...</div>;
  }

  if (sucesso) {
    return (
      <div className="fixed inset-0 min-h-screen w-screen flex items-center justify-center bg-gray-50 px-4 z-50">
        <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-xl border border-green-100 text-center space-y-4 animate-fade-in-up">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
            <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Cadastro Concluído!</h2>
          <p className="text-gray-600">
            A sua igreja foi registrada com sucesso. Você será redirecionado para a tela de login em instantes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 min-h-screen w-screen flex items-center justify-center bg-gray-50 px-4 py-8 z-50 overflow-y-auto">
      <div className="w-full max-w-lg bg-white p-6 md:p-8 rounded-xl shadow-xl border border-gray-100 my-auto">
        
        <div className="text-center mb-6">
          <img 
            src="/LOGOTIPO.png" 
            alt="Logo Doxo hub" 
            className="w-full max-w-[180px] h-auto object-contain mx-auto mb-3"
          />
          <h1 className="text-xl font-bold text-gray-900 mt-2">Bem-vindo ao Doxo Hub</h1>
          <p className="text-sm text-gray-500 mt-1">
            Preencha os dados abaixo para configurar o primeiro acesso da sua igreja.
          </p>
        </div>

        {erro && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-md text-center font-medium animate-pulse">
            {erro}
          </div>
        )}

        <form onSubmit={handleCadastro} className="space-y-6">
          
          {/* Seção da Igreja */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-2">
              Dados da Igreja
            </h3>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome da Igreja *</label>
              <input 
                type="text" 
                required
                value={nomeIgreja}
                onChange={(e) => setNomeIgreja(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition text-sm text-gray-900 placeholder-gray-400"
                placeholder="Ex: Igreja Batista Central"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">CNPJ (Opcional)</label>
              <input 
                type="text" 
                value={cnpj}
                onChange={handleCnpjChange}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition text-sm text-gray-900 placeholder-gray-400"
                placeholder="00.000.000/0001-00"
              />
            </div>
          </div>

          {/* Seção do Administrador */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-2">
              Seus Dados (Responsável)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Completo</label>
                <input 
                  type="text" 
                  readOnly
                  value={nomeCompleto}
                  className="w-full px-3.5 py-2.5 bg-gray-100 border border-gray-200 rounded-lg outline-none cursor-not-allowed text-sm text-gray-600 font-semibold shadow-inner"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">CPF</label>
                <input 
                  type="text" 
                  readOnly
                  value={cpf}
                  className="w-full px-3.5 py-2.5 bg-gray-100 border border-gray-200 rounded-lg outline-none cursor-not-allowed text-sm text-gray-600 font-semibold shadow-inner"
                />
                <p className="text-xs text-gray-400 mt-1">Este será o seu login de acesso.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Seu Perfil *</label>
                <select 
                  value={perfilSelecionado}
                  onChange={(e) => setPerfilSelecionado(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition text-sm text-gray-900"
                >
                  <option value="Pastor/Presbítero">Pastor/Presbítero</option>
                  <option value="Secretário">Secretário</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Nível de acesso no sistema.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Senha *</label>
                <input 
                  type="password" 
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition text-sm text-gray-900 placeholder-gray-400"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Confirmar Senha *</label>
                <input 
                  type="password" 
                  required
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition text-sm text-gray-900 placeholder-gray-400"
                  placeholder="Repita a senha"
                />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit" 
              disabled={carregando}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all text-sm flex justify-center items-center"
            >
              {carregando ? (
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : "Finalizar Cadastro"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
