"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { formatarPerfis } from "../../lib/permissoes";

// Tipagens
interface Membro {
  id: string; 
  nome_completo: string;
  data_nascimento: string;
  genero: string;
  estado_civil: string;
  congregacao: string;
  responsavel?: string;
  nome_conjuge: string;
}

interface Departamento {
  id: number;
  nome: string;
  faixa_etaria_min: number | null;
  faixa_etaria_max: number | null;
  genero: string;
  estado_civil: string;
  congregacao: string;
}

interface DepartamentoMembro {
  id: number;
  departamento_id: number;
  membro_id: string; 
  funcao: string;
  membros: Membro;
}

// PALETA DE CORES: Cabeçalhos com cores sólidas e vibrantes
const paletasDeCores = [
  { bg: 'bg-teal-600', border: 'border-teal-700', titulo: 'text-white', sub: 'text-teal-100', anel: 'ring-teal-500', textoForte: 'text-teal-700' },
  { bg: 'bg-blue-600', border: 'border-blue-700', titulo: 'text-white', sub: 'text-blue-100', anel: 'ring-blue-500', textoForte: 'text-blue-700' },
  { bg: 'bg-fuchsia-600', border: 'border-fuchsia-700', titulo: 'text-white', sub: 'text-fuchsia-100', anel: 'ring-fuchsia-500', textoForte: 'text-fuchsia-700' },
  { bg: 'bg-amber-500', border: 'border-amber-600', titulo: 'text-white', sub: 'text-amber-50', anel: 'ring-amber-500', textoForte: 'text-amber-700' },
  { bg: 'bg-rose-600', border: 'border-rose-700', titulo: 'text-white', sub: 'text-rose-100', anel: 'ring-rose-500', textoForte: 'text-rose-700' },
  { bg: 'bg-indigo-600', border: 'border-indigo-700', titulo: 'text-white', sub: 'text-indigo-100', anel: 'ring-indigo-500', textoForte: 'text-indigo-700' },
  { bg: 'bg-emerald-600', border: 'border-emerald-700', titulo: 'text-white', sub: 'text-emerald-100', anel: 'ring-emerald-500', textoForte: 'text-emerald-700' },
];

