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
  const [filtroCongregacao, setFiltroCongregacao] = useState("");

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

  useEffect(() => {
    carregarContexto();
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

    const { data: membs } = await supabase.from("membros").select("id, nome_completo, data_nascimento, genero, estado_civil, congregacao").eq("igreja_id", idIgreja).order("nome_completo");
    if (membs) setMembros(membs);

    const { data: vincs } = await supabase.from("departamento_membros").select("*, membros(id, nome_completo, data_nascimento, genero, estado_civil, congregacao)").eq("igreja_id", idIgreja);
    if (vincs) setVinculos(vincs as any);
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

  // Avalia se o membro bate 100% com os filtros do Departamento
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
    return membros.filter(m => pertenceAoFiltroAtual(m.congregacao, filtroCongregacao) && verificarCompatibilidade(m, dept)).map(m => m.id);
  };

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
    
    const jaEstao = vinculos.filter(v => v.departamento_id === dept.id).map(v => v.membro_id);
    let selecaoInicial = [...jaEstao];

    const temFiltro = dept.faixa_etaria_min || dept.faixa_etaria_max || dept.genero || dept.estado_civil;
    if (jaEstao.length === 0 && temFiltro) {
      selecaoInicial = obterMembrosComPerfil(dept);
    }

    setMembrosSelecionados(selecaoInicial);
    setBuscaMembro("");
    setModalMembrosAberto(true);
  };

  const salvarMembrosNoDepartamento = async () => {
    if (!deptSelecionado || !igrejaIdLogada) return;
    
    const atuais = vinculos.filter(v => v.departamento_id === deptSelecionado.id).map(v => v.membro_id);
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

  const atualizarFuncao = async (vinculoId: number, novaFuncao: string) => {
    setVinculos(vinculos.map(v => v.id === vinculoId ? { ...v, funcao: novaFuncao } : v));
    await supabase.from("departamento_membros").update({ funcao: novaFuncao }).eq("id", vinculoId);
  };

  const confirmarAcao = async () => {
    if (!vinculoAcao || !deptDestinoId || !igrejaIdLogada) return;

    if (tipoAcao === "Transferir") {
      await supabase.from("departamento_membros").update({ departamento_id: parseInt(deptDestinoId) }).eq("id", vinculoAcao.id);
    } else {
      await supabase.from("departamento_membros").insert([{
        departamento_id: parseInt(deptDestinoId),
        membro_id: vinculoAcao.membro_id,
        igreja_id: igrejaIdLogada,
        funcao: vinculoAcao.funcao
      }]);
    }
    setModalAcaoAberto(false);
    carregarDadosBasicos(igrejaIdLogada);
  };

  const departamentosFiltrados = departamentos.filter(d => pertenceAoFiltroAtual(d.congregacao, filtroCongregacao));
  const podeMudarFiltro = perfisUsuario.includes("Pastor/Presbítero") || perfisUsuario.includes("Secretário") || perfisUsuario.includes("Administrador");

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
              onChange={(e) => setFiltroCongregacao(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
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
            className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg font-medium shadow transition-colors"
          >
            + Cadastrar Departamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {departamentosFiltrados.map(dept => {
          const liderados = vinculos.filter(v => v.departamento_id === dept.id);
          
          return (
            <div key={dept.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="bg-teal-50 border-b border-teal-100 p-4 flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-teal-900">{dept.nome}</h3>
                  <div className="text-xs text-teal-700 mt-1 space-y-0.5">
                    {dept.faixa_etaria_min && dept.faixa_etaria_max && <p>Idade: {dept.faixa_etaria_min} a {dept.faixa_etaria_max} anos</p>}
                    {dept.faixa_etaria_min && !dept.faixa_etaria_max && <p>A partir de {dept.faixa_etaria_min} anos</p>}
                    {dept.genero && <p>Gênero: {dept.genero}</p>}
                    {dept.estado_civil && <p>Estado Civil: {dept.estado_civil}</p>}
                    {!dept.faixa_etaria_min && !dept.genero && !dept.estado_civil && <p>Sem restrições de filtro.</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setFormDept(dept); setModalDeptAberto(true); }} className="text-gray-400 hover:text-teal-600">✎</button>
                  <button onClick={() => excluirDepartamento(dept.id)} className="text-gray-400 hover:text-red-600">✕</button>
                </div>
              </div>

              <div className="p-4 flex-1">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-semibold text-gray-600">Liderados ({liderados.length})</span>
                  <button onClick={() => abrirModalMembros(dept)} className="text-sm text-teal-600 hover:text-teal-800 font-medium">
                    + Gerenciar Membros
                  </button>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                  {liderados.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Nenhum liderado neste departamento.</p>
                  ) : (
                    liderados.map(vinculo => {
                      const m = vinculo.membros;
                      const idade = calcularIdade(m.data_nascimento);
                      return (
                        <div key={vinculo.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">{m.nome_completo}</p>
                              <p className="text-xs text-gray-500">{idade} anos • Niver: {formatarDataAniversario(m.data_nascimento)}</p>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => { setVinculoAcao(vinculo); setTipoAcao("Copiar"); setDeptDestinoId(""); setModalAcaoAberto(true); }}
                                className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-gray-700" title="Copiar/Transferir"
                              >
                                ⇄
                              </button>
                              <button 
                                onClick={() => {
                                  if(confirm("Remover do departamento?")) {
                                    supabase.from("departamento_membros").delete().eq("id", vinculo.id).then(() => carregarDadosBasicos(igrejaIdLogada!));
                                  }
                                }}
                                className="text-xs bg-red-100 hover:bg-red-200 px-2 py-1 rounded text-red-600" title="Remover"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                          <input 
                            type="text" 
                            value={vinculo.funcao || ""} 
                            onChange={(e) => atualizarFuncao(vinculo.id, e.target.value)}
                            placeholder="Definir função (Ex: Líder, Auxiliar...)"
                            className="mt-2 w-full text-sm px-2 py-1 border border-gray-200 rounded focus:ring-1 focus:ring-teal-500 outline-none bg-white"
                          />
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {departamentosFiltrados.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            Nenhum departamento cadastrado nesta congregação.
          </div>
        )}
      </div>

      {/* MODAL CADASTRAR / EDITAR DEPARTAMENTO */}
      {modalDeptAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-teal-600 p-4 text-white flex justify-between items-center shrink-0">
              <h2 className="font-bold text-lg">{formDept.id ? "Editar Departamento" : "Novo Departamento"}</h2>
              <button type="button" onClick={() => setModalDeptAberto(false)} className="text-white hover:text-gray-200">✕</button>
            </div>
            <form onSubmit={salvarDepartamento} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Departamento *</label>
                <input type="text" required value={formDept.nome} onChange={e => setFormDept({...formDept, nome: e.target.value})} placeholder="Ex: Jovens, Casais, Infantil..." className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Idade Min. (Opcional)</label>
                  <input type="number" value={formDept.faixa_etaria_min} onChange={e => setFormDept({...formDept, faixa_etaria_min: e.target.value})} placeholder="Ex: 12" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Idade Máx. (Opcional)</label>
                  <input type="number" value={formDept.faixa_etaria_max} onChange={e => setFormDept({...formDept, faixa_etaria_max: e.target.value})} placeholder="Ex: 18" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gênero (Opcional)</label>
                <select value={formDept.genero} onChange={e => setFormDept({...formDept, genero: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none">
                  <option value="">Todos</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado Civil (Opcional)</label>
                <select value={formDept.estado_civil} onChange={e => setFormDept({...formDept, estado_civil: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none">
                  <option value="">Todos</option>
                  <option value="Solteiro(a)">Solteiro(a)</option>
                  <option value="Casado(a)">Casado(a)</option>
                  <option value="Divorciado(a)">Divorciado(a)</option>
                  <option value="Viúvo(a)">Viúvo(a)</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setModalDeptAberto(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200">Cancelar</button>
                <button type="submit" className="flex-1 bg-teal-600 text-white py-2 rounded-lg font-medium hover:bg-teal-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR MEMBROS AO DEPARTAMENTO */}
      {modalMembrosAberto && deptSelecionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            
            {/* CABEÇALHO DO MODAL - TRAVADO */}
            <div className="bg-teal-600 p-4 text-white flex justify-between items-center shrink-0">
              <h2 className="font-bold text-lg">Membros: {deptSelecionado.nome}</h2>
              <button type="button" onClick={() => setModalMembrosAberto(false)} className="text-white hover:text-gray-200">✕</button>
            </div>
            
            {/* ÁREA DE BUSCA - TRAVADA */}
            <div className="p-4 shrink-0 bg-gray-50 border-b border-gray-200">
              <input 
                type="text" 
                placeholder="Buscar membro por nome para adicionar uma exceção..." 
                value={buscaMembro}
                onChange={e => setBuscaMembro(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
              />
              
              <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-teal-100/60 p-3 rounded-lg border border-teal-200 gap-3">
                <span className="text-xs text-teal-800 font-medium">
                  {buscaMembro.trim() 
                    ? "Exibindo resultados da sua busca. Remova o texto para voltar à lista inteligente."
                    : "Exibindo apenas membros que se encaixam nas regras do departamento."}
                </span>
                
                {/* O Botão de Auto-Seleção continua disponível se precisar */}
                {!buscaMembro.trim() && (deptSelecionado.faixa_etaria_min || deptSelecionado.faixa_etaria_max || deptSelecionado.genero || deptSelecionado.estado_civil) && (
                  <button 
                    type="button"
                    onClick={() => {
                      const matches = obterMembrosComPerfil(deptSelecionado);
                      if (matches.length === 0) {
                        alert("Nenhum membro atende a TODOS os requisitos exigidos pelo departamento.");
                      } else {
                        setMembrosSelecionados(Array.from(new Set([...membrosSelecionados, ...matches])));
                      }
                    }}
                    className="text-xs bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg shadow font-medium transition-colors w-full sm:w-auto"
                  >
                    ✨ Auto-selecionar
                  </button>
                )}
              </div>
            </div>

            {/* LISTA DE MEMBROS - COM ROLAGEM ISOLADA */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2 bg-white">
              {membros
                .filter(m => pertenceAoFiltroAtual(m.congregacao, filtroCongregacao)) 
                .filter(m => {
                  const atende = verificarCompatibilidade(m, deptSelecionado);
                  const jaSelecionado = membrosSelecionados.includes(m.id);
                  const estaNaBusca = buscaMembro.trim().length > 0 && m.nome_completo.toLowerCase().includes(buscaMembro.toLowerCase());

                  // A MÁGICA DO FILTRO:
                  // Se o usuário digitou algo, mostra todo mundo que bater com o nome (ofuscar=falso)
                  if (buscaMembro.trim().length > 0) return estaNaBusca;
                  
                  // Se não buscou nada, mostra só quem BATE com as regras OU quem já faz parte (mesmo que não bata)
                  return atende || jaSelecionado;
                })
                .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo))
                .map(m => {
                  const taNoDepto = membrosSelecionados.includes(m.id);
                  const idade = calcularIdade(m.data_nascimento);
                  const atendeRegras = verificarCompatibilidade(m, deptSelecionado);
                  
                  return (
                    <label key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${taNoDepto ? 'bg-teal-50 border-teal-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                      <input 
                        type="checkbox" 
                        checked={taNoDepto}
                        onChange={(e) => {
                          if (e.target.checked) setMembrosSelecionados([...membrosSelecionados, m.id]);
                          else setMembrosSelecionados(membrosSelecionados.filter(id => id !== m.id));
                        }}
                        className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 flex items-center gap-2">
                          {m.nome_completo}
                          {!atendeRegras && taNoDepto && (
                            <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-normal">Exceção</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">{idade} anos • {m.genero || "N/I"} • {m.estado_civil || "N/I"}</p>
                      </div>
                    </label>
                  )
                })}
            </div>

            {/* RODAPÉ DO MODAL (BOTÃO SALVAR) - TRAVADO */}
            <div className="p-4 border-t border-gray-200 shrink-0 flex gap-3 bg-white">
              <button type="button" onClick={() => setModalMembrosAberto(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200">Cancelar</button>
              <button type="button" onClick={salvarMembrosNoDepartamento} className="flex-1 bg-teal-600 text-white py-3 rounded-lg font-medium hover:bg-teal-700 shadow-lg">
                Salvar Liderados ({membrosSelecionados.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COPIAR / TRANSFERIR */}
      {modalAcaoAberto && vinculoAcao && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="bg-gray-800 p-4 text-white flex justify-between items-center">
              <h2 className="font-bold text-lg">Mover Liderado</h2>
              <button onClick={() => setModalAcaoAberto(false)} className="text-white hover:text-gray-300">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">Ação para: <strong>{vinculoAcao.membros.nome_completo}</strong></p>
              
              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                <button onClick={() => setTipoAcao("Copiar")} className={`flex-1 py-1.5 text-sm font-medium rounded-md ${tipoAcao === "Copiar" ? "bg-white shadow text-gray-800" : "text-gray-500"}`}>Copiar</button>
                <button onClick={() => setTipoAcao("Transferir")} className={`flex-1 py-1.5 text-sm font-medium rounded-md ${tipoAcao === "Transferir" ? "bg-white shadow text-gray-800" : "text-gray-500"}`}>Transferir</button>
              </div>
              <p className="text-xs text-gray-500">
                {tipoAcao === "Copiar" ? "O membro ficará nos dois departamentos." : "O membro será removido do departamento atual."}
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Para qual departamento?</label>
                <select 
                  value={deptDestinoId} 
                  onChange={e => setDeptDestinoId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-gray-800 outline-none"
                >
                  <option value="">Selecione...</option>
                  {departamentosFiltrados.filter(d => d.id !== vinculoAcao.departamento_id).map(d => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button onClick={() => setModalAcaoAberto(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200">Cancelar</button>
                <button onClick={confirmarAcao} disabled={!deptDestinoId} className="flex-1 bg-gray-800 text-white py-2 rounded-lg font-medium hover:bg-gray-900 disabled:opacity-50">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}