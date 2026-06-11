"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../src/lib/supabase";

export default function ConfiguracoesTesouraria() {
  const router = useRouter();
  const [configuracoes, setConfiguracoes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Estados do Formulário
  const [categoria, setCategoria] = useState("Saída");
  const [tipo, setTipo] = useState("");
  const [percentual, setPercentual] = useState<number | "">("");
  const [origemDestino, setOrigemDestino] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarConfiguracoes();
  }, []);

  async function carregarConfiguracoes() {
    setCarregando(true);
    const { data, error } = await supabase
      .from("tesouraria_configuracoes")
      .select("*")
      .order("categoria", { ascending: false })
      .order("id", { ascending: true });

    if (!error && data) {
      setConfiguracoes(data);
    }
    setCarregando(false);
  }

  const salvarConfiguracao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipo || percentual === "" || !origemDestino) {
      alert("Preencha todos os campos.");
      return;
    }

    setSalvando(true);
    const novaConfig = {
      categoria,
      tipo,
      percentual: Number(percentual),
      origem_destino: origemDestino,
    };

    const { error } = await supabase.from("tesouraria_configuracoes").insert([novaConfig]);

    setSalvando(false);

    if (error) {
      alert("Erro ao salvar configuração: " + error.message);
    } else {
      setTipo("");
      setPercentual("");
      setOrigemDestino("");
      carregarConfiguracoes(); // Recarrega a lista
    }
  };

  const deletarConfiguracao = async (id: number) => {
    if (!confirm("Tem certeza que deseja remover esta configuração?")) return;

    const { error } = await supabase.from("tesouraria_configuracoes").delete().eq("id", id);
    if (error) {
      alert("Erro ao deletar: " + error.message);
    } else {
      carregarConfiguracoes();
    }
  };

  const configuracoesSaida = configuracoes.filter(c => c.categoria === "Saída");
  const configuracoesEntrada = configuracoes.filter(c => c.categoria === "Entrada");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* CABEÇALHO */}
      <div className="flex items-center justify-between bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Configurações Globais</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie as porcentagens fixas de entradas e saídas.</p>
        </div>
        <button 
          onClick={() => router.push("/tesouraria")}
          className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition text-sm"
        >
          Voltar à Tesouraria
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA: FORMULÁRIO DE ADIÇÃO */}
        <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
          <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2 border-gray-100">Nova Configuração</h3>
          
          <form onSubmit={salvarConfiguracao} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Categoria</label>
              <select 
                value={categoria} onChange={(e) => setCategoria(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="Saída">Saída Fixa</option>
                <option value="Entrada">Entrada Fixa</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo (Nome)</label>
              <input 
                type="text" placeholder="Ex: Sede, Missões..."
                value={tipo} onChange={(e) => setTipo(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Percentual (%)</label>
              <input 
                type="number" step="0.01" min="0" max="100" placeholder="Ex: 10 para 10%"
                value={percentual} onChange={(e) => setPercentual(e.target.value ? parseFloat(e.target.value) : "")}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Origem / Destino</label>
              <input 
                type="text" placeholder="Ex: Conta da Sede, Fundo X..."
                value={origemDestino} onChange={(e) => setOrigemDestino(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <button 
              type="submit" disabled={salvando}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg transition mt-2 disabled:bg-teal-400"
            >
              {salvando ? "Adicionando..." : "Adicionar Configuração"}
            </button>
          </form>
        </div>

        {/* COLUNA DIREITA: LISTAGEM DAS CONFIGURAÇÕES */}
        <div className="md:col-span-2 space-y-6">
          
          {/* LISTA DE SAÍDAS FIXAS */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-red-50 border-b border-red-100">
              <h3 className="font-bold text-red-800">Saídas Fixas Cadastradas</h3>
            </div>
            <div className="p-0">
              {carregando ? (
                <p className="p-4 text-sm text-gray-500">Carregando...</p>
              ) : configuracoesSaida.length === 0 ? (
                <p className="p-4 text-sm text-gray-500 text-center">Nenhuma saída fixa configurada.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {configuracoesSaida.map(conf => (
                    <li key={conf.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                      <div>
                        <p className="font-bold text-gray-800">{conf.tipo} <span className="text-red-600 ml-1">({conf.percentual}%)</span></p>
                        <p className="text-xs text-gray-500">Destino: {conf.origem_destino}</p>
                      </div>
                      <button onClick={() => deletarConfiguracao(conf.id)} className="text-gray-400 hover:text-red-600 transition p-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* LISTA DE ENTRADAS FIXAS */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-green-50 border-b border-green-100">
              <h3 className="font-bold text-green-800">Entradas Fixas Cadastradas</h3>
            </div>
            <div className="p-0">
              {carregando ? (
                <p className="p-4 text-sm text-gray-500">Carregando...</p>
              ) : configuracoesEntrada.length === 0 ? (
                <p className="p-4 text-sm text-gray-500 text-center">Nenhuma entrada fixa configurada.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {configuracoesEntrada.map(conf => (
                    <li key={conf.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                      <div>
                        <p className="font-bold text-gray-800">{conf.tipo} <span className="text-green-600 ml-1">({conf.percentual}%)</span></p>
                        <p className="text-xs text-gray-500">Origem: {conf.origem_destino}</p>
                      </div>
                      <button onClick={() => deletarConfiguracao(conf.id)} className="text-gray-400 hover:text-red-600 transition p-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}