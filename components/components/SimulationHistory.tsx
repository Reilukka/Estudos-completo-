
import React, { useState, useEffect } from 'react';
import { SimulationResult, ExamData } from '../types';
import { PieChart, Clock, Target, ChevronDown, ChevronUp, CheckCircle, XCircle, BookOpen, PlayCircle, Plus, AlertTriangle } from 'lucide-react';

interface SimulationHistoryProps {
  history: SimulationResult[];
  availableExams: ExamData[]; // To allow creating general sims for specific exams
  onResume: (sim: SimulationResult) => void;
  onCreateGeneralSim: (examData: ExamData, count: number) => void;
  onReviewErrors: (examTitle: string) => void;
}

const SimulationHistory: React.FC<SimulationHistoryProps> = ({ history, availableExams, onResume, onCreateGeneralSim, onReviewErrors }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedExamTitle, setSelectedExamTitle] = useState<string>(availableExams[0]?.title || "");
  const [generalSimModalOpen, setGeneralSimModalOpen] = useState(false);
  const [generalSimCount, setGeneralSimCount] = useState(60);

  // Filter history based on selection
  const filteredHistory = selectedExamTitle 
    ? history.filter(h => h.examTitle === selectedExamTitle)
    : history;
  
  // Calculate total unique errors for the selected exam
  const totalErrors = selectedExamTitle ? (() => {
      const wrongIds = new Set();
      filteredHistory.forEach(sim => {
          sim.userAnswers.forEach(ans => {
              if (!ans.isCorrect) wrongIds.add(ans.questionId);
          });
      });
      return wrongIds.size;
  })() : 0;

  useEffect(() => {
    if (!selectedExamTitle && availableExams.length > 0) {
        setSelectedExamTitle(availableExams[0].title);
    }
  }, [availableExams, selectedExamTitle]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const handleCreateClick = () => {
    const selectedExam = availableExams.find(e => e.title === selectedExamTitle);
    if (selectedExam) {
        onCreateGeneralSim(selectedExam, generalSimCount);
        setGeneralSimModalOpen(false);
    }
  };

  return (
    <div className="animate-fadeIn pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                <PieChart className="text-indigo-600" /> Simulados
            </h2>
            <p className="text-slate-500">Histórico e criação de provas completas</p>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
             <select 
                value={selectedExamTitle} 
                onChange={(e) => setSelectedExamTitle(e.target.value)}
                className="bg-white border border-slate-300 text-slate-700 py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
             >
                 {availableExams.map((exam, idx) => (
                     <option key={idx} value={exam.title}>{exam.title}</option>
                 ))}
                 {availableExams.length === 0 && <option value="">Nenhum concurso salvo</option>}
             </select>
          </div>
      </div>

      {/* Main Actions Area */}
      {selectedExamTitle && (
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-6 mb-10 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full transform translate-x-1/2 -translate-y-1/2"></div>
            
            <div className="relative z-10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
                    <div>
                        <h3 className="text-xl font-bold mb-2">Simulados Inteligentes</h3>
                        <p className="text-indigo-100 max-w-lg">
                            Crie provas completas baseadas no edital ou revise seus erros para fortalecer seus pontos fracos.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                        onClick={() => setGeneralSimModalOpen(true)}
                        className="flex-1 bg-white text-indigo-700 hover:bg-indigo-50 font-bold py-4 px-6 rounded-xl shadow-md transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3"
                    >
                        <Plus size={24} /> 
                        <div className="text-left">
                            <div className="text-sm font-normal text-indigo-500">Novo</div>
                            Simulado Geral (Prova Real)
                        </div>
                    </button>

                    <button 
                        onClick={() => onReviewErrors(selectedExamTitle)}
                        disabled={totalErrors === 0}
                        className={`flex-1 font-bold py-4 px-6 rounded-xl shadow-md transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3 ${
                            totalErrors > 0 
                                ? 'bg-orange-500 hover:bg-orange-400 text-white' 
                                : 'bg-white/10 text-white/50 cursor-not-allowed'
                        }`}
                    >
                        <AlertTriangle size={24} />
                        <div className="text-left">
                            <div className={`text-sm font-normal ${totalErrors > 0 ? 'text-orange-100' : 'text-white/40'}`}>
                                {totalErrors > 0 ? `${totalErrors} Questões` : 'Sem erros'}
                            </div>
                            Revisar Erros
                        </div>
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* General Sim Modal */}
      {generalSimModalOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Criar Simulado: Estilo Prova Real</h3>
                    <p className="text-sm text-slate-500 mb-6">
                        O sistema irá analisar a banca organizadora e a distribuição das matérias do edital para criar uma prova fiel à realidade.
                    </p>
                    <div className="mb-6">
                        <label className="block text-sm font-semibold text-slate-600 mb-2">Número de Questões</label>
                        <div className="flex items-center gap-2">
                             <input 
                                type="range" min="30" max="120" step="10" 
                                value={generalSimCount} 
                                onChange={(e) => setGeneralSimCount(parseInt(e.target.value))}
                                className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                             />
                             <span className="font-bold text-indigo-600 w-10 text-right">{generalSimCount}</span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setGeneralSimModalOpen(false)} className="flex-1 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-medium">Cancelar</button>
                        <button onClick={handleCreateClick} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700">Gerar Prova</button>
                    </div>
                </div>
           </div>
      )}

      {/* Empty State */}
      {filteredHistory.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <PieChart size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-600">Nenhum simulado para este concurso</h3>
          <p className="text-slate-400">Crie simulados personalizados ou gerais para começar.</p>
        </div>
      )}

      {/* List */}
      <div className="space-y-4">
        {filteredHistory.slice().reverse().map((sim) => {
           const isCompleted = sim.status === 'COMPLETED';
           const simAccuracy = sim.totalQuestions > 0 ? Math.round((sim.score / sim.totalQuestions) * 100) : 0;
           const isExpanded = expandedId === sim.id;
           
           return (
             <div key={sim.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${isCompleted ? 'border-slate-200' : 'border-indigo-200 ring-1 ring-indigo-50'}`}>
               <div 
                 onClick={() => isCompleted ? toggleExpand(sim.id) : onResume(sim)}
                 className="p-6 cursor-pointer hover:bg-slate-50 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
               >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                       <span className="font-bold text-lg text-slate-800">{sim.topic}</span>
                       {!isCompleted && (
                           <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide animate-pulse">
                               Em Andamento
                           </span>
                       )}
                       {sim.topic === "Revisão de Erros" && (
                           <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                               Revisão
                           </span>
                       )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                        <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full">
                           <Clock size={12} /> {formatDate(sim.date)}
                        </span>
                        <span>
                            {isCompleted 
                              ? `${sim.score} acertos de ${sim.totalQuestions}`
                              : `${sim.userAnswers.length} respondidas de ${sim.totalQuestions}`
                            }
                        </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                     {!isCompleted ? (
                         <button 
                            onClick={(e) => { e.stopPropagation(); onResume(sim); }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-sm transition-transform hover:scale-105"
                         >
                            <PlayCircle size={18} /> Continuar
                         </button>
                     ) : (
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <span className={`text-2xl font-bold ${
                                    simAccuracy >= 70 ? 'text-green-600' : simAccuracy >= 50 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                    {simAccuracy}%
                                </span>
                                <p className="text-xs text-slate-400 uppercase">Aproveitamento</p>
                            </div>
                            {isExpanded ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
                        </div>
                     )}
                  </div>
               </div>

               {isExpanded && isCompleted && (
                 <div className="border-t border-slate-100 bg-slate-50/50 p-6 space-y-6 animate-slideDown cursor-default">
                    <h4 className="font-bold text-slate-700 mb-4">Gabarito Comentado</h4>
                    {sim.questions.map((q, idx) => {
                        const userAnswer = sim.userAnswers.find(ua => ua.questionId === q.id);
                        const isCorrect = userAnswer?.isCorrect;
                        
                        return (
                            <div key={idx} className="bg-white p-5 rounded-lg border border-slate-200">
                                <div className="flex gap-3">
                                   <div className="mt-1">
                                      {isCorrect ? <CheckCircle className="text-green-500" size={20} /> : <XCircle className="text-red-500" size={20} />}
                                   </div>
                                   <div className="flex-1">
                                      <p className="text-slate-800 font-medium mb-3">{q.text}</p>
                                      
                                      <div className="space-y-2 mb-4">
                                         {q.options.map((opt, optIdx) => {
                                             const isUserChoice = userAnswer?.selectedOptionIndex === optIdx;
                                             const isCorrectChoice = q.correctOptionIndex === optIdx;
                                             
                                             let style = "text-slate-500 text-sm p-2 rounded border border-transparent";
                                             if (isCorrectChoice) style = "bg-green-50 border-green-200 text-green-800 font-medium";
                                             if (isUserChoice && !isCorrectChoice) style = "bg-red-50 border-red-200 text-red-800 font-medium line-through decoration-red-500";
                                             
                                             return (
                                                 <div key={optIdx} className={style}>
                                                     <span className="font-bold mr-2">{String.fromCharCode(65 + optIdx)})</span>
                                                     {opt}
                                                 </div>
                                             );
                                         })}
                                      </div>

                                      <div className="bg-indigo-50 p-3 rounded-lg text-sm text-indigo-800 border border-indigo-100">
                                         <strong>Comentário:</strong> {q.explanation}
                                      </div>
                                   </div>
                                </div>
                            </div>
                        );
                    })}
                 </div>
               )}
             </div>
           );
        })}
      </div>
    </div>
  );
};

export default SimulationHistory;
