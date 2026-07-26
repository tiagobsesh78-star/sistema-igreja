"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import Link from "next/link";

const CPF_ADMIN = "112.518.774-35";

export default function OnboardingLinksAdmin() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);

  // Formulário
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [prazo, setPrazo] = useState(24); // Horas
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [linksAntigos, setLinksAntigos] = useState<any[]>([]);

  // Máscara de CPF
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valor = e.target.value.replace(/\D/g, "");
    if (valor.length > 11) valor = valor.slice(0, 11);
    if (valor.length > 9) valor = valor.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
    else if (valor.length > 6) valor = valor.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    else if (valor.length > 3) valor = valor.replace(/(\d{3})(\d{1,3})/, "$1.$2");
    setCpf(valor);
  };

  useEffect(() => {
    const userLocal = localStorage.getItem("usuarioLogado");
    if (!userLocal) {
      router.push("/login");
      return;
    }

    try {
      const usuario = JSON.parse(userLocal);
      if (usuario.cpf === CPF_ADMIN) {
        setAutorizado(true);
        carregarLinks();
      } else {
        router.push("/"); // Não autorizado
      }
    } catch (e) {
      router.push("/login");
    } finally {
      setCarregando(false);
    }
  }, [router]);

  const carregarLinks = async () => {
    const { data, error } = await supabase
      .from("onboarding_links")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(50);
    
    if (data) {
      setLinksAntigos(data);
    }
  };

  const gerarLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setSucesso("");
    setGerando(true);

    if (cpf.length < 14) {
      setErro("CPF incompleto.");
      setGerando(false);
      return;
    }

    const dataExpiracao = new Date();
    dataExpiracao.setHours(dataExpiracao.getHours() + prazo);

    try {
      const { data, error } = await supabase
        .from("onboarding_links")
        .insert([{
          nome: nome.trim(),
          cpf: cpf,
          data_expiracao: dataExpiracao.toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      const linkCompleto = `${window.location.origin}/onboarding?token=${data.id}`;
      setSucesso(linkCompleto);
      navigator.clipboard.writeText(linkCompleto);
      
      setNome("");
      setCpf("");
      carregarLinks();

    } catch (err: any) {
      setErro("Erro ao gerar link. Tente novamente.");
      console.error(err);
    } finally {
      setGerando(false);
    }
  };

  const copiarLinkAntigo = (token: string) => {
    const linkCompleto = `${window.location.origin}/onboarding?token=${token}`;
    navigator.clipboard.writeText(linkCompleto);
    alert("Link copiado para a área de transferência!");
  };

  if (carregando) return <div className="flex h-screen items-center justify-center">Verificando autorização...</div>;
  if (!autorizado) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-10 mt-10">
      
      <div className="flex justify-between items-center bg-gray-900 text-white p-6 rounded-2xl shadow-md border border-gray-800">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            Área de Segurança (Dono)
          </h1>
          <p className="text-gray-400 text-sm mt-1">Gere links de convite de uso único para novos clientes.</p>
        </div>
        <Link href="/" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-semibold transition">Voltar ao Sistema</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Formulário de Geração */}
        <div className="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
          <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Novo Link</h2>
          
          {erro && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{erro}</div>}
          
          <form onSubmit={gerarLink} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Comprador</label>
              <input 
                type="text" required value={nome} onChange={(e) => setNome(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nome completo"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">CPF do Comprador</label>
              <input 
                type="text" required value={cpf} onChange={handleCpfChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Validade do Link</label>
              <select 
                value={prazo} onChange={(e) => setPrazo(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={24}>24 Horas</option>
                <option value={48}>48 Horas</option>
                <option value={168}>7 Dias</option>
              </select>
            </div>

            <button 
              type="submit" disabled={gerando}
              className="w-full py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded-lg text-sm transition shadow-md"
            >
              {gerando ? "Gerando..." : "Gerar e Copiar Link"}
            </button>
          </form>

          {sucesso && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-center animate-fade-in-up">
              <p className="text-xs text-green-700 font-bold uppercase mb-1">Link Gerado (Copiado!)</p>
              <code className="text-[10px] break-all text-gray-600 block bg-white p-2 border border-green-100 rounded">{sucesso}</code>
            </div>
          )}
        </div>

        {/* Histórico */}
        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
            <h2 className="text-lg font-bold text-gray-800">Convites Gerados</h2>
            <button onClick={carregarLinks} className="text-sm text-blue-600 hover:underline">Atualizar</button>
          </div>
          
          <div className="overflow-x-auto flex-1 p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Expira em</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {linksAntigos.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-gray-400">Nenhum convite gerado.</td></tr>
                ) : (
                  linksAntigos.map(link => {
                    const expirado = new Date(link.data_expiracao) < new Date();
                    return (
                      <tr key={link.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-bold text-gray-800">{link.nome}</p>
                          <p className="text-xs text-gray-500">{link.cpf}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {new Date(link.data_expiracao).toLocaleDateString()} {new Date(link.data_expiracao).toLocaleTimeString().slice(0,5)}
                        </td>
                        <td className="px-4 py-3">
                          {link.usado ? (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">Usado</span>
                          ) : expirado ? (
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">Expirado</span>
                          ) : (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">Pendente</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => copiarLinkAntigo(link.id)}
                            className="text-blue-600 hover:text-blue-800 font-semibold p-1"
                            title="Copiar Link"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
