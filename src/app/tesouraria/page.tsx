"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../src/lib/supabase";
import { podeEditar, formatarPerfis } from "../../../src/lib/permissoes";

export default function TesourariaPage() {
  const router = useRouter();
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [perfisUsuario, setPerfisUsuario] = useState<string[]>([]); // Estado de Controle de Perfis

  // Configurações e Dados Estruturados
  const [configIgreja, setConfigIgreja] = useState<any>(null);
  const [congregacoes, setCongregacoes] = useState<string[]>([]);
  const [congregacaoSelecionada, setCongregacaoSelecionada] = useState("");
  const [configuracoesGlobais, setConfiguracoesGlobais] = useState<any[]>([]);
  const [totalDizimistasGeral, setTotalDizimistasGeral] = useState<any[]>([]);

  // Filtros
  const [mesesSelecionados, setMesesSelecionados] = useState<string[]>([]);
  const [anosSelecionados, setAnosSelecionados] = useState<string[]>([]);
  const [tiposSelecionados, setTiposSelecionados] = useState<string[]>([]);
  const [dropdownAberto, setDropdownAberto] = useState<string | null>(null);

  const opcoesMeses = [
    { valor: "01", rotulo: "Janeiro" }, { valor: "02", rotulo: "Fevereiro" },
    { valor: "03", rotulo: "Março" }, { valor: "04", rotulo: "Abril" },
    { valor: "05", rotulo: "Maio" }, { valor: "06", rotulo: "Junho" },
    { valor: "07", rotulo: "Julho" }, { valor: "08", rotulo: "Agosto" },
    { valor: "09", rotulo: "Setembro" }, { valor: "10", rotulo: "Outubro" },
    { valor: "11", rotulo: "Novembro" }, { valor: "12", rotulo: "Dezembro" }
  ];
  const opcoesTipos = ["Culto", "EBD", "Consagração", "Círculo de oração", "Outros"];
  const [opcoesAnos, setOpcoesAnos] = useState<string[]>([]);

  const obterCongregacaoMembro = (m: any) => {
    if (!m) return "Geral";
    return m.congregacao || m.Congregacao || "Geral";
  };

  useEffect(() => {
    async function carregarDados() {
      // 1. RECUPERA A IGREJA E OS PERFIS DO UTILIZADOR LOGADO
      const usuarioLocal = localStorage.getItem("usuarioLogado");
      if (!usuarioLocal) {
        router.push("/login");
        return;
      }
      const usuario = JSON.parse(usuarioLocal);
      const igrejaId = usuario.igreja_id;
      
      // Armazena os perfis para controle visual
      setPerfisUsuario(formatarPerfis(usuario.perfis || usuario.nivel_acesso));

      // 2. APLICA A TRAVA 'igreja_id' EM TODAS AS BUSCAS
      const { data: dadosIgreja } = await supabase.from("configuracao_igreja").select("*").eq("igreja_id", igrejaId).limit(1).maybeSingle();
      if (dadosIgreja) setConfigIgreja(dadosIgreja);

      const { data: dadosMembros } = await supabase.from("membros").select("*").eq("igreja_id", igrejaId);
      if (dadosMembros) {
        const listaFiltrada = Array.from(new Set(dadosMembros.map((m) => obterCongregacaoMembro(m).trim()).filter((c) => c !== ""))).sort() as string[];
        setCongregacoes(listaFiltrada);
      }

      const { data: configs } = await supabase.from("tesouraria_configuracoes").select("*").eq("igreja_id", igrejaId);
      if (configs) setConfiguracoesGlobais(configs);

      // CARREGA DIZIMISTAS ATIVOS PARA CRUZAMENTO (Da mesma igreja)
      const { data: dadosDizimistas } = await supabase.from("tesouraria_dizimistas").select("*").eq("igreja_id", igrejaId);
      if (dadosDizimistas && dadosMembros) {
        const unidos = dadosDizimistas.map(d => ({
          ...d,
          membros: dadosMembros.find(m => String(m.id) === String(d.membro_id)) || null
        }));
        setTotalDizimistasGeral(unidos);
      }

      const { data: dadosLancamentos, error } = await supabase.from("tesouraria_lancamentos").select("*").eq("igreja_id", igrejaId).order("data", { ascending: false });
      if (!error && dadosLancamentos) {
        setLancamentos(dadosLancamentos);
        const anosNoBanco = dadosLancamentos.map(l => l.data.split("-")[0]);
        const anosUnicos = Array.from(new Set([...anosNoBanco, String(new Date().getFullYear())])).sort();
        setOpcoesAnos(anosUnicos);
      }
      setCarregando(false);
    }
    carregarDados();
  }, [router]);

  const toggleFiltro = (lista: string[], setLista: any, valor: string) => {
    if (lista.includes(valor)) setLista(lista.filter((v) => v !== valor));
    else setLista([...lista, valor]);
  };

  const lancamentosFiltrados = lancamentos.filter((lanc) => {
    if (!lanc.data) return false;
    const [ano, mes] = lanc.data.split("-");
    const matchCongregacao = congregacaoSelecionada === "" || lanc.congregacao === congregacaoSelecionada;
    const matchMes = mesesSelecionados.length === 0 || mesesSelecionados.includes(mes);
    const matchAno = anosSelecionados.length === 0 || anosSelecionados.includes(ano);
    const matchTipo = tiposSelecionados.length === 0 || tiposSelecionados.includes(lanc.tipo_trabalho);
    return matchCongregacao && matchMes && matchAno && matchTipo;
  });

  // ========== CÁLCULOS TOTAIS DO FILTRO ATUAL ==========
  const totalOfertas = lancamentosFiltrados.reduce((acc, lanc) => acc + (Number(lanc.ofertas) || 0), 0);
  const totalDizimos = lancamentosFiltrados.reduce((acc, lanc) => acc + (Number(lanc.dizimos) || 0), 0);
  const totalEspecial = lancamentosFiltrados.reduce((acc, lanc) => acc + (Number(lanc.oferta_especial) || 0), 0);
  const totalSaidasManuais = lancamentosFiltrados.reduce((acc, lanc) => acc + (Number(lanc.saidas) || 0), 0);
  
  const totalEntradasBrutas = totalOfertas + totalDizimos + totalEspecial;

  const saidasFixasCalculadas = configuracoesGlobais
    .filter(c => c.categoria === "Saída")
    .map(c => ({ ...c, valorCalculado: totalEntradasBrutas * (c.percentual / 100) }));

  const totalRepassesFixos = saidasFixasCalculadas.reduce((acc, s) => acc + s.valorCalculado, 0);
  const saldoLiquidoParcial = totalEntradasBrutas - totalSaidasManuais - totalRepassesFixos;

  // CONTAGEM DE DIZIMISTAS ATIVOS BASEADO NO FILTRO DE CONGREGAÇÃO
  const contagemDizimistasFiltrados = totalDizimistasGeral.filter(d => {
    if (congregacaoSelecionada === "") return true;
    return obterCongregacaoMembro(d.membros) === congregacaoSelecionada;
  }).length;

  // FORMATADORES
  const formatarMoeda = (valor: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
  const formatarMoedaExcel = (valor: number) => (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatarData = (dataSql: string) => {
    if (!dataSql) return "-";
    const [ano, mes, dia] = dataSql.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  const nomeIgrejaPrincipal = configIgreja?.nome_igreja || "Igreja Principal";
  const nomeCongregacao = congregacaoSelecionada || "Geral (Todas)";

  const exportarPDF = () => window.print();

  const exportarExcel = () => {
    let csv = `Relatório Financeiro - ${nomeIgrejaPrincipal}\nCongregação: ${nomeCongregacao}\nDizimistas Ativos no Filtro: ${contagemDizimistasFiltrados}\nData de Geração: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    csv += "Data;Congregação;Trabalho;Ofertas;Dízimos;Oferta Especial;Saídas;Total\n";
    lancamentosFiltrados.forEach((lanc) => {
      csv += `${formatarData(lanc.data)};${lanc.congregacao || 'Não informada'};${lanc.tipo_trabalho};${formatarMoedaExcel(lanc.ofertas)};${formatarMoedaExcel(lanc.dizimos)};${formatarMoedaExcel(lanc.oferta_especial)};${formatarMoedaExcel(lanc.saidas)};${formatarMoedaExcel(lanc.total)}\n`;
    });
    
    csv += `\nRESUMO FINANCEIRO\n`;
    csv += `Dizimistas Ativos;;;;;;${contagemDizimistasFiltrados}\n`;
    csv += `Entradas Brutas;;;;;;${formatarMoedaExcel(totalEntradasBrutas)}\n`;
    csv += `Saídas Lançamentos;;;;;;${formatarMoedaExcel(totalSaidasManuais)}\n`;
    saidasFixasCalculadas.forEach(s => {
      csv += `Repasse - ${s.tipo} (${s.percentual}%);;;;;;${formatarMoedaExcel(s.valorCalculado)}\n`;
    });
    csv += `SALDO LÍQUIDO PARCIAL;;;;;;${formatarMoedaExcel(saldoLiquidoParcial)}\n`;

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Tesouraria_${nomeCongregacao.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Trava central de permissão para esse módulo
  const ehEditor = podeEditar(perfisUsuario, 'tesouraria');

  if (carregando) return <div className="p-8 text-center text-gray-600">Carregando tesouraria...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <style dangerouslySetInnerHTML={{__html: `
        .cabecalho-impressao { display: none !important; }
        @media print {
          .print-oculto { display: none !important; }
          .cabecalho-impressao { display: block !important; visibility: visible !important; }
          body { background-color: white !important; color: black !important; }
          table { width: 100% !important; border-collapse: collapse !important; margin-bottom: 20px !important; }
          th, td { border: 1px solid #000 !important; padding: 6px !important; font-size: 11px !important; text-align: right !important; }
          th:nth-child(1), th:nth-child(2), th:nth-child(3), td:nth-child(1), td:nth-child(2), td:nth-child(3) { text-align: left !important; }
          .resumo-print { page-break-inside: avoid; border: 1px solid #000; padding: 15px; margin-top: 20px; }
          @page { margin: 10mm; }
        }
      `}} />

      {/* CABEÇALHO IMPRESSÃO */}
      <div className="cabecalho-impressao text-center mb-8 border-b-2 border-black pb-4">
        {configIgreja?.logo_url && <img src={configIgreja.logo_url} alt="Logo" className="h-20 mx-auto mb-3 object-contain" />}
        <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900">{nomeIgrejaPrincipal}</h1>
        <h2 className="text-md font-bold text-gray-700 mt-0.5">Relatório Financeiro da Congregação: {nomeCongregacao}</h2>
        <div className="flex justify-between items-center text-xs text-gray-500 mt-4 px-2">
          <span>Data de Emissão: {new Date().toLocaleDateString('pt-BR')}</span>
          <span>Dizimistas Ativos: {contagemDizimistasFiltrados}</span>
          <span>Total de Lançamentos: {lancamentosFiltrados.length}</span>
        </div>
      </div>

      {dropdownAberto && <div className="fixed inset-0 z-10 print-oculto" onClick={() => setDropdownAberto(null)}></div>}

      {/* PAINEL SUPERIOR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100 print-oculto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tesouraria</h1>
          <p className="text-sm text-gray-500 mt-1">Gestão de entradas, saídas e relatórios financeiros.</p>
        </div>
        
        {/* ESCONDE AÇÕES ADMINISTRATIVAS SE NÃO FOR EDITOR DE TESOURARIA */}
        {ehEditor && (
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Link href="/tesouraria/configuracoes" className="flex-1 md:flex-none px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition text-sm text-center">Configurações Globais</Link>
            <Link href="/tesouraria/dizimistas" className="flex-1 md:flex-none px-4 py-2 bg-blue-50 text-blue-700 font-medium rounded-lg hover:bg-blue-100 transition text-sm text-center">Dizimistas</Link>
            <Link href="/tesouraria/novo" className="flex-1 md:flex-none px-4 py-2 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition shadow-sm text-sm text-center">+ Novo Lançamento</Link>
          </div>
        )}
      </div>

      {/* FILTROS */}
      <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col space-y-4 print-oculto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-gray-100 pb-4 gap-4">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Filtrar por Congregação</label>
            <select
              value={congregacaoSelecionada} onChange={(e) => setCongregacaoSelecionada(e.target.value)}
              className="w-full md:w-80 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 font-bold outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Todas as Congregações (Geral)</option>
              {congregacoes.map((nomeCong) => <option key={nomeCong} value={nomeCong}>{nomeCong}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button onClick={exportarExcel} className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 font-bold text-sm rounded-lg hover:bg-green-100 transition shadow-sm border border-green-200">Excel</button>
            <button onClick={exportarPDF} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 font-bold text-sm rounded-lg hover:bg-red-100 transition shadow-sm border border-red-200">Exportar PDF</button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 w-full relative z-20 items-center justify-between">
          <div className="flex flex-wrap gap-4">
            {/* MESES */}
            <div className="relative">
              <button type="button" onClick={() => setDropdownAberto(dropdownAberto === 'meses' ? null : 'meses')} className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium w-full md:w-48 text-left flex justify-between items-center hover:bg-gray-100 transition">
                {mesesSelecionados.length === 0 ? "Selecionar Mês" : `Meses (${mesesSelecionados.length})`}
              </button>
              {dropdownAberto === 'meses' && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-30 max-h-64 overflow-y-auto">
                  {opcoesMeses.map((mes) => (
                    <label key={mes.valor} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={mesesSelecionados.includes(mes.valor)} onChange={() => toggleFiltro(mesesSelecionados, setMesesSelecionados, mes.valor)} className="w-4 h-4 text-teal-600 rounded border-gray-300" />
                      <span className="text-sm text-gray-700">{mes.rotulo}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* ANOS */}
            <div className="relative">
              <button type="button" onClick={() => setDropdownAberto(dropdownAberto === 'anos' ? null : 'anos')} className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium w-full md:w-36 text-left flex justify-between items-center hover:bg-gray-100 transition">
                {anosSelecionados.length === 0 ? "Selecionar Ano" : `Anos (${anosSelecionados.length})`}
              </button>
              {dropdownAberto === 'anos' && (
                <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-30 max-h-64 overflow-y-auto">
                  {opcoesAnos.map((ano) => (
                    <label key={ano} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={anosSelecionados.includes(ano)} onChange={() => toggleFiltro(anosSelecionados, setAnosSelecionados, ano)} className="w-4 h-4 text-teal-600 rounded border-gray-300" />
                      <span className="text-sm text-gray-700">{ano}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* TRABALHOS */}
            <div className="relative">
              <button type="button" onClick={() => setDropdownAberto(dropdownAberto === 'tipos' ? null : 'tipos')} className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium w-full md:w-48 text-left flex justify-between items-center hover:bg-gray-100 transition">
                {tiposSelecionados.length === 0 ? "Reunião" : `Trabalhos (${tiposSelecionados.length})`}
              </button>
              {dropdownAberto === 'tipos' && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-30 max-h-64 overflow-y-auto">
                  {opcoesTipos.map((tipo) => (
                    <label key={tipo} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={tiposSelecionados.includes(tipo)} onChange={() => toggleFiltro(tiposSelecionados, setTiposSelecionados, tipo)} className="w-4 h-4 text-teal-600 rounded border-gray-300" />
                      <span className="text-sm text-gray-700">{tipo}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="text-sm font-bold text-gray-500 hidden md:block">{lancamentosFiltrados.length} encontrados</div>
        </div>
      </div>

      {/* TABELA PRINCIPAL */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Congregação</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Trabalho</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Ofertas</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Dízimos</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Especial</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Saídas</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-800 uppercase tracking-wider text-right bg-gray-100/50">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lancamentosFiltrados.length > 0 ? (
                lancamentosFiltrados.map((lanc) => (
                  <tr key={lanc.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium whitespace-nowrap">{formatarData(lanc.data)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-bold">{lanc.congregacao || "Geral"}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-medium">{lanc.tipo_trabalho}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatarMoeda(lanc.ofertas)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatarMoeda(lanc.dizimos)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{formatarMoeda(lanc.oferta_especial)}</td>
                    <td className="px-6 py-4 text-sm text-red-600 font-medium text-right">{formatarMoeda(lanc.saidas)}</td>
                    <td className="px-6 py-4 text-sm text-teal-800 font-black text-right bg-gray-50/30">{formatarMoeda(lanc.total)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500 text-sm">Nenhum lançamento encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RESUMO FINANCEIRO */}
      {lancamentosFiltrados.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden resumo-print">
          <div className="p-4 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">Resumo Financeiro e Repasses</h3>
              <p className="text-xs text-gray-400">Cálculos baseados nos lançamentos exibidos acima.</p>
            </div>
            {/* INFORMAÇÃO COMPLEMENTAR PEDIDA */}
            <div className="text-right">
              <span className="text-xs font-bold text-teal-400 uppercase tracking-wider block">Dizimistas Ativos</span>
              <span className="text-xl font-black text-white">{contagemDizimistasFiltrados}</span>
            </div>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4 border-b md:border-b-0 md:border-r border-gray-100 pb-6 md:pb-0 md:pr-8">
              <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Totais Brutos</h4>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Total de Entradas Brutas</span>
                <span className="text-base font-bold text-teal-700">{formatarMoeda(totalEntradasBrutas)}</span>
              </div>
              <div className="flex justify-between items-center text-red-600">
                <span className="text-sm font-medium">(-) Saídas Lançamentos Manuais</span>
                <span className="text-base font-bold">{formatarMoeda(totalSaidasManuais)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Repasses Fixos Calculados <span className="text-xs text-gray-400 normal-case font-normal">(Sobre a Entrada Bruta)</span></h4>
              {saidasFixasCalculadas.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nenhuma saída fixa configurada.</p>
              ) : (
                saidasFixasCalculadas.map((saida) => (
                  <div key={saida.id} className="flex justify-between items-center text-orange-600">
                    <span className="text-sm font-medium">(-) {saida.tipo} <span className="text-xs">({saida.percentual}%)</span></span>
                    <span className="text-sm font-bold">{formatarMoeda(saida.valorCalculado)}</span>
                  </div>
                ))
              )}
              {totalRepassesFixos > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">Total de Repasses</span>
                  <span className="text-sm font-bold text-orange-700">{formatarMoeda(totalRepassesFixos)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 p-6 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Saldo Líquido Parcial</h3>
              <p className="text-xs text-gray-400 mt-1">Disponível em caixa após todas as deduções.</p>
            </div>
            <div className={`text-3xl font-black tracking-tight ${saldoLiquidoParcial >= 0 ? 'text-teal-700' : 'text-red-600'}`}>
              {formatarMoeda(saldoLiquidoParcial)}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}