export default function DepartamentosPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [igrejaIdLogada, setIgrejaIdLogada] = useState<string | null>(null);
  const [nomeIgrejaSede, setNomeIgrejaSede] = useState<string>("Sede"); 
  const [perfisUsuario, setPerfisUsuario] = useState<string[]>([]);
  const [congregacaoUsuario, setCongregacaoUsuario] = useState("");
  
  // Dados
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [vinculos, setVinculos] = useState<DepartamentoMembro[]>([]);
  const [igrejasFilhas, setIgrejasFilhas] = useState<any[]>([]);
  
  // Filtros Globais
  const [filtroCongregacao, setFiltroCongregacao] = useState("");
  const [deptFiltros, setDeptFiltros] = useState<number[]>([]);

  // Modais e Formulários
  const [modalDeptAberto, setModalDeptAberto] = useState(false);
  const [formDept, setFormDept] = useState<any>({ id: null, nome: "", faixa_etaria_min: "", faixa_etaria_max: "", genero: "", estado_civil: "" });
  
  const [modalMembrosAberto, setModalMembrosAberto] = useState(false);
  const [deptSelecionado, setDeptSelecionado] = useState<Departamento | null>(null);
  const [membrosSelecionados, setMembrosSelecionados] = useState<string[]>([]);
  const [buscaMembro, setBuscaMembro] = useState("");

  const [modalAcaoAberto, setModalAcaoAberto] = useState(false);
  const [vinculoAcao, setVinculoAcao] = useState<DepartamentoMembro | null>(null);
  const [tipoAcao, setTipoAcao] = useState<"Copiar" | "Transferir">("Copiar");
  const [deptDestinoId, setDeptDestinoId] = useState("");

  // Estados para edição inteligente da Descrição
  const [editandoFuncaoId, setEditandoFuncaoId] = useState<number | null>(null);
  const [funcaoTexto, setFuncaoTexto] = useState("");

  useEffect(() => {
    carregarContexto();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregarContexto = async () => {
    const userLocal = localStorage.getItem("usuarioLogado");
    if (!userLocal) {
      router.push("/login");
      return;
    }
    const usuario = JSON.parse(userLocal);
    const perfis = formatarPerfis(usuario.perfis || usuario.nivel_acesso);
    setPerfisUsuario(perfis);

    const temAcesso = perfis.includes("Secretário") || perfis.includes("Pastor/Presbítero") || perfis.includes("Líder") || perfis.includes("Administrador");
    if (!temAcesso) {
      alert("Você não tem permissão para acessar os Departamentos.");
      router.push("/");
      return;
    }

    const idIgreja = usuario.igreja_id;
    setIgrejaIdLogada(idIgreja);

    let nomeSedeAtual = "Sede";
    const { data: configData } = await supabase.from("configuracao_igreja").select("nome_igreja").eq("igreja_id", idIgreja).maybeSingle();
    if (configData?.nome_igreja) {
      nomeSedeAtual = configData.nome_igreja;
    } else {
      const { data: igrejaData } = await supabase.from("igrejas").select("nome").eq("id", idIgreja).maybeSingle();
      if (igrejaData?.nome) {
        nomeSedeAtual = igrejaData.nome;
      }
    }
    setNomeIgrejaSede(nomeSedeAtual);

    const { data: membroData } = await supabase.from("membros").select("congregacao").eq("id", usuario.id).single();
    const congUser = membroData?.congregacao || "Sede";
    setCongregacaoUsuario(congUser);

    const cUserNormalizado = congUser.trim().toLowerCase();
    const isSedeUser = cUserNormalizado === "" || cUserNormalizado === "sede" || cUserNormalizado === "matriz" || cUserNormalizado === "geral" || cUserNormalizado === nomeSedeAtual.trim().toLowerCase();

    if (perfis.includes("Pastor/Presbítero") || perfis.includes("Secretário") || perfis.includes("Administrador")) {
      setFiltroCongregacao("Sede");
      buscarIgrejasFilhas(idIgreja);
    } else {
      setFiltroCongregacao(isSedeUser ? "Sede" : congUser);
    }

    await carregarDadosBasicos(idIgreja);
    setCarregando(false);
  };

  const buscarIgrejasFilhas = async (idIgreja: string) => {
    const { data } = await supabase.from("igrejas_filhas").select("*").eq("igreja_id", idIgreja).order("nome");
    if (data) setIgrejasFilhas(data);
  };

  const carregarDadosBasicos = async (idIgreja: string) => {
    const { data: depts } = await supabase.from("departamentos").select("*").eq("igreja_id", idIgreja).order("nome");
    if (depts) setDepartamentos(depts);

    const { data: membs } = await supabase.from("membros").select("id, nome_completo, data_nascimento, genero, estado_civil, congregacao, responsavel, nome_conjuge").eq("igreja_id", idIgreja).order("nome_completo");
    if (membs) setMembros(membs);

    const { data: vincs } = await supabase.from("departamento_membros").select("*, membros(id, nome_completo, data_nascimento, genero, estado_civil, congregacao, responsavel, nome_conjuge)").eq("igreja_id", idIgreja);
    if (vincs) setVinculos(vincs as any);
  };

  const isHoje = (dataNascimento: string | null) => {
    if (!dataNascimento) return false;
    const hoje = new Date();
    const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
    const diaAtual = String(hoje.getDate()).padStart(2, '0');
    const [, mes, dia] = dataNascimento.split("-");
    return mes === mesAtual && dia === diaAtual;
  };

  const pertenceAoFiltroAtual = (congDb: string | null | undefined, filtro: string) => {
    const c = (congDb || "").trim().toLowerCase();
    if (filtro === "Sede") {
      return c === "" || c === "sede" || c === "matriz" || c === "geral" || c === nomeIgrejaSede.trim().toLowerCase();
    }
    return c === filtro.trim().toLowerCase();
  };

  const calcularIdade = (dataNascimento: string | null) => {
    if (!dataNascimento) return 0;
    const hoje = new Date();
    const nasc = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const mes = hoje.getMonth() - nasc.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade;
  };

  const formatarDataAniversario = (data: string | null) => {
    if (!data) return "--/--";
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}`;
  };

  const verificarCompatibilidade = (m: Membro, dept: Departamento) => {
    let match = true;
    const idade = calcularIdade(m.data_nascimento);

    if (dept.genero && m.genero?.trim().toLowerCase() !== dept.genero.trim().toLowerCase()) match = false;
    if (dept.estado_civil && m.estado_civil?.trim().toLowerCase() !== dept.estado_civil.trim().toLowerCase()) match = false;
    if (dept.faixa_etaria_min && idade < Number(dept.faixa_etaria_min)) match = false;
    if (dept.faixa_etaria_max && idade > Number(dept.faixa_etaria_max)) match = false;

    return match;
  };

  const obterMembrosComPerfil = (dept: Departamento) => {
    return membros.filter(m => pertenceAoFiltroAtual(m.congregacao, filtroCongregacao) && verificarCompatibilidade(m, dept)).map(m => String(m.id));
  };

  const getPaleta = (id: number) => paletasDeCores[id % paletasDeCores.length];

  const salvarDepartamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igrejaIdLogada) return;

    const payload = {
      igreja_id: igrejaIdLogada,
      congregacao: filtroCongregacao, 
      nome: formDept.nome,
      faixa_etaria_min: formDept.faixa_etaria_min ? parseInt(formDept.faixa_etaria_min) : null,
      faixa_etaria_max: formDept.faixa_etaria_max ? parseInt(formDept.faixa_etaria_max) : null,
      genero: formDept.genero || null,
      estado_civil: formDept.estado_civil || null
    };

    if (formDept.id) {
      await supabase.from("departamentos").update(payload).eq("id", formDept.id);
    } else {
      await supabase.from("departamentos").insert([payload]);
    }
    
    setModalDeptAberto(false);
    carregarDadosBasicos(igrejaIdLogada);
  };

  const excluirDepartamento = async (id: number) => {
    if (!confirm("Tem certeza? Isso removerá o quadro e todos os vínculos (os membros não serão excluídos do sistema).")) return;
    await supabase.from("departamentos").delete().eq("id", id);
    carregarDadosBasicos(igrejaIdLogada!);
  };

  const abrirModalMembros = (dept: Departamento) => {
    setDeptSelecionado(dept);
    
    const jaEstao = vinculos.filter(v => v.departamento_id === dept.id).map(v => String(v.membro_id));
    let selecaoInicial = [...jaEstao];

    const temFiltro = dept.faixa_etaria_min || dept.faixa_etaria_max || dept.genero || dept.estado_civil;
    if (jaEstao.length === 0 && temFiltro) {
      selecaoInicial = obterMembrosComPerfil(dept);
    }

    setMembrosSelecionados(selecaoInicial);
    setBuscaMembro("");
    setModalMembrosAberto(true);
  };

  const toggleMembro = (membroId: string) => {
    const id = String(membroId);
    setMembrosSelecionados(prev => {
      if (prev.includes(id)) {
        return prev.filter(selecionado => selecionado !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const salvarMembrosNoDepartamento = async () => {
    if (!deptSelecionado || !igrejaIdLogada) return;
    
    const atuais = vinculos.filter(v => v.departamento_id === deptSelecionado.id).map(v => String(v.membro_id));
    const paraAdicionar = membrosSelecionados.filter(id => !atuais.includes(id));
    const paraRemover = atuais.filter(id => !membrosSelecionados.includes(id));

    if (paraRemover.length > 0) {
      await supabase.from("departamento_membros").delete().eq("departamento_id", deptSelecionado.id).in("membro_id", paraRemover);
    }
    
    if (paraAdicionar.length > 0) {
      const inserts = paraAdicionar.map(membroId => ({
        departamento_id: deptSelecionado.id,
        membro_id: membroId,
        igreja_id: igrejaIdLogada,
        funcao: ""
      }));
      await supabase.from("departamento_membros").insert(inserts);
    }

    setModalMembrosAberto(false);
    carregarDadosBasicos(igrejaIdLogada);
  };

  const salvarFuncaoAtiva = async (vinculoId: number) => {
    setVinculos(vinculos.map(v => v.id === vinculoId ? { ...v, funcao: funcaoTexto } : v));
    await supabase.from("departamento_membros").update({ funcao: funcaoTexto }).eq("id", vinculoId);
    setEditandoFuncaoId(null);
  };

  const confirmarAcao = async () => {
    if (!vinculoAcao || !deptDestinoId || !igrejaIdLogada) return;

    if (tipoAcao === "Transferir") {
      await supabase.from("departamento_membros").update({ departamento_id: parseInt(deptDestinoId) }).eq("id", vinculoAcao.id);
    } else {
      await supabase.from("departamento_membros").insert([{
        departamento_id: parseInt(deptDestinoId),
        membro_id: String(vinculoAcao.membro_id),
        igreja_id: igrejaIdLogada,
        funcao: vinculoAcao.funcao
      }]);
    }
    setModalAcaoAberto(false);
    carregarDadosBasicos(igrejaIdLogada);
  };

  const toggleDeptFiltro = (id: number) => {
    if (deptFiltros.includes(id)) {
      setDeptFiltros(deptFiltros.filter(fid => fid !== id));
    } else {
      setDeptFiltros([...deptFiltros, id]);
    }
  };

  // Preparação de Visualização
  const departamentosDaCongregacao = departamentos.filter(d => pertenceAoFiltroAtual(d.congregacao, filtroCongregacao));
  const departamentosVisiveis = departamentosDaCongregacao.filter(d => deptFiltros.length === 0 || deptFiltros.includes(d.id));
  const podeMudarFiltro = perfisUsuario.includes("Pastor/Presbítero") || perfisUsuario.includes("Secretário") || perfisUsuario.includes("Administrador");

  let gridClasses = "grid gap-6 w-full ";
  if (departamentosVisiveis.length === 1) {
    gridClasses += "grid-cols-1 md:max-w-4xl md:mx-auto";
  } else if (departamentosVisiveis.length === 2) {
    gridClasses += "grid-cols-1 md:grid-cols-2 md:max-w-5xl md:mx-auto";
  } else {
    gridClasses += "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
  }

  if (carregando) return <div className="p-8 text-center text-gray-500">Carregando departamentos...</div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Departamentos</h1>
          <p className="text-gray-500">Gerencie grupos, ministérios e liderados.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          {podeMudarFiltro ? (
            <select
              value={filtroCongregacao}
              onChange={(e) => {
                setFiltroCongregacao(e.target.value);
                setDeptFiltros([]); 
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800 outline-none bg-white font-medium"
            >
              <option value="Sede">Sede (Matriz)</option>
              {igrejasFilhas.map(filha => (
                <option key={filha.id} value={filha.nome}>{filha.nome}</option>
              ))}
            </select>
          ) : (
            <div className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 font-medium">
              {congregacaoUsuario || "Sede"}
            </div>
          )}

          <button 
            onClick={() => {
              setFormDept({ id: null, nome: "", faixa_etaria_min: "", faixa_etaria_max: "", genero: "", estado_civil: "" });
              setModalDeptAberto(true);
            }}
            className="bg-gray-900 hover:bg-black text-white px-5 py-2 rounded-lg font-medium shadow-md transition-colors"
          >
            + Cadastrar Departamento
          </button>
        </div>
      </div>

      {departamentosDaCongregacao.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
          <button 
            onClick={() => setDeptFiltros([])}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all shadow-sm ${deptFiltros.length === 0 ? 'bg-gray-800 text-white ring-2 ring-offset-1 ring-gray-800' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'}`}
          >
            Ver Todos
          </button>
          
          {departamentosDaCongregacao.map(d => {
            const paleta = getPaleta(d.id);
            const isSelecionado = deptFiltros.includes(d.id);
            return (
              <button
                key={d.id}
                onClick={() => toggleDeptFiltro(d.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all border shadow-sm flex items-center gap-1.5
                  ${isSelecionado 
                    ? `${paleta.bg} ${paleta.border} ${paleta.titulo} ring-2 ring-offset-1 ${paleta.anel}` 
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400'
                  }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${isSelecionado ? 'bg-white' : paleta.bg.replace('bg-', 'bg-')}`}></span>
                {d.nome}
              </button>
            );
          })}
        </div>
      )}

      <div className={gridClasses}>
        {departamentosVisiveis.map(dept => {
          const liderados = vinculos.filter(v => v.departamento_id === dept.id);
          const paleta = getPaleta(dept.id);
          
          return (
            <div key={dept.id} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden flex flex-col transition-all hover:shadow-lg">
              
              <div className={`${paleta.bg} border-b ${paleta.border} p-5 flex justify-between items-start`}>
                <div>
                  <h3 className={`text-xl font-black ${paleta.titulo}`}>{dept.nome}</h3>
                  <div className={`text-xs ${paleta.sub} mt-1.5 space-y-0.5 font-medium`}>
                    {dept.faixa_etaria_min && dept.faixa_etaria_max && <p>Idade: {dept.faixa_etaria_min} a {dept.faixa_etaria_max} anos</p>}
                    {dept.faixa_etaria_min && !dept.faixa_etaria_max && <p>A partir de {dept.faixa_etaria_min} anos</p>}
                    {dept.genero && <p>Gênero: {dept.genero}</p>}
                    {dept.estado_civil && <p>Estado Civil: {dept.estado_civil}</p>}
                    {!dept.faixa_etaria_min && !dept.genero && !dept.estado_civil && <p>Aberto para todos.</p>}
                  </div>
                </div>
                
                <div className="flex gap-1.5 bg-black/10 p-1 rounded-lg backdrop-blur-sm shadow-inner border border-black/10">
                  <button onClick={() => { setFormDept({ ...dept, faixa_etaria_min: dept.faixa_etaria_min ?? "", faixa_etaria_max: dept.faixa_etaria_max ?? "", genero: dept.genero ?? "", estado_civil: dept.estado_civil ?? "" }); setModalDeptAberto(true); }} className="text-white/80 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/20 transition-all" title="Editar Filtros">✎</button>
                  <button onClick={() => excluirDepartamento(dept.id)} className="text-white/80 hover:text-red-200 px-1.5 py-0.5 rounded hover:bg-white/20 transition-all" title="Excluir">✕</button>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col bg-gray-50/30">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                    👥 Liderados: {liderados.length}
                  </span>
                  <button onClick={() => abrirModalMembros(dept)} className={`text-sm font-bold ${paleta.textoForte} hover:underline decoration-2 underline-offset-4`}>
                    + Gerenciar
                  </button>
                </div>

                <div className={`space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1 ${departamentosVisiveis.length === 1 ? 'max-h-[60vh] min-h-[300px]' : 'max-h-[320px]'}`}>
                  {liderados.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-8">
                      <p className="text-2xl mb-2">📥</p>
                      <p className="text-sm font-medium">Departamento vazio.</p>
                      <p className="text-xs mt-1">Clique em gerenciar para preencher.</p>
                    </div>
                  ) : (
                    liderados.map(vinculo => {
                      const m = vinculo.membros;
                      const idade = calcularIdade(m.data_nascimento);
                      const aniversarioHoje = isHoje(m.data_nascimento);
                      const editandoFuncao = editandoFuncaoId === vinculo.id;

                      return (
                        <div 
                          key={vinculo.id} 
                          className={`p-3 border rounded-xl transition-all shadow-sm
                            ${aniversarioHoje 
                              ? 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200 scale-[1.02] origin-left' 
                              : 'bg-white border-gray-200 hover:border-gray-300'
                            }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="min-w-0 flex-1">
                              <p className={`font-bold text-sm flex items-center flex-wrap gap-1.5 ${aniversarioHoje ? 'text-orange-900' : 'text-gray-800'}`}>
                                <span className="truncate">{m.nome_completo}</span>
                                {aniversarioHoje && <span title="Faz aniversário hoje!" className="text-lg animate-bounce drop-shadow-sm">🎉</span>}
                              </p>
                              <p className={`text-[11px] mt-0.5 ${aniversarioHoje ? 'text-orange-700 font-bold' : 'text-gray-500 font-medium'}`}>
                                {idade} anos • Niver: {formatarDataAniversario(m.data_nascimento)} {aniversarioHoje && <span className="bg-orange-200 text-orange-800 px-1.5 rounded ml-1 uppercase text-[10px]">Hoje!</span>}
                              </p>

                              {m.nome_conjuge && (
                                <p className="text-[10px] text-pink-600 font-bold mt-1 bg-pink-50 border border-pink-100 px-1.5 py-0.5 rounded w-max max-w-full truncate">
                                  💍 Cônjuge: {m.nome_conjuge}
                                </p>
                              )}
                              {m.responsavel && (
                                <p className="text-[10px] text-blue-600 font-bold mt-1 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded w-max max-w-full truncate">
                                  🛡️ Resp: {m.responsavel}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1.5 shrink-0 ml-2">
                              <button 
                                onClick={() => { setVinculoAcao(vinculo); setTipoAcao("Copiar"); setDeptDestinoId(""); setModalAcaoAberto(true); }}
                                className="text-xs bg-gray-100 hover:bg-gray-200 p-1.5 rounded text-gray-700 font-bold border border-gray-200 transition-colors" title="Copiar/Transferir para outro lugar"
                              >
                                ⇄
                              </button>
                              <button 
                                onClick={() => {
                                  if(confirm(`Tem certeza que deseja remover ${m.nome_completo} deste departamento?`)) {
                                    supabase.from("departamento_membros").delete().eq("id", vinculo.id).then(() => carregarDadosBasicos(igrejaIdLogada!));
                                  }
                                }}
                                className="text-xs bg-red-50 hover:bg-red-100 p-1.5 rounded text-red-600 font-bold border border-red-100 transition-colors" title="Remover"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                          
                          <div className="mt-2.5">
                            {editandoFuncao ? (
                              <div className="flex items-center gap-1.5 w-full max-w-[240px]">
                                <input 
                                  type="text" 
                                  value={funcaoTexto || ""} 
                                  onChange={(e) => setFuncaoTexto(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && salvarFuncaoAtiva(vinculo.id)}
                                  placeholder="Escreva uma descrição..."
                                  autoFocus
                                  className={`w-full text-xs px-2.5 py-1.5 border rounded-md focus:outline-none focus:ring-1 bg-white ${paleta.border} ${paleta.anel}`}
                                />
                                <button onClick={() => salvarFuncaoAtiva(vinculo.id)} className={`bg-gray-100 hover:bg-gray-200 ${paleta.textoForte} p-1.5 rounded-md transition-colors shrink-0`} title="Salvar (Enter)">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                </button>
                                <button onClick={() => setEditandoFuncaoId(null)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-1.5 rounded-md transition-colors shrink-0" title="Cancelar">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => { setEditandoFuncaoId(vinculo.id); setFuncaoTexto(vinculo.funcao || ""); }}
                                className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded transition-colors border max-w-full truncate
                                  ${vinculo.funcao ? 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200' : 'bg-transparent border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:bg-gray-50 hover:border-gray-400'}
                                `}
                              >
                                <span className="truncate max-w-[150px]">
                                  {vinculo.funcao || "+ Adicionar descrição"}
                                </span>
                                <svg className={`w-3 h-3 shrink-0 ${vinculo.funcao ? 'text-gray-400' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        {departamentosDaCongregacao.length > 0 && departamentosVisiveis.length === 0 && (
          <div className="col-span-full py-16 text-center text-gray-500 bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm">
            Nenhum departamento selecionado nos filtros acima.
          </div>
        )}

        {departamentosDaCongregacao.length === 0 && (
          <div className="col-span-full py-16 text-center text-gray-500 bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm">
            Nenhum departamento cadastrado nesta congregação ainda. <br/>Clique no botão preto acima para criar o primeiro!
          </div>
        )}
      </div>

      {/* MODAL CADASTRAR / EDITAR DEPARTAMENTO */}
      {modalDeptAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-gray-900 p-5 text-white flex justify-between items-center shrink-0">
              <h2 className="font-bold text-lg">{formDept.id ? "Editar as Regras do Departamento" : "Novo Departamento"}</h2>
              <button type="button" onClick={() => setModalDeptAberto(false)} className="text-gray-400 hover:text-white transition-colors">✕</button>
            </div>
            <form onSubmit={salvarDepartamento} className="p-6 space-y-5 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Nome do Departamento *</label>
                {/* Aqui está a blindagem do || "" contra o valor null no Edit */}
                <input type="text" required value={formDept.nome || ""} onChange={e => setFormDept({...formDept, nome: e.target.value})} placeholder="Ex: Grupo de Jovens, Casais..." className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-800 outline-none transition-shadow" />
              </div>
              
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Regras & Filtros Automáticos</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Idade Mínima</label>
                    <input type="number" value={formDept.faixa_etaria_min || ""} onChange={e => setFormDept({...formDept, faixa_etaria_min: e.target.value})} placeholder="Opcional" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-800 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Idade Máxima</label>
                    <input type="number" value={formDept.faixa_etaria_max || ""} onChange={e => setFormDept({...formDept, faixa_etaria_max: e.target.value})} placeholder="Opcional" className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-800 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Filtro de Gênero</label>
                  <select value={formDept.genero || ""} onChange={e => setFormDept({...formDept, genero: e.target.value})} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-800 outline-none bg-white">
                    <option value="">Aberto para todos</option>
                    <option value="Masculino">Apenas Masculino</option>
                    <option value="Feminino">Apenas Feminino</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Filtro de Estado Civil</label>
                  <select value={formDept.estado_civil || ""} onChange={e => setFormDept({...formDept, estado_civil: e.target.value})} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-800 outline-none bg-white">
                    <option value="">Aberto para todos</option>
                    <option value="Solteiro(a)">Apenas Solteiros(as)</option>
                    <option value="Casado(a)">Apenas Casados(as)</option>
                    <option value="Divorciado(a)">Apenas Divorciados(as)</option>
                    <option value="Viúvo(a)">Apenas Viúvos(as)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setModalDeptAberto(false)} className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition-colors shadow-lg">Salvar Regras</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR MEMBROS */}
      {modalMembrosAberto && deptSelecionado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            
            <div className={`${getPaleta(deptSelecionado.id).bg} ${getPaleta(deptSelecionado.id).border} border-b p-5 flex justify-between items-center shrink-0`}>
              <h2 className={`font-black text-xl ${getPaleta(deptSelecionado.id).titulo}`}>
                Gerenciar: {deptSelecionado.nome}
              </h2>
              <button type="button" onClick={() => setModalMembrosAberto(false)} className={`${getPaleta(deptSelecionado.id).sub} hover:text-white font-bold text-xl transition-colors`}>✕</button>
            </div>
            
            <div className="p-5 shrink-0 bg-gray-50 border-b border-gray-200">
              <input 
                type="text" 
                placeholder="Buscar alguém por nome (Exceções ou Inclusões Manuais)..." 
                value={buscaMembro}
                onChange={e => setBuscaMembro(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-400 outline-none shadow-sm"
              />
              
              <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm gap-3">
                <span className="text-xs text-gray-600 font-medium leading-relaxed">
                  {buscaMembro.trim() 
                    ? "🔍 Procurando livremente no banco de dados. Apague a busca para voltar à lista filtrada."
                    : "✨ Mostrando apenas pessoas que encaixam nas regras. Digite um nome para buscar exceções."}
                </span>
                
                {!buscaMembro.trim() && (deptSelecionado.faixa_etaria_min || deptSelecionado.faixa_etaria_max || deptSelecionado.genero || deptSelecionado.estado_civil) && (
                  <button 
                    type="button"
                    onClick={() => {
                      const matches = obterMembrosComPerfil(deptSelecionado);
                      if (matches.length === 0) {
                        alert("Nenhum membro atende a TODOS os requisitos exigidos por este departamento.");
                      } else {
                        setMembrosSelecionados(Array.from(new Set([...membrosSelecionados, ...matches])));
                      }
                    }}
                    className={`text-xs ${getPaleta(deptSelecionado.id).textoForte} bg-white border-2 ${getPaleta(deptSelecionado.id).border} hover:bg-gray-50 px-4 py-2.5 rounded-xl font-bold transition-all w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-2`}
                  >
                    Auto-selecionar Compatíveis
                  </button>
                )}
              </div>
            </div>

            <div className="p-2 overflow-y-auto flex-1 bg-white">
              <div className="p-3 space-y-2.5">
                {membros
                  .filter(m => pertenceAoFiltroAtual(m.congregacao, filtroCongregacao)) 
                  .filter(m => {
                    const atende = verificarCompatibilidade(m, deptSelecionado);
                    const jaSelecionado = membrosSelecionados.includes(String(m.id));
                    const estaNaBusca = buscaMembro.trim().length > 0 && m.nome_completo.toLowerCase().includes(buscaMembro.toLowerCase());

                    if (buscaMembro.trim().length > 0) return estaNaBusca;
                    return atende || jaSelecionado;
                  })
                  .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo))
                  .map(m => {
                    const taNoDepto = membrosSelecionados.includes(String(m.id));
                    const idade = calcularIdade(m.data_nascimento);
                    const atendeRegras = verificarCompatibilidade(m, deptSelecionado);
                    const paleta = getPaleta(deptSelecionado.id);
                    
                    return (
                      <div 
                        key={m.id} 
                        onClick={() => toggleMembro(m.id)}
                        className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer select-none transition-all ${taNoDepto ? `${paleta.bg.replace('bg-','bg-')}/10 border-${paleta.border.replace('border-','')} shadow-sm ring-1 ${paleta.anel}` : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}
                      >
                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${taNoDepto ? `bg-current ${paleta.textoForte} border-transparent` : 'border-gray-300 bg-white'}`}>
                          {taNoDepto && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        
                        <div className="flex-1">
                          <p className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                            {m.nome_completo}
                            {!atendeRegras && taNoDepto && (
                              <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-red-200">Exceção Pessoal</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 font-medium mt-0.5">{idade} anos • {m.genero || "N/I"} • {m.estado_civil || "N/I"}</p>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 shrink-0 flex gap-4 bg-gray-50">
              <button type="button" onClick={() => setModalMembrosAberto(false)} className="flex-1 bg-white border border-gray-300 text-gray-700 py-3.5 rounded-xl font-bold hover:bg-gray-100 transition-colors">Cancelar Edição</button>
              <button type="button" onClick={salvarMembrosNoDepartamento} className="flex-[2] bg-gray-900 text-white py-3.5 rounded-xl font-black hover:bg-black transition-all shadow-lg hover:shadow-xl">
                Confirmar {membrosSelecionados.length} Liderado(s)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COPIAR / TRANSFERIR */}
      {modalAcaoAberto && vinculoAcao && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="bg-gray-900 p-5 text-white flex justify-between items-center">
              <h2 className="font-bold text-lg">Mover Liderado</h2>
              <button onClick={() => setModalAcaoAberto(false)} className="text-gray-400 hover:text-white transition-colors">✕</button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Ação para:</p>
                <p className="text-lg font-black text-gray-800">{vinculoAcao.membros.nome_completo}</p>
              </div>
              
              <div className="flex gap-2 p-1.5 bg-gray-100 rounded-xl border border-gray-200">
                <button onClick={() => setTipoAcao("Copiar")} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tipoAcao === "Copiar" ? "bg-white shadow-sm text-gray-900 ring-1 ring-gray-200" : "text-gray-500 hover:text-gray-700"}`}>Copiar</button>
                <button onClick={() => setTipoAcao("Transferir")} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${tipoAcao === "Transferir" ? "bg-white shadow-sm text-gray-900 ring-1 ring-gray-200" : "text-gray-500 hover:text-gray-700"}`}>Transferir</button>
              </div>
              
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-800 font-medium leading-relaxed">
                  {tipoAcao === "Copiar" ? "📋 O membro ficará nos dois departamentos simultaneamente (ideal para quem tem múltiplas funções)." : "🚀 O membro será totalmente removido do departamento atual e jogado no novo."}
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Para qual departamento?</label>
                <select 
                  value={deptDestinoId} 
                  onChange={e => setDeptDestinoId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-800 outline-none font-medium bg-white"
                >
                  <option value="">Selecione um destino...</option>
                  {departamentosDaCongregacao.filter(d => d.id !== vinculoAcao.departamento_id).map(d => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button onClick={() => setModalAcaoAberto(false)} className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors">Cancelar</button>
                <button onClick={confirmarAcao} disabled={!deptDestinoId} className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black disabled:opacity-50 transition-colors shadow-lg">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}