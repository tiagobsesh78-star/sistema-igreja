"use client";

import Link from "next/link";

export default function FestivalPage() {
  // =========================================================================
  // CONFIGURAÇÃO DOS LINKS EXTERNOS DA PÁGINA
  // Cole aqui os links reais do evento, playlists e localização.
  // =========================================================================
  const LINKS_CONFIG = {
    // Cole aqui o link completo que você copiou do Google Maps para a MEPB Gramoré
    googleMaps: "https://maps.app.goo.gl/Zdz1FiZB6k3QrghRA",
    
    // Cole aqui o link da Playlist Oficial do Spotify
    spotifyPlaylist: "https://open.spotify.com/playlist/3KyTIAwBWksVJ8JaqKJH54?si=8rPB8LydQnmQL4xNhE6iDg",
    
    // Cole aqui o link do canal ou vídeo do YouTube
    youtubeVideo: "https://www.youtube.com/watch?v=PshlhZ0WyPA&list=PLV2CUdJ0SItY&pp=sAgC"
  };

  return (
    <div className="min-h-screen bg-[#110C0A] flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans text-[#F4EFE6] selection:bg-[#D29E57] selection:text-[#110C0A]">
      
      {/* =========================================
        CABEÇALHO / LOGO DO FESTIVAL
        =========================================
      */}
      <div className="w-full max-w-md flex flex-col items-center text-center mb-10 mt-8">
        
        {/* Container circular com a imagem da Doxo Criativa recortada perfeitamente */}
        <div className="w-32 h-32 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(210,158,87,0.25)] border-2 border-[#D29E57]/30 overflow-hidden">
          <img 
            src="/logo-criativa.png" 
            alt="Doxo Criativa" 
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback caso a imagem ainda não tenha sido colocada na pasta public
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) {
                const span = document.createElement('span');
                span.className = "text-xl font-black text-[#110C0A] tracking-tighter";
                span.innerHTML = "DOXO<br/>CREA";
                parent.appendChild(span);
              }
            }}
          />
        </div>
        
        <h1 className="text-3xl font-extrabold tracking-tight text-[#F4EFE6] mb-2 uppercase">
          Festival de Arte Cristã
        </h1>
        <p className="text-[#A8988C] text-sm font-bold tracking-widest uppercase">
          Por Doxo Criativa
        </p>
      </div>

      {/* =========================================
        INFORMAÇÕES DO EVENTO
        =========================================
      */}
      <div className="w-full max-w-md bg-[#1E1512]/80 border border-[#38261F] rounded-2xl p-6 mb-8 backdrop-blur-sm shadow-xl">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#110C0A] rounded-xl text-[#D29E57] border border-[#38261F]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-[#A8988C]">Data e Horário</p>
              <p className="font-bold text-[#F4EFE6]">Sábado, 15 de Novembro • 18h</p>
            </div>
          </div>

          <div className="w-full h-px bg-gradient-to-r from-transparent via-[#38261F] to-transparent"></div>

          <a 
            href={LINKS_CONFIG.googleMaps} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-4 group"
          >
            <div className="p-3 bg-[#110C0A] group-hover:bg-[#D29E57]/10 rounded-xl text-[#D29E57] border border-[#38261F] group-hover:border-[#D29E57]/50 transition-all duration-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-[#A8988C] group-hover:text-[#D29E57] transition-colors">Local (Ver no Maps)</p>
              <p className="font-bold text-[#F4EFE6] transition-colors">MEPB Gramoré</p>
            </div>
          </a>
        </div>
      </div>

      {/* =========================================
        BOTÕES DE LINKS (PLAYLISTS)
        =========================================
      */}
      <div className="w-full max-w-md flex flex-col gap-4 mb-12">
        {/* Botão Spotify */}
        <a 
          href={LINKS_CONFIG.spotifyPlaylist} 
          target="_blank"
          rel="noopener noreferrer"
          className="relative flex items-center justify-center gap-3 w-full bg-[#1DB954] hover:bg-[#1ed760] text-[#110C0A] font-extrabold py-4 px-6 rounded-xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(29,185,84,0.2)]"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          Ouça a Playlist Oficial
        </a>

        {/* Botão YouTube */}
        <a 
          href={LINKS_CONFIG.youtubeVideo} 
          target="_blank"
          rel="noopener noreferrer"
          className="relative flex items-center justify-center gap-3 w-full bg-[#110C0A] border border-[#38261F] hover:border-[#FF0000] text-[#F4EFE6] font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(255,0,0,0.15)]"
        >
          <svg className="w-7 h-7 text-[#FF0000]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          Assista no YouTube
        </a>
      </div>

      {/* =========================================
        ÁREA DA DOXO HUB (PROPAGANDA)
        =========================================
      */}
      <div className="w-full max-w-md mt-auto pt-8 border-t border-[#38261F] flex flex-col items-center">
        <p className="text-[#A8988C] text-xs uppercase tracking-widest font-bold mb-4">
          Apoio Oficial
        </p>
        
        <Link 
          href="/conheca" 
          className="group relative flex flex-col items-center justify-center w-full bg-[#1A1310] border border-[#38261F] hover:border-[#D29E57]/80 rounded-2xl p-5 transition-all duration-500 overflow-hidden"
        >
          {/* Efeito de brilho de fundo no hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#D29E57]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          {/* Container da Imagem do Doxo Hub c/ Tratamento Proporcional da Logo Retangular */}
          <div className="relative z-10 w-full flex justify-center mb-3 h-10 max-w-[180px]">
            <img 
              src="/logobranco.png" 
              alt="Doxo Hub" 
              className="h-full w-auto object-contain transition-transform group-hover:scale-105 duration-300"
              onError={(e) => {
                // Fallback caso dê algum erro na imagem
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  const h2 = document.createElement('h2');
                  h2.className = "text-xl font-bold text-white tracking-tight";
                  h2.innerText = "Doxo Hub";
                  parent.appendChild(h2);
                }
              }}
            />
          </div>
          
          <p className="relative z-10 text-sm text-[#A8988C] text-center group-hover:text-[#F4EFE6] transition-colors duration-300">
            O sistema de gestão definitivo para igrejas. Conheça e revolucione a sua administração.
          </p>

          <div className="relative z-10 mt-4 flex items-center text-[#D29E57] text-sm font-bold group-hover:text-[#F4C88E] transition-colors">
            Saiba mais 
            <svg className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>

    </div>
  );
}