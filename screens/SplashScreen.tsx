
import React from 'react';

const SplashScreen: React.FC = () => {
  return (
    <div className="h-screen w-full bg-white relative flex flex-col items-center justify-between overflow-hidden">
      <div className="absolute inset-0 opacity-[0.05] bg-grid-pattern"></div>
      
      <div className="absolute top-[-10%] left-[-20%] w-[120vw] h-[120vw] bg-cream-yellow rounded-full blur-[100px] opacity-40 animate-pulse-slow"></div>
      
      <div className="h-20"></div>

      <div className="relative z-10 flex flex-col items-center animate-float">
        <div className="relative w-48 h-48 md:w-56 md:h-56">
          <div className="absolute inset-0 rounded-full border border-primary/20 scale-110"></div>
          <div className="absolute inset-0 rounded-full border border-primary/10 scale-125"></div>
          
          <div className="w-full h-full bg-white/50 backdrop-blur-sm rounded-[2rem] shadow-xl border border-white/40 p-6 flex items-center justify-center">
            <img 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDvcL3jpzSMMhSo7gZm5gqcPeTPtEkEQa6Ij1BJ97OIsbuEVYOwYFTOTe3dD7oljapdeLakYjxQhqWNhnSC3qA8cAQm7-KsCRvPWT5GI0SYm3EhaR3H3H92B0ZBJS84Cwuf9G-RlTRl-yaPUVknBzhu6_um_nw0SvNq4VMfOZKK7BCuN4wr1tPrgfJCObdq4Gn3sd1y6PCodiHhijZd0aFT77tUOEu9uBqetmFH1VUS4Z-N71m6bxovyT-6PbaArcj3_z67mZs31uvZ" 
              alt="Logo" 
              className="w-full h-full object-contain"
            />
          </div>

          <div className="absolute -bottom-4 -right-2 bg-white py-2 px-4 rounded-full shadow-md border border-primary/20 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-sm font-bold">search</span>
            <span className="text-xs font-bold text-forest-green tracking-wider">SCANNING</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 w-full flex flex-col items-center pb-12">
        <h1 className="text-4xl font-bold text-forest-green tracking-tight mb-2">DinoScan</h1>
        <p className="text-primary text-sm font-medium tracking-[0.2em] uppercase mb-12">AI Fossil Identification</p>
        
        <div className="w-16 h-16 relative flex items-center justify-center">
          <svg className="animate-spin w-full h-full text-primary/30" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" fill="none" r="10" stroke="currentColor" stroke-width="2"></circle>
            <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
          </svg>
          <div className="absolute w-2 h-2 bg-primary rounded-full"></div>
        </div>

        <div className="mt-8">
          <span className="text-[10px] text-gray-400 font-mono tracking-widest opacity-60 uppercase">V 2.0 • Research Edition</span>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
