
import React, { useState } from 'react';
import { BookOpen, ArrowLeft, Printer, Share2, Search, X, Send, Bot, AlertTriangle, Lightbulb, CheckCircle, PlusCircle, Loader2, Target, NotebookPen, Save, GraduationCap, MessageSquare, Clock } from 'lucide-react';
import { StudyContent, TutorInteraction } from '../types';

interface StudyViewerProps {
  content: StudyContent;
  initialNote: string;
  history: TutorInteraction[]; // New prop
  onSaveNote: (note: string) => void;
  onSaveInteraction: (question: string, answer: string) => void; // New prop
  onBack: () => void;
  onAskTutor: (question: string) => Promise<string>;
  onExpandContent: () => Promise<void>;
  onCreateSimulation: (count: number) => void;
  onGetAdvancedExplanation: () => Promise<string>;
}

const StudyViewer: React.FC<StudyViewerProps> = ({ 
  content, 
  initialNote, 
  history,
  onSaveNote, 
  onSaveInteraction,
  onBack, 
  onAskTutor, 
  onExpandContent, 
  onCreateSimulation, 
  onGetAdvancedExplanation 
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [tutorResponse, setTutorResponse] = useState<string | null>(null);
  const [currentQuestionTitle, setCurrentQuestionTitle] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  
  // Note State
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [noteContent, setNoteContent] = useState(initialNote);

  // Advanced Teacher State
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [advancedContent, setAdvancedContent] = useState<string | null>(null);
  const [isLoadingAdvanced, setIsLoadingAdvanced] = useState(false);

  // Simulation Modal State
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [simCount, setSimCount] = useState(5);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsAsking(true);
    setTutorResponse(null);
    setCurrentQuestionTitle(query);

    try {
      const response = await onAskTutor(query);
      setTutorResponse(response);
      onSaveInteraction(query, response); // Auto-save logic
    } catch (error) {
      setTutorResponse("Desculpe, houve um erro ao processar sua dúvida.");
    } finally {
      setIsAsking(false);
      setQuery(''); // Clear input after asking
    }
  };
  
  const handleLoadHistory = (item: TutorInteraction) => {
      setQuery('');
      setCurrentQuestionTitle(item.question);
      setTutorResponse(item.answer);
  };
  
  const handleNewChat = () => {
      setQuery('');
      setTutorResponse(null);
      setCurrentQuestionTitle(null);
  };

  const handleExpand = async () => {
    setIsExpanding(true);
    try {
        await onExpandContent();
    } catch (e) {
        alert("Erro ao adicionar mais conteúdo.");
    } finally {
        setIsExpanding(false);
    }
  };

  const handleOpenAdvanced = async () => {
      setIsAdvancedOpen(true);
      if (!advancedContent) {
          setIsLoadingAdvanced(true);
          try {
              const explanation = await onGetAdvancedExplanation();
              setAdvancedContent(explanation);
          } catch (e) {
              setAdvancedContent("Não foi possível carregar a explicação avançada.");
          } finally {
              setIsLoadingAdvanced(false);
          }
      }
  };

  const handleCreateSimulation = () => {
      onCreateSimulation(simCount);
      setIsSimModalOpen(false);
  };
  
  const handleSaveNoteAction = () => {
      onSaveNote(noteContent);
      setIsNoteOpen(false);
  };

  // Advanced Markdown Parser
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    
    // Helper to process bold/italic
    const processInlineStyles = (str: string) => {
      const parts = str.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-bold text-slate-900 bg-yellow-100/50 px-0.5 rounded">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    let i = 0;
    while (i < lines.length) {
      let line = lines[i];
      const key = i;

      // Special Blocks Detection
      
      // 1. WARNING / ATENÇÃO BLOCK
      if (line.includes(':::ATENÇÃO:::') || line.includes(':::CUIDADO:::')) {
        const blockContent: string[] = [];
        i++; // Skip the tag line or process rest of it
        // Capture until next empty line or header
        while(i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#')) {
             blockContent.push(lines[i]);
             i++;
        }
        elements.push(
            <div key={key} className="bg-red-50 border-l-4 border-red-500 p-6 my-6 rounded-r-xl shadow-sm">
                <div className="flex items-center gap-2 text-red-700 font-bold mb-2 uppercase text-sm tracking-wider">
                    <AlertTriangle size={18} /> Ponto de Atenção / Pegadinha
                </div>
                <div className="text-slate-800 leading-relaxed">
                    {blockContent.map((l, idx) => (
                        <p key={idx} className="mb-1">{processInlineStyles(l)}</p>
                    ))}
                </div>
            </div>
        );
        continue;
      }

      // 2. EXAMPLE BLOCK
      if (line.includes(':::EXEMPLO:::')) {
        const blockContent: string[] = [];
        i++; 
        while(i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#')) {
             blockContent.push(lines[i]);
             i++;
        }
        elements.push(
            <div key={key} className="bg-emerald-50 border border-emerald-100 p-6 my-6 rounded-xl shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-100 rounded-bl-full -mr-8 -mt-8"></div>
                <div className="flex items-center gap-2 text-emerald-700 font-bold mb-3">
                    <CheckCircle size={18} /> Exemplo Prático
                </div>
                <div className="text-slate-700 leading-relaxed font-medium">
                    {blockContent.map((l, idx) => (
                        <p key={idx} className="mb-1">{processInlineStyles(l)}</p>
                    ))}
                </div>
            </div>
        );
        continue;
      }

      // Standard Markdown Elements
      if (line.startsWith('# ')) {
        elements.push(
          <div key={key} className="border-b-2 border-slate-100 pb-4 mb-8 mt-10">
             <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
               {line.replace('# ', '')}
             </h1>
          </div>
        );
      }
      else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={key} className="text-2xl font-bold text-indigo-900 mt-12 mb-6 flex items-center gap-3">
            <span className="w-1.5 h-8 bg-indigo-600 rounded-full inline-block"></span>
            {line.replace('## ', '')}
          </h2>
        );
      }
      else if (line.startsWith('### ')) {
        elements.push(<h3 key={key} className="text-xl font-bold text-slate-800 mt-8 mb-4">{line.replace('### ', '')}</h3>);
      }
      else if (line.startsWith('> ')) {
        elements.push(
          <div key={key} className="bg-amber-50 border-l-4 border-amber-400 p-5 my-6 rounded-r-lg text-slate-700 italic flex gap-3">
            <Lightbulb className="text-amber-500 shrink-0 mt-1" size={20} />
            <div>{processInlineStyles(line.replace('> ', ''))}</div>
          </div>
        );
      }
      else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        elements.push(
          <div key={key} className="flex items-start gap-3 mb-3 ml-2 pl-2 border-l-2 border-transparent hover:border-indigo-100 transition-colors">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2.5 shrink-0"></div>
            <p className="text-slate-700 leading-relaxed text-lg">
               {processInlineStyles(line.replace(/^[-*]\s/, ''))}
            </p>
          </div>
        );
      }
      else if (line.trim() === '---') {
        elements.push(<hr key={key} className="my-12 border-slate-200" />);
      }
      else if (line.trim().length === 0) {
        elements.push(<div key={key} className="h-4"></div>);
      }
      else {
        elements.push(
          <p key={key} className="text-lg text-slate-700 leading-8 mb-4 font-serif text-justify">
            {processInlineStyles(line)}
          </p>
        );
      }
      
      i++;
    }
    return elements;
  };

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn pb-20 relative">
      {/* Navigation Bar */}
      <div className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-md py-4 mb-4 border-b border-slate-200 flex justify-between items-center px-4 md:px-0">
        <button 
          onClick={onBack}
          className="flex items-center text-slate-600 hover:text-indigo-600 transition-colors font-medium"
        >
          <ArrowLeft size={20} className="mr-2" /> Voltar ao Painel
        </button>
        <div className="flex gap-2">
          <button className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Imprimir PDF">
            <Printer size={20} />
          </button>
          <button className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Compartilhar">
            <Share2 size={20} />
          </button>
        </div>
      </div>

      {/* Document Container (Paper look) */}
      <div className="bg-white rounded-none md:rounded-xl shadow-xl shadow-slate-200/50 border border-slate-200 min-h-[80vh]">
        <div className="h-2 bg-gradient-to-r from-indigo-600 via-blue-500 to-indigo-600"></div>
        
        <div className="p-6 md:p-16">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-8 mb-8">
            <div>
               <span className="text-xs font-bold tracking-widest text-indigo-500 uppercase mb-2 block">
                 Material de Elite
               </span>
               <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">{content.subject}</h1>
               <p className="text-slate-500 mt-2 font-medium bg-slate-100 px-3 py-1 rounded-full inline-block">
                 Tópico: {content.title}
               </p>
            </div>
            <div className="mt-4 md:mt-0 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100 text-right w-full md:w-auto">
               <div className="flex items-center justify-end gap-2 text-slate-600 text-sm font-medium">
                  <BookOpen size={16} className="text-indigo-500" />
                  ConcursoMestre AI
               </div>
               <p className="text-xs text-slate-400 mt-1">Atualizado com Edital & Banca</p>
            </div>
          </div>

          <article className="prose prose-slate max-w-none prose-headings:font-sans prose-p:font-serif">
             {renderMarkdown(content.content)}
          </article>

          {isExpanding && (
              <div className="mt-10 p-6 bg-slate-50 rounded-xl flex items-center justify-center gap-3">
                  <Loader2 className="animate-spin text-indigo-600" />
                  <span className="text-indigo-700 font-medium">Escrevendo mais conteúdo avançado...</span>
              </div>
          )}

          <div className="mt-20 pt-8 border-t-2 border-dashed border-slate-200 text-center text-slate-400 text-sm">
             <p>Este material foi gerado exclusivamente para seu estudo pessoal.</p>
             <p className="mt-2 font-semibold text-slate-300">FOCO • FORÇA • FÉ</p>
          </div>
        </div>
      </div>

      {/* Floating Buttons Group */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-4 z-50">
          
          {/* Advanced Teacher Button */}
          <button
            onClick={handleOpenAdvanced}
            className="w-14 h-14 bg-white text-cyan-600 rounded-full shadow-lg hover:shadow-xl hover:bg-cyan-50 transition-all transform hover:scale-105 flex items-center justify-center group border border-cyan-100"
            title="Professor Avançado (Passo a Passo)"
          >
            <GraduationCap size={28} />
            <span className="absolute right-full mr-4 bg-slate-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
              Professor Avançado (Passo a Passo)
            </span>
          </button>

          {/* Create Sim Button */}
           <button
            onClick={() => setIsSimModalOpen(true)}
            className="w-14 h-14 bg-white text-emerald-600 rounded-full shadow-lg hover:shadow-xl hover:bg-emerald-50 transition-all transform hover:scale-105 flex items-center justify-center group border border-emerald-100"
            title="Criar Simulado deste Assunto"
          >
            <Target size={28} />
            <span className="absolute right-full mr-4 bg-slate-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
              Criar Simulado
            </span>
          </button>

          {/* Note Button */}
          <button
            onClick={() => setIsNoteOpen(true)}
            className="w-14 h-14 bg-white text-amber-500 rounded-full shadow-lg hover:shadow-xl hover:bg-amber-50 transition-all transform hover:scale-105 flex items-center justify-center group border border-amber-100"
            title="Minhas Anotações"
          >
            <NotebookPen size={28} />
            <span className="absolute right-full mr-4 bg-slate-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
              Minhas Anotações
            </span>
          </button>

          {/* Add Content Button */}
          <button
            onClick={handleExpand}
            disabled={isExpanding}
            className="w-14 h-14 bg-white text-indigo-600 rounded-full shadow-lg hover:shadow-xl hover:bg-slate-50 transition-all transform hover:scale-105 flex items-center justify-center group border border-indigo-100 disabled:opacity-50"
            title="Adicionar mais conteúdo a este tópico"
          >
            <PlusCircle size={28} />
            <span className="absolute right-full mr-4 bg-slate-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
              Expandir Conteúdo
            </span>
          </button>

          {/* Tutor Search Button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-16 h-16 bg-indigo-600 text-white rounded-full shadow-2xl hover:bg-indigo-700 transition-all transform hover:scale-105 flex items-center justify-center group border-4 border-white"
            title="Tirar dúvida com o Tutor IA"
          >
            <Search size={28} />
            <span className="absolute right-full mr-4 bg-slate-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
              Tirar Dúvida
            </span>
          </button>
      </div>

      {/* Advanced Teacher Modal */}
      {isAdvancedOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-5 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-white backdrop-blur-sm">
                            <GraduationCap size={24} />
                          </div>
                          <div>
                            <h3 className="text-white font-bold text-xl leading-none">Professor Avançado</h3>
                            <p className="text-cyan-100 text-xs mt-1">Explicação Passo a Passo e Lógica Estrutural</p>
                          </div>
                      </div>
                      <button onClick={() => setIsAdvancedOpen(false)} className="text-white/80 hover:text-white transition-colors bg-white/10 p-2 rounded-full">
                          <X size={20} />
                      </button>
                  </div>

                  {/* Content */}
                  <div className="p-6 md:p-8 flex-1 overflow-y-auto bg-slate-50">
                      {isLoadingAdvanced ? (
                          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                             <div className="w-16 h-16 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin mb-4"></div>
                             <p className="font-medium text-lg text-slate-700">Dissecando o conteúdo...</p>
                             <p className="text-sm">Criando analogias, regras lógicas e exemplos passo a passo.</p>
                          </div>
                      ) : (
                          <article className="prose prose-cyan max-w-none prose-headings:font-bold prose-headings:text-cyan-900 prose-p:text-slate-700">
                              {advancedContent && renderMarkdown(advancedContent)}
                          </article>
                      )}
                  </div>

                  <div className="p-4 bg-white border-t border-slate-200 text-center">
                      <p className="text-xs text-slate-400">
                        Esta explicação foca na <strong>Lógica de Resolução</strong> para concursos de alto nível.
                      </p>
                  </div>
              </div>
          </div>
      )}

      {/* Note Modal */}
      {isNoteOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                  <div className="bg-amber-100 p-4 flex justify-between items-center border-b border-amber-200">
                      <h3 className="text-amber-900 font-bold flex items-center gap-2">
                          <NotebookPen size={20} />
                          Anotações: {content.title}
                      </h3>
                      <button onClick={() => setIsNoteOpen(false)} className="text-amber-800 hover:text-amber-950">
                          <X size={24} />
                      </button>
                  </div>
                  <div className="p-4 flex-1">
                      <textarea 
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          placeholder="Digite aqui seus resumos, pontos importantes ou lembretes..."
                          className="w-full h-64 p-4 bg-yellow-50/50 border border-yellow-200 rounded-xl resize-none focus:ring-2 focus:ring-amber-400 outline-none text-slate-700 leading-relaxed font-medium"
                      ></textarea>
                  </div>
                  <div className="p-4 border-t border-slate-100 bg-slate-50">
                      <button 
                          onClick={handleSaveNoteAction}
                          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg shadow-md transition-colors flex items-center justify-center gap-2"
                      >
                          <Save size={20} /> Salvar Nota
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Simulation Config Modal */}
      {isSimModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Target className="text-emerald-500" />
                        Criar Simulado Rápido
                    </h3>
                    <button onClick={() => setIsSimModalOpen(false)}><X size={20} className="text-slate-400" /></button>
                </div>
                
                <p className="text-slate-600 mb-6 text-sm">
                    O sistema irá analisar todo o conteúdo deste tópico e criar questões inéditas no estilo da banca.
                </p>

                <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Quantas questões?</label>
                    <div className="flex items-center gap-4">
                        <input 
                            type="range" 
                            min="1" 
                            max="60" 
                            value={simCount} 
                            onChange={(e) => setSimCount(parseInt(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="font-bold text-indigo-600 w-8 text-center">{simCount}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                        <span>1</span>
                        <span>60</span>
                    </div>
                </div>

                <button 
                    onClick={handleCreateSimulation}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-lg shadow-emerald-200 transition-all"
                >
                    Gerar Simulado
                </button>
            </div>
        </div>
      )}

      {/* Tutor Modal - REDESIGNED WITH HISTORY */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row h-[85vh]">
             
             {/* Sidebar: History */}
             <div className="w-full md:w-1/3 bg-slate-50 border-r border-slate-200 flex flex-col">
                 <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
                     <h4 className="font-bold text-slate-700 flex items-center gap-2">
                         <Clock size={18} className="text-indigo-500" /> Histórico
                     </h4>
                     <button 
                        onClick={handleNewChat}
                        className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-full hover:bg-indigo-700 transition-colors font-medium flex items-center gap-1"
                     >
                        <PlusCircle size={14} /> Nova Dúvida
                     </button>
                 </div>
                 <div className="flex-1 overflow-y-auto p-2 space-y-2">
                     {history.length === 0 ? (
                         <div className="text-center p-6 text-slate-400 text-sm">
                             Nenhuma pergunta anterior salva neste tópico.
                         </div>
                     ) : (
                         history.slice().reverse().map((item) => (
                             <button 
                                key={item.id}
                                onClick={() => handleLoadHistory(item)}
                                className={`w-full text-left p-3 rounded-lg text-sm transition-all border ${
                                    currentQuestionTitle === item.question 
                                    ? 'bg-white border-indigo-200 shadow-sm text-indigo-700 ring-1 ring-indigo-50' 
                                    : 'bg-transparent border-transparent hover:bg-white hover:border-slate-200 text-slate-600'
                                }`}
                             >
                                 <p className="font-medium line-clamp-2">{item.question}</p>
                                 <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                    <MessageSquare size={10} /> 
                                    {new Date(item.date).toLocaleDateString('pt-BR')}
                                 </p>
                             </button>
                         ))
                     )}
                 </div>
             </div>

             {/* Main Chat Area */}
             <div className="flex-1 flex flex-col bg-white">
                {/* Header */}
                <div className="p-4 bg-indigo-900 text-white flex justify-between items-center">
                    <div className="flex items-center gap-2">
                    <Bot className="text-indigo-300" />
                    <h3 className="font-bold">Tutor IA - Tira Dúvidas</h3>
                    </div>
                    <button onClick={() => setIsSearchOpen(false)} className="text-white/70 hover:text-white transition-colors">
                    <X size={24} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
                    {!tutorResponse && !isAsking && (
                    <div className="text-center text-slate-500 py-10 flex flex-col items-center h-full justify-center">
                        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                            <Search size={32} className="text-indigo-500" />
                        </div>
                        <p className="text-lg font-bold text-slate-700">Qual sua dúvida sobre este conteúdo?</p>
                        <p className="text-sm mt-2 max-w-xs mb-8">Pergunte sobre conceitos, peça novos exemplos ou explicações simplificadas.</p>
                        
                        <div className="flex flex-wrap gap-2 justify-center max-w-md">
                            {["Explique como se fosse para uma criança", "Dê mais exemplos práticos", "Como isso cai na prova?", "Faça uma tabela resumo"].map((s, i) => (
                                <button 
                                    key={i}
                                    onClick={() => setQuery(s)}
                                    className="text-xs bg-white border border-slate-200 px-3 py-2 rounded-full hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    )}

                    {isAsking && (
                    <div className="flex flex-col items-center justify-center py-10 space-y-4 h-full">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                        <p className="text-indigo-600 font-medium animate-pulse">O professor está formulando a resposta...</p>
                    </div>
                    )}

                    {tutorResponse && (
                    <div className="animate-fadeIn">
                        {currentQuestionTitle && (
                            <div className="mb-6 flex justify-end">
                                <div className="bg-indigo-600 text-white px-4 py-3 rounded-2xl rounded-tr-none max-w-[80%] shadow-md">
                                    <p className="font-medium">{currentQuestionTitle}</p>
                                </div>
                            </div>
                        )}
                        <div className="flex gap-4">
                             <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-1">
                                 <Bot size={16} className="text-indigo-600" />
                             </div>
                             <div className="bg-white p-6 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex-1">
                                <div className="prose prose-sm max-w-none text-slate-700">
                                    {renderMarkdown(tutorResponse)}
                                </div>
                             </div>
                        </div>
                    </div>
                    )}
                </div>

                {/* Input Area */}
                <form onSubmit={handleAsk} className="p-4 bg-white border-t border-slate-200">
                    <div className="relative">
                    <input 
                        type="text" 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Digite sua dúvida aqui..."
                        className="w-full pl-4 pr-12 py-4 bg-slate-100 rounded-xl border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                    <button 
                        type="submit"
                        disabled={!query.trim() || isAsking}
                        className="absolute right-2 top-2 bottom-2 bg-indigo-600 text-white px-4 rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send size={20} />
                    </button>
                    </div>
                </form>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyViewer;
