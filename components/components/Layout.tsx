
import React from 'react';
import { BookOpen, GraduationCap, LayoutDashboard, Bookmark, PieChart, FileText, User } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeView: string;
  onNavigate: (view: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onNavigate }) => {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 w-full overflow-hidden md:overflow-visible">
      {/* Sidebar Navigation */}
      <aside className="bg-indigo-900 text-white w-full md:w-64 flex-shrink-0 flex flex-col h-auto md:h-screen md:sticky md:top-0 z-20 shadow-xl md:shadow-none">
        <div className="p-4 md:p-6 border-b border-indigo-800 flex items-center gap-2 justify-between md:justify-start">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-8 h-8 text-indigo-300" />
            <h1 className="text-xl font-bold tracking-tight">Concurso<span className="text-indigo-300">Mestre</span></h1>
          </div>
          {/* Mobile menu toggle could go here, but for now we keep the list visible or scrollable */}
        </div>
        
        <nav className="p-2 md:p-4 space-y-1 md:space-y-2 overflow-x-auto md:overflow-x-visible flex md:block gap-2 md:gap-0">
          <button
            onClick={() => onNavigate('HOME')}
            className={`flex-shrink-0 md:w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors whitespace-nowrap ${
              activeView === 'HOME' ? 'bg-indigo-800 text-white' : 'text-indigo-200 hover:bg-indigo-800/50'
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Início</span>
          </button>
          
          <button
            onClick={() => onNavigate('MY_STUDIES')}
            className={`flex-shrink-0 md:w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors whitespace-nowrap ${
              activeView === 'MY_STUDIES' ? 'bg-indigo-800 text-white' : 'text-indigo-200 hover:bg-indigo-800/50'
            }`}
          >
            <Bookmark size={20} />
            <span className="font-medium">Meus Estudos</span>
          </button>

          <button
            onClick={() => onNavigate('SIMULATION_HISTORY')}
            className={`flex-shrink-0 md:w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors whitespace-nowrap ${
              activeView === 'SIMULATION_HISTORY' ? 'bg-indigo-800 text-white' : 'text-indigo-200 hover:bg-indigo-800/50'
            }`}
          >
            <PieChart size={20} />
            <span className="font-medium">Simulados</span>
          </button>

          <button
            onClick={() => onNavigate('PAST_EXAMS')}
            className={`flex-shrink-0 md:w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors whitespace-nowrap ${
              activeView === 'PAST_EXAMS' ? 'bg-indigo-800 text-white' : 'text-indigo-200 hover:bg-indigo-800/50'
            }`}
          >
            <FileText size={20} />
            <span className="font-medium">Provas Anteriores</span>
          </button>
          
          <button
            onClick={() => onNavigate('PROFILE')}
            className={`flex-shrink-0 md:w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors whitespace-nowrap ${
              activeView === 'PROFILE' ? 'bg-indigo-800 text-white' : 'text-indigo-200 hover:bg-indigo-800/50'
            }`}
          >
            <User size={20} />
            <span className="font-medium">Meu Perfil</span>
          </button>

          {/* Desktop Only Headers */}
          <div className="hidden md:block pt-4 pb-2 px-4 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            Menu Principal
          </div>
          
          <button
            onClick={() => onNavigate('GUIDE')}
            className={`hidden md:flex w-full items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeView === 'GUIDE' ? 'bg-indigo-800 text-white' : 'text-indigo-200 hover:bg-indigo-800/50'
            }`}
          >
            <BookOpen size={20} />
            <span className="font-medium">Guia do Concurso</span>
          </button>
        </nav>
        
        <div className="p-4 mt-auto hidden md:block">
          <div className="bg-indigo-950/50 p-4 rounded-lg text-xs text-indigo-300">
            <p>Powered by <strong>Gemini 2.5 Flash</strong></p>
            <p className="mt-1 opacity-75">Análise de editais e geração de aulas em segundos.</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-auto md:h-screen overflow-y-auto p-4 md:p-8 w-full">
        <div className="max-w-5xl mx-auto pb-20 md:pb-0">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
