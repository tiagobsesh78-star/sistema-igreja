"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function LandingPageConheca() {
  // =========================================================================
  // CONFIGURAÇÃO DOS LINKS DE PAGAMENTO (ASAAS, MERCADO PAGO, ETC)
  // =========================================================================
  const LINKS_CHECKOUT = {
    iniciante: "https://www.asaas.com/c/f9yeno9z8fvfq9b0", 
    crescimento: "https://www.asaas.com/c/vj6jgd7xzetrhu56", 
    avancado: "https://www.asaas.com/c/sdycxyq4d8f6yj5y", 
  };

  // =========================================================================
  // ESTADOS DA PÁGINA
  // =========================================================================
  const [moduloAtivo, setModuloAtivo] = useState("dashboard");
  const [modalComercialAberto, setModalComercialAberto] = useState(false);
  const [textoCopiado, setTextoCopiado] = useState(false);
  const [modulosExpandidos, setModulosExpandidos] = useState(false);
  const [mostrarVoltarTopo, setMostrarVoltarTopo] = useState(false);

  // Monitora o scroll para mostrar/esconder o botão de voltar ao topo
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setMostrarVoltarTopo(true);
      } else {
        setMostrarVoltarTopo(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Função para copiar o e-mail
  const handleCopiarEmail = () => {
    navigator.clipboard.writeText("comercial@doxohub.com.br");
    setTextoCopiado(true);
    setTimeout(() => setTextoCopiado(false), 2000);
  };

  const tourModulos = {
    dashboard: {
      titulo: "Painel Geral Inteligente",
      descricao: "Uma visão panorâmica e em tempo real da saúde da sua igreja. Gráficos financeiros de receitas e despesas, quadro de avisos automáticos e lembretes cruciais unificados em uma única tela.",
      printDesktop: "/print-desktop.png",
      printMobile: "/print-mobile.png"
    },
    tesouraria: {
      titulo: "Tesouraria Blindada e Auditoria",
      descricao: "Controle absoluto de entradas, saídas manuais e dízimos. Conta com sistema de exclusão lógica (com justificativa obrigatória) que protege o caixa e gera relatórios automáticos em PDF e Excel livres de erros.",
      printDesktop: "/print-tesouraria-desktop.png",
      printMobile: "/print-tesouraria-mobile.png"
    },
    escalas: {
      titulo: "Escalas e Programação Mensal",
      descricao: "Chega de conflitos de horários ou voluntários esquecendo o dia do serviço. Monte painéis de escalas mensais intuitivos organizados por departamentos e congregações.",
      printDesktop: "/print-escalas-desktop.png",
      printMobile: "/print-escalas-mobile.png"
    },
    reunioes: {
      titulo: "Gestão de Reuniões e Livro de Atas",
      descricao: "Cadastre pautas, controle presenças e digite atas com formatação rica em um editor profissional. Permite também anexar documentos escaneados e conecta-se automaticamente com a agenda da igreja.",
      printDesktop: "/print-reunioes-desktop.png",
      printMobile: "/print-reunioes-mobile.png"
    }
  };

  // Lista Completa de Módulos para o botão Expandir
  const todosOsModulos = [
    {
      titulo: "Tela Inicial (Dashboard)",
      icone: "🏠",
      descricao: "O coração do sistema. Resumo completo do que está acontecendo na sua igreja em tempo real.",
      subitens: ["Métricas Gerais", "Quadro de Programação", "Escalas Ativas", "Aniversariantes do Mês"]
    },
    {
      titulo: "Membros e Carteirinhas",
      icone: "👥",
      descricao: "Gestão inteligente do rebanho com emissão de credenciais de identificação automáticas.",
      subitens: ["Listagem e Cargos", "Carteirinha de Membro", "Impressão Individual ou em Lote"]
    },
    {
      titulo: "Tesouraria e Financeiro",
      icone: "📊",
      descricao: "Controle seguro de caixa, prestação de contas transparente e relatórios à prova de erros.",
      subitens: ["Lançamentos por Trabalho", "Controle de Dizimistas", "Chave PIX de Ofertas", "Relatórios Mensais/Anuais"]
    },
    {
      titulo: "Escalas de Voluntários",
      icone: "📅",
      descricao: "Escale ministérios de louvor, portaria, ensino e outros departamentos sem choques de horário.",
      subitens: ["Cadastro de Escalas", "Atribuição de Membros", "Avisos na Tela Inicial"]
    },
    {
      titulo: "Programação e Eventos",
      icone: "🗓️",
      descricao: "O calendário oficial da igreja atualizado. Todos sabem os dias e horários de cada culto.",
      subitens: ["Programação Fixa Mensal", "Eventos Avulsos"]
    },
    {
      titulo: "Reuniões e Atas",
      icone: "✍️",
      descricao: "Digitalize o histórico de decisões da liderança com segurança e facilidade de busca.",
      subitens: ["Cadastro de Reuniões", "Editor de Ata Digital", "Anexo de Atas Manuscritas"]
    },
    {
      titulo: "Controle de Patrimônio",
      icone: "🏢",
      descricao: "Zele pelos bens da igreja registrando tudo o que entra e seu respectivo valor estimado.",
      subitens: ["Cadastro de Bens", "Histórico de Entradas", "Valoração do Patrimônio"]
    },
    {
      titulo: "Visitantes",
      icone: "👋",
      descricao: "Acolhimento perfeito. Registre os visitantes de cada culto para contatos e orações.",
      subitens: ["Ficha do Visitante", "Registro para Contato Posterior"]
    },
    {
      titulo: "Configurações Globais",
      icone: "⚙️",
      descricao: "A identidade visual e institucional da sua igreja refletida em todos os relatórios.",
      subitens: ["Cadastro de CNPJ e Logo", "Dados do Pastor Presidente", "Configurações de Acesso"]
    }
  ];

  const rolarParaTopo = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans selection:bg-blue-200 antialiased relative scroll-smooth overflow-x-hidden">
      
      {/* BOTÃO FLUTUANTE VOLTAR AO TOPO */}
      <button
        onClick={rolarParaTopo}
        title="Voltar ao início"
        className={`fixed bottom-6 right-6 p-3.5 rounded-full bg-gray-900 text-white shadow-xl transition-all duration-300 z-[100] hover:bg-blue-600 hover:-translate-y-1 focus:outline-none ${
          mostrarVoltarTopo ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
        }`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* 1. HEADER REVISADO E 100% RESPONSIVO */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm backdrop-blur-md bg-white/95 w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center min-w-0 mr-2 sm:mr-4">
            <img 
              src="/LOGOTIPO.png" 
              alt="Logo Doxo Hub" 
              className="h-8 sm:h-10 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextElementSibling) {
                  e.currentTarget.nextElementSibling.classList.remove('hidden');
                }
              }}
            />
          </div>
          <nav className="flex items-center gap-2 sm:gap-6 shrink-0">
            <Link 
              href="/login" 
              className="text-gray-600 hover:text-blue-600 font-semibold text-[11px] sm:text-sm transition whitespace-nowrap"
            >
              Já sou cliente
            </Link>
            <Link 
              href="#planos" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-full font-bold text-[11px] sm:text-sm transition whitespace-nowrap shadow-md shadow-blue-200"
            >
              Começar Agora
            </Link>
          </nav>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative bg-white pt-16 pb-12 lg:pt-20 lg:pb-16 overflow-hidden w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600 mb-6 uppercase tracking-wider">
            Solução Exclusiva para Igrejas
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-normal mb-6 leading-tight">
            A gestão da sua Igreja <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              elevada a um novo nível.
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg sm:text-xl text-gray-500 mx-auto mb-10 leading-relaxed font-medium">
            Diga adeus às planilhas confusas e anotações perdidas. O Doxo Hub centraliza tesouraria, escalas, membros e patrimônio em um sistema moderno, seguro e acessível de qualquer lugar.
          </p>
          
          <div className="flex justify-center gap-4 mb-8">
            <Link href="#tour" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-bold text-lg transition shadow-lg shadow-blue-300">
              Conhecer o Sistema por Dentro
            </Link>
          </div>
        </div>
      </section>

      {/* 3. TOUR DO SISTEMA */}
      <section id="tour" className="bg-gray-100 py-16 border-y border-gray-200 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-normal">Veja o Doxo Hub em Ação</h2>
            <p className="mt-3 text-lg text-gray-500 max-w-2xl mx-auto font-medium">
              Selecione os módulos abaixo para visualizar a riqueza de detalhes e a capacidade multiplataforma da nossa interface.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {[
              { id: "dashboard", label: "Painel Geral" },
              { id: "tesouraria", label: "Tesouraria Financeira" },
              { id: "escalas", label: "Escalas de Culto" },
              { id: "reunioes", label: "Atas & Reuniões" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setModuloAtivo(tab.id)}
                className={`px-6 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                  moduloAtivo === tab.id
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200 scale-105"
                    : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center bg-white p-6 sm:p-10 rounded-3xl shadow-xl border border-gray-200/80">
            <div className="lg:col-span-4 space-y-4">
              <h3 className="text-2xl font-extrabold text-gray-900 tracking-normal">
                {tourModulos[moduloAtivo as keyof typeof tourModulos].titulo}
              </h3>
              <p className="text-gray-600 text-base leading-relaxed">
                {tourModulos[moduloAtivo as keyof typeof tourModulos].descricao}
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-md uppercase tracking-wide">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  100% Responsivo e Fluido
                </span>
              </div>
            </div>

            <div className="lg:col-span-8 relative pt-4 pb-12 sm:pb-6 px-2 sm:px-6">
              <div className="relative rounded-xl shadow-xl border border-gray-200 overflow-hidden bg-gray-50 aspect-video w-full transition-all duration-300">
                <img 
                  src={tourModulos[moduloAtivo as keyof typeof tourModulos].printDesktop} 
                  alt="Interface Computador" 
                  className="w-full h-full object-cover object-top"
                  onError={(e) => {
                    e.currentTarget.src = "https://placehold.co/800x450/e2e8f0/1e3a8a?text=Print+Desktop+Em+Breve";
                  }}
                />
              </div>
              <div className="absolute -bottom-8 right-0 sm:right-4 w-36 sm:w-56 rounded-2xl shadow-2xl border-4 border-gray-900 overflow-hidden bg-white aspect-[9/19] z-10 transition-all duration-300 transform hover:scale-105">
                <img 
                  src={tourModulos[moduloAtivo as keyof typeof tourModulos].printMobile} 
                  alt="Interface Celular" 
                  className="w-full h-full object-cover object-top"
                  onError={(e) => {
                    e.currentTarget.src = "https://placehold.co/200x420/e2e8f0/1e3a8a?text=Print+Mobile";
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. EXPANSÃO DE MÓDULOS (NOVO RECURSO) */}
      <section className="bg-white py-16 lg:py-24 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-normal">Um Sistema Robusto e Completo</h2>
            <p className="mt-3 text-lg text-gray-500 font-medium max-w-2xl mx-auto">
              Cada módulo foi pensado para resolver problemas reais do dia a dia da igreja. Descubra tudo o que o Doxo Hub pode fazer por você.
            </p>
          </div>

          <div className="flex justify-center mb-10">
            <button 
              onClick={() => setModulosExpandidos(!modulosExpandidos)}
              className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-3.5 rounded-full font-bold text-sm sm:text-base transition-all duration-300 shadow-lg flex items-center gap-2"
            >
              {modulosExpandidos ? "Ocultar Módulos Detalhados" : "Ver Todos os Módulos"}
              <svg 
                className={`w-5 h-5 transition-transform duration-300 ${modulosExpandidos ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Grid de Módulos Expansível */}
          {modulosExpandidos && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in transition-all duration-500">
              {todosOsModulos.map((modulo, index) => (
                <div key={index} className="bg-gray-50 border border-gray-100 rounded-2xl p-6 hover:shadow-xl hover:border-blue-200 transition-all duration-300 flex flex-col h-full group">
                  <div className="text-4xl mb-4 transform group-hover:scale-110 transition-transform origin-left">{modulo.icone}</div>
                  <h3 className="text-lg font-extrabold text-gray-900 mb-2">{modulo.titulo}</h3>
                  <p className="text-sm text-gray-600 mb-5 flex-grow">{modulo.descricao}</p>
                  
                  {/* Etiquetas (Pills) dos submódulos */}
                  <div className="flex flex-wrap gap-2 mt-auto">
                    {modulo.subitens.map((sub, idx) => (
                      <span key={idx} className="inline-flex items-center text-[11px] font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-md border border-blue-200/50">
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 5. PLANOS E PREÇOS INTEGRADOS AO CHECKOUT */}
      <section id="planos" className="bg-gray-100 py-16 lg:py-24 border-t border-gray-200 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-4 tracking-normal">Um Investimento Justo e Transparente</h2>
          <p className="text-gray-500 text-lg mb-12 max-w-2xl mx-auto font-medium">
            Nossos planos acompanham o crescimento da sua comunidade. Liberação imediata de todos os módulos.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 xl:gap-8 items-stretch">
            
            {/* PLANO 1 */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-200 overflow-hidden flex flex-col transition hover:shadow-2xl hover:-translate-y-1">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-xl font-extrabold text-gray-900 mb-1 tracking-normal">Iniciante</h3>
                <p className="text-gray-500 text-sm h-10 font-medium">Ideal para pequenas congregações</p>
                <div className="mt-2 text-4xl font-extrabold text-gray-900 tracking-normal">
                  R$ 39<span className="text-xl font-bold">,90</span>
                  <span className="text-sm font-medium text-gray-400 tracking-normal">/mês</span>
                </div>
                <div className="mt-4 bg-blue-50 text-blue-700 font-bold py-2 rounded-lg text-sm">
                  Até 100 membros
                </div>
              </div>
              <div className="p-6 bg-white flex-1 flex flex-col justify-between">
                <ul className="space-y-3 mb-6 text-sm text-gray-600 text-left font-medium">
                  <li className="flex items-start gap-2"><svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Todos os Módulos</li>
                  <li className="flex items-start gap-2"><svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Suporte Especializado</li>
                  <li className="flex items-start gap-2"><svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Backup na Nuvem</li>
                </ul>
                <a 
                  href={LINKS_CHECKOUT.iniciante} 
                  className="block w-full text-center bg-white border-2 border-blue-600 hover:bg-blue-50 text-blue-600 font-bold py-3 rounded-xl transition text-sm"
                >
                  Assinar Agora
                </a>
              </div>
            </div>

            {/* PLANO 2 (Destaque) */}
            <div className="bg-blue-600 rounded-3xl shadow-xl border border-blue-600 overflow-hidden flex flex-col transition hover:shadow-2xl hover:-translate-y-1 transform lg:-translate-y-2">
              <div className="bg-blue-700 py-1.5 text-center text-xs font-bold text-white uppercase tracking-widest">
                Recomendado
              </div>
              <div className="p-6 border-b border-blue-500">
                <h3 className="text-xl font-extrabold text-white mb-1 tracking-normal">Crescimento</h3>
                <p className="text-blue-200 text-sm h-10 font-medium">Para igrejas em expansão</p>
                <div className="mt-2 text-4xl font-extrabold text-white tracking-normal">
                  R$ 69<span className="text-xl font-bold">,90</span>
                  <span className="text-sm font-medium text-blue-300 tracking-normal">/mês</span>
                </div>
                <div className="mt-4 bg-white/20 text-white font-bold py-2 rounded-lg text-sm">
                  Até 300 membros
                </div>
              </div>
              <div className="p-6 bg-blue-600 flex-1 flex flex-col justify-between">
                <ul className="space-y-3 mb-6 text-sm text-blue-50 text-left font-medium">
                  <li className="flex items-start gap-2"><svg className="w-5 h-5 text-green-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Todos os Módulos</li>
                  <li className="flex items-start gap-2"><svg className="w-5 h-5 text-green-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Suporte Especializado</li>
                  <li className="flex items-start gap-2"><svg className="w-5 h-5 text-green-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Backup na Nuvem</li>
                </ul>
                <a 
                  href={LINKS_CHECKOUT.crescimento} 
                  className="block w-full text-center bg-white hover:bg-gray-100 text-blue-600 font-bold py-3 rounded-xl transition text-sm shadow-md"
                >
                  Assinar Agora
                </a>
              </div>
            </div>

            {/* PLANO 3 */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-200 overflow-hidden flex flex-col transition hover:shadow-2xl hover:-translate-y-1">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-xl font-extrabold text-gray-900 mb-1 tracking-normal">Avançado</h3>
                <p className="text-gray-500 text-sm h-10 font-medium">Para igrejas sede estruturadas</p>
                <div className="mt-2 text-4xl font-extrabold text-gray-900 tracking-normal">
                  R$ 109<span className="text-xl font-bold">,90</span>
                  <span className="text-sm font-medium text-gray-400 tracking-normal">/mês</span>
                </div>
                <div className="mt-4 bg-blue-50 text-blue-700 font-bold py-2 rounded-lg text-sm">
                  Até 1000 membros
                </div>
              </div>
              <div className="p-6 bg-white flex-1 flex flex-col justify-between">
                <ul className="space-y-3 mb-6 text-sm text-gray-600 text-left font-medium">
                  <li className="flex items-start gap-2"><svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Todos os Módulos</li>
                  <li className="flex items-start gap-2"><svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Suporte Especializado</li>
                  <li className="flex items-start gap-2"><svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Backup na Nuvem</li>
                </ul>
                <a 
                  href={LINKS_CHECKOUT.avancado} 
                  className="block w-full text-center bg-white border-2 border-blue-600 hover:bg-blue-50 text-blue-600 font-bold py-3 rounded-xl transition text-sm"
                >
                  Assinar Agora
                </a>
              </div>
            </div>

            {/* PLANO 4 (Personalizado - Mantém o Modal) */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-200 overflow-hidden flex flex-col transition hover:shadow-2xl hover:-translate-y-1">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-xl font-extrabold text-gray-900 mb-1 tracking-normal">Ministério</h3>
                <p className="text-gray-500 text-sm h-10 font-medium">Grandes campos e convenções</p>
                <div className="mt-2 text-3xl font-extrabold text-gray-900 py-1 tracking-normal">
                  Personalizado
                </div>
                <div className="mt-4 bg-gray-100 text-gray-700 font-bold py-2 rounded-lg text-sm">
                  Acima de 1000 membros
                </div>
              </div>
              <div className="p-6 bg-white flex-1 flex flex-col justify-between">
                <ul className="space-y-3 mb-6 text-sm text-gray-600 text-left font-medium">
                  <li className="flex items-start gap-2"><svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Multi-congregações</li>
                  <li className="flex items-start gap-2"><svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Atendimento Prioritário</li>
                  <li className="flex items-start gap-2"><svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Infraestrutura Dedicada</li>
                </ul>
                <button 
                  type="button"
                  onClick={() => setModalComercialAberto(true)}
                  className="block w-full text-center bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 rounded-xl transition text-sm cursor-pointer"
                >
                  Falar com Comercial
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 6. RODAPÉ */}
      <footer className="bg-gray-900 text-gray-400 py-12 text-center text-sm border-t border-gray-800 w-full">
        <p>© {new Date().getFullYear()} Doxo Hub. Todos os direitos reservados.</p>
        <p className="mt-2 text-xs text-gray-600 font-medium">Desenvolvido com excelência técnica para o serviço do Reino.</p>
      </footer>

      {/* 7. MODAL INTELIGENTE DO COMERCIAL */}
      {modalComercialAberto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 text-gray-900 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative border border-gray-100">
            <button 
              onClick={() => { setModalComercialAberto(false); setTextoCopiado(false); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-1.5 transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <div className="text-center mt-2">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl">
                ✉️
              </div>
              <h3 className="text-xl font-extrabold text-gray-900 mb-2 tracking-normal">Contato Comercial</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                Escolha a forma mais confortável para falar com nossa equipe sobre o plano personalizado para a sua igreja.
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 mb-6 flex items-center justify-between gap-3 overflow-hidden">
                <span className="font-mono text-sm sm:text-base text-gray-700 font-semibold select-all truncate">
                  comercial@doxohub.com.br
                </span>
                <button
                  onClick={handleCopiarEmail}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    textoCopiado 
                      ? "bg-green-600 text-white" 
                      : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                  }`}
                >
                  {textoCopiado ? "Copiado! ✓" : "Copiar"}
                </button>
              </div>

              <div className="space-y-2.5">
                <a 
                  href="mailto:comercial@doxohub.com.br"
                  className="block w-full text-center bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 rounded-xl transition text-sm"
                >
                  Abrir no Aplicativo de E-mail
                </a>
                <button
                  onClick={() => { setModalComercialAberto(false); setTextoCopiado(false); }}
                  className="block w-full text-center bg-white border border-gray-200 text-gray-500 hover:text-gray-700 font-bold py-3 rounded-xl transition text-sm cursor-pointer"
                >
                  Fechar Janela
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}