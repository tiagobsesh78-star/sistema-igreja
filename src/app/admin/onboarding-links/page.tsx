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
  const [limite, setLimite] = useState(100); // Limite de Membros
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [modalEmailAberto, setModalEmailAberto] = useState(false);
  const [dadosEmail, setDadosEmail] = useState<any>(null);
  const [htmlParaCopiar, setHtmlParaCopiar] = useState("");

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

  const gerarLink = async (e: React.FormEvent | React.MouseEvent, paraEmail: boolean = false) => {
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
          data_expiracao: dataExpiracao.toISOString(),
          limite_membros: limite
        }])
        .select()
        .single();

      if (error) throw error;

      const linkCompleto = `${window.location.origin}/onboarding?token=${data.id}`;
      
      if (paraEmail) {
        const maskedCpf = cpf.substring(0, 3) + ".***.***-" + cpf.substring(12, 14);
        const dataExpFormatada = dataExpiracao.toLocaleDateString() + " às " + dataExpiracao.toLocaleTimeString().slice(0,5);
        const urlBase = window.location.origin;
        
        const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
  <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
    <img src="${urlBase}/LOGOTIPO.png" alt="Doxohub" style="max-height: 50px;" />
  </div>
  <div style="padding: 30px; color: #334155;">
    <h2 style="color: #0f172a; margin-top: 0;">Olá, ${nome.trim()}!</h2>
    <p>Seja muito bem-vindo(a) ao <strong>Doxohub</strong>.</p>
    <p>Estamos felizes em ter você conosco! O seu ambiente exclusivo já está pré-configurado e pronto para uso.</p>
    
    <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px;"><strong>Titular da Conta:</strong> ${nome.trim()}</p>
      <p style="margin: 5px 0 0 0; font-size: 14px;"><strong>Documento (CPF):</strong> ${maskedCpf}</p>
      <p style="margin: 5px 0 0 0; font-size: 14px; color: #dc2626;"><strong>O link expira em:</strong> ${dataExpFormatada}</p>
    </div>
    
    <p>Para concluir o seu cadastro, definir sua senha master e acessar o sistema agora mesmo, clique no botão abaixo:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${linkCompleto}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Finalizar Meu Cadastro</a>
    </div>
    
    <p style="font-size: 12px; color: #64748b; margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
      Se o botão não funcionar, copie e cole o link abaixo no seu navegador:<br/>
      <a href="${linkCompleto}" style="color: #2563eb;">${linkCompleto}</a>
    </p>
  </div>
</div>
        `;
        
        setHtmlParaCopiar(html);
        setDadosEmail({ link: linkCompleto, cpfMascarado: maskedCpf, expiracao: dataExpFormatada });
        setModalEmailAberto(true);
      } else {
        setSucesso(linkCompleto);
        navigator.clipboard.writeText(linkCompleto);
      }
      
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

  const excluirLink = async (id: string) => {
    if (!confirm("Tem certeza que deseja apagar esse link de Onboarding definitivamente?")) return;
    
    try {
      const { error } = await supabase.from("onboarding_links").delete().eq("id", id);
      if (error) throw error;
      carregarLinks();
    } catch (err: any) {
      alert("Erro ao excluir link.");
      console.error(err);
    }
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
          
          <form className="space-y-4">
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

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Limite de Membros (Plano)</label>
              <select 
                value={limite} onChange={(e) => setLimite(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-amber-50"
              >
                <option value={100}>Até 100 Membros</option>
                <option value={300}>Até 300 Membros</option>
                <option value={1000}>Até 1.000 Membros</option>
              </select>
            </div>

            <div className="flex flex-col gap-3 mt-6">
              <button 
                type="button" disabled={gerando} onClick={(e) => gerarLink(e, true)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition shadow-md flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                {gerando ? "Gerando..." : "Gerar para E-mail (HTML)"}
              </button>
              <button 
                type="button" disabled={gerando} onClick={(e) => gerarLink(e, false)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg text-sm transition"
              >
                {gerando ? "..." : "Gerar Apenas Link (Simples)"}
              </button>
            </div>
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
                  <th className="px-4 py-3 text-center">Plano</th>
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
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 bg-amber-100 text-amber-800 font-bold text-xs rounded-lg">{link.limite_membros || 100}</span>
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
                        <td className="px-4 py-3 text-right flex justify-end gap-1">
                          <button 
                            onClick={() => copiarLinkAntigo(link.id)}
                            className="text-blue-600 hover:bg-blue-50 rounded p-1.5 transition-colors"
                            title="Copiar Link"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                          </button>
                          <button 
                            onClick={() => excluirLink(link.id)}
                            className="text-red-500 hover:bg-red-50 rounded p-1.5 transition-colors"
                            title="Excluir Definitivamente"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
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

      {/* MODAL PRÉVIA DO E-MAIL */}
      {modalEmailAberto && dadosEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 bg-gray-900 text-white flex justify-between items-center shrink-0">
              <h3 className="font-bold flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                E-mail Pronto para Envio
              </h3>
              <button onClick={() => setModalEmailAberto(false)} className="text-gray-400 hover:text-white transition">✕</button>
            </div>
            
            <div className="p-0 overflow-y-auto bg-gray-100 flex-1 custom-scrollbar">
              <div dangerouslySetInnerHTML={{ __html: htmlParaCopiar }} className="shadow-sm mx-auto" />
            </div>
            
            <div className="p-4 bg-white border-t border-gray-100 flex justify-end gap-3 shrink-0">
              <button onClick={() => setModalEmailAberto(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-lg transition">Cancelar</button>
              <button 
                onClick={() => {
                  const fallbackCopy = () => {
                    const tempDiv = document.createElement("div");
                    tempDiv.innerHTML = htmlParaCopiar;
                    tempDiv.style.position = "absolute";
                    tempDiv.style.left = "-9999px";
                    document.body.appendChild(tempDiv);
                    
                    const range = document.createRange();
                    range.selectNodeContents(tempDiv);
                    
                    const selection = window.getSelection();
                    if (selection) {
                      selection.removeAllRanges();
                      selection.addRange(range);
                      try {
                        document.execCommand("copy");
                        alert("E-mail copiado com sucesso! Cole (Ctrl+V) no seu Gmail, Outlook ou CRM.");
                        setModalEmailAberto(false);
                      } catch (err) {
                        alert("Erro ao copiar automaticamente. Selecione o texto e copie manualmente.");
                      }
                      selection.removeAllRanges();
                    }
                    document.body.removeChild(tempDiv);
                  };

                  try {
                    if (navigator.clipboard && window.ClipboardItem) {
                      const blobHtml = new Blob([htmlParaCopiar], { type: "text/html" });
                      const blobText = new Blob([dadosEmail.link], { type: "text/plain" });
                      const data = [new ClipboardItem({ "text/html": blobHtml, "text/plain": blobText })];
                      navigator.clipboard.write(data).then(() => {
                        alert("E-mail copiado com sucesso! Cole (Ctrl+V) no seu Gmail, Outlook ou CRM.");
                        setModalEmailAberto(false);
                      }).catch(() => fallbackCopy());
                    } else {
                      fallbackCopy();
                    }
                  } catch(e) {
                    fallbackCopy();
                  }
                }}
                className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md flex items-center gap-2 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                Copiar (Pronto para Colar)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
