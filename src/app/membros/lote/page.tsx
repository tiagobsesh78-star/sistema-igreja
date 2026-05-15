"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../src/lib/supabase";

function LoteDeCarteirinhas() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids");
  
  const [membros, setMembros] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function buscarMembrosEmLote() {
      if (!idsParam) {
        setCarregando(false);
        return;
      }
      
      const idsArray = idsParam.split(",");
      
      const { data, error } = await supabase
        .from("membros")
        .select("*")
        .in("id", idsArray);

      if (!error && data) {
        setMembros(data);
      }
      setCarregando(false);
    }
    
    buscarMembrosEmLote();
  }, [idsParam]);

  const formatarData = (dataSql: string) => {
    if (!dataSql) return "-";
    const [ano, mes, dia] = dataSql.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  const gerarMatricula = (membro: any) => {
    const anoAtual = new Date().getFullYear();
    if (membro.cpf) {
      const numerosCpf = membro.cpf.replace(/\D/g, '').substring(0, 4);
      return `${anoAtual}.${numerosCpf}`;
    }
    return `${anoAtual}.0001`;
  };

  if (carregando) return <div className="text-center py-20 text-gray-500 font-medium">Gerando lote de carteirinhas...</div>;
  if (membros.length === 0) return <div className="text-center py-20 text-red-500 font-medium">Nenhum membro selecionado.</div>;

  const estiloCartao = {
    width: "324px", minWidth: "324px", height: "204px", minHeight: "204px",
    backgroundColor: "#ffffff", border: "2px solid #0d9488", borderRadius: "8px",
    position: "relative" as any, overflow: "hidden", boxSizing: "border-box" as any,
  };

  const Campo = ({ top, left, w, h, label, valor, center = false, color = "#111827" }: any) => (
    <div style={{
      position: 'absolute', top: `${top}px`, left: `${left}px`, width: `${w}px`, height: `${h}px`,
      border: '1px solid #0d9488', borderRadius: '4px', backgroundColor: '#ffffff',
      display: 'flex', alignItems: 'center', justifyContent: center ? 'center' : 'flex-start',
      padding: center ? '0' : '0 8px', boxSizing: 'border-box'
    }}>
      <span style={{
        position: 'absolute', top: '-6px', left: center ? '50%' : '6px', transform: center ? 'translateX(-50%)' : 'none',
        backgroundColor: '#ffffff', padding: '0 4px', fontSize: '8px', fontWeight: 'bold', color: '#0f766e',
        textTransform: 'uppercase', lineHeight: '1'
      }}>
        {label}
      </span>
      <p style={{
        fontSize: '10px', fontWeight: 'bold', color: color, textTransform: 'uppercase',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        width: '100%', textAlign: center ? 'center' : 'left', margin: 0
      }}>
        {valor || "-"}
      </p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto w-full overflow-hidden">
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* MUDANÇA AQUI: Aplicando a margem de 10mm (topo e rodapé) em TODAS as páginas físicas */
          @page { 
            size: A4 portrait; 
            margin: 10mm 0; 
          }
          
          body { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            background-color: white !important; 
          }
          .ocultar-impressao { display: none !important; }
          
          .area-impressao {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            width: 210mm !important;
            /* Removi o padding-top daqui para não somar com a margem da @page na página 1 */
            padding: 0 !important; 
            background: white !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            gap: 2px !important; 
          }
          
          .linha-cartao {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 0px !important;
          }
        }
      `}} />

      <div className="ocultar-impressao flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-4 md:p-6 rounded-lg shadow-sm border border-gray-200 gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-xl font-bold text-gray-800">Impressão em Lote</h1>
          <p className="text-sm text-gray-500">{membros.length} carteirinhas geradas prontas para corte rápido.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Link href="/membros" className="px-3 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition text-sm flex-1 md:flex-none text-center">
            Voltar
          </Link>
          <button onClick={() => window.print()} className="px-3 py-2 bg-teal-600 text-white font-medium rounded-md hover:bg-teal-700 transition flex items-center justify-center gap-1.5 shadow-sm text-sm flex-1 md:flex-none whitespace-nowrap">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Imprimir {membros.length} Cartões
          </button>
        </div>
      </div>

      <div className="area-impressao bg-white p-4 md:p-8 shadow-lg rounded-lg flex flex-col items-center gap-6 print:gap-[2px] print:p-0 print:shadow-none overflow-x-auto custom-scrollbar">
        
        {membros.map((membro) => (
          <div key={membro.id} className="linha-cartao flex gap-[2px] bg-white p-1 rounded-lg w-max shadow-sm border border-gray-100 print:shadow-none print:border-none print:p-0 print:bg-transparent">
            
            {/* === FRENTE === */}
            <div style={estiloCartao}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '40px', backgroundColor: '#0f766e', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#ffffff' }}>
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>NOME DA SUA IGREJA</h2>
                <p style={{ margin: 0, fontSize: '8px', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '1px' }}>Ministério / Congregação</p>
              </div>

              <div style={{ position: 'absolute', top: '48px', left: '10px', width: '55px', height: '55px', border: '1px solid #5eead4', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', color: '#0d9488' }}>
                <span style={{ fontSize: '8px', fontWeight: 'bold', textAlign: 'center', lineHeight: '1.2' }}>SUA LOGO<br/>AQUI</span>
              </div>

              <div style={{ position: 'absolute', top: '48px', left: '75px', fontSize: '8px', color: '#374151', lineHeight: '1.4' }}>
                <p style={{ margin: 0 }}><span style={{ fontWeight: 'bold', color: '#115e59' }}>Igreja:</span> Rua Exemplo Fictício, 123</p>
                <p style={{ margin: 0 }}><span style={{ fontWeight: 'bold', color: '#115e59' }}>Bairro:</span> Centro</p>
                <p style={{ margin: 0 }}><span style={{ fontWeight: 'bold', color: '#115e59' }}>Cidade:</span> Natal/RN</p>
                <p style={{ margin: 0 }}><span style={{ fontWeight: 'bold', color: '#115e59' }}>CEP:</span> 59000-000</p>
              </div>

              <div style={{ position: 'absolute', top: '95px', left: '244px', width: '66px', height: '88px', border: '2px solid #0d9488', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {membro.foto_url ? (
                  <img src={membro.foto_url} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
                ) : (
                  <span style={{ fontSize: '8px', color: '#9ca3af' }}>Sem Foto</span>
                )}
              </div>

              <Campo top={115} left={10} w={225} h={30} label="Nome" valor={membro.nome_completo} />
              <Campo top={155} left={10} w={145} h={30} label="Cargo" valor={membro.cargo} />
              <Campo top={155} left={165} w={70} h={30} label="Nº Registro" valor={gerarMatricula(membro)} center={true} />
            </div>

            {/* === VERSO === */}
            <div style={estiloCartao}>
              <Campo top={15} left={10} w={145} h={30} label="Congregação" valor="Sede" center={true} />
              <Campo top={15} left={165} w={145} h={30} label="Naturalidade" valor="Brasil" center={true} />
              <Campo top={60} left={10} w={145} h={30} label="CPF" valor={membro.cpf} center={true} />
              <Campo top={60} left={165} w={145} h={30} label="Estado Civil" valor={membro.estado_civil} center={true} />
              <Campo top={105} left={10} w={93} h={30} label="Batismo" valor={formatarData(membro.data_batismo)} center={true} />
              <Campo top={105} left={110} w={94} h={30} label="Nascimento" valor={formatarData(membro.data_nascimento)} center={true} />
              <Campo top={105} left={211} w={99} h={30} label="Status" valor={membro.status} center={true} color={membro.status === 'Ativo' ? '#16a34a' : '#dc2626'} />

              <div style={{ position: 'absolute', top: '155px', left: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '180px', borderTop: '1px solid #000', marginBottom: '4px' }}></div>
                <p style={{ margin: 0, fontSize: '8px', fontWeight: 'bold', color: '#111827', textTransform: 'uppercase' }}>NOME DO PASTOR - PASTOR PRESIDENTE</p>
                <p style={{ margin: '4px 20px 0 20px', fontSize: '7px', color: '#115e59', textAlign: 'center', lineHeight: '1.2', fontWeight: '600' }}>
                  O presente cartão é pessoal e intransferível. Válido em todo território nacional acompanhado de documento oficial com foto.
                </p>
              </div>
            </div>

          </div>
        ))}

      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-500">Preparando layout de impressão...</div>}>
      <LoteDeCarteirinhas />
    </Suspense>
  );
}