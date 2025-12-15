
import React, { useState, useMemo, useEffect } from 'react';
import { CheckCircle2, XCircle, ArrowRight, BookOpen, RotateCcw, Save, Sparkles, Loader2, Search, X, Send, Bot } from 'lucide-react';
import { Question, UserAnswer, SimulationResult } from '../types';
import { analyzeQuestionError, askQuestionTutor } from '../services/geminiService';

interface SimulationRunnerProps {
  simulationId: string;
  questions: Question[];
  initialAnswers?: UserAnswer[];
  onFinish: (result: SimulationResult) => void;
  onUpdate: (result: SimulationResult) => void; // For real-time saving
  topicContext?: string;
  examTitle: string;
}

const SimulationRunner: React.FC<SimulationRunnerProps> = ({ 
  simulationId, 
  questions, 
  initialAnswers = [], 
  onFinish, 
  onUpdate,
  topicContext,
  examTitle
}) => {
  // Initialize state based on previously saved answers if any
  const [currentIndex, setCurrentIndex] = useState(() => {
    // Jump to the first unanswered question
    const answeredIds = new Set(initialAnswers.map(a => a.questionId));
    const firstUnanswered = questions.findIndex(q => !answeredIds.has(q.id));
    return firstUnanswered !== -1 ? firstUnanswered : 0;
  });

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>(initialAnswers);
  const [score, setScore] = useState(() => initialAnswers.filter(a => a.isCorrect).length);
  const [showSummary, setShowSummary] = useState(false);

  // Deep Analysis State
  const [analysisContent, setAnalysisContent] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Tutor Chat State (Simulation)
  const [isTutorOpen, setIsTutorOpen] = useState(false);
  const [tutorQuery, setTutorQuery] = useState('');
  const [tutorResponse, setTutorResponse] = useState<string | null>(null);
  const [isAskingTutor, setIsAskingTutor] = useState(false);

  const currentQuestion = questions[currentIndex];

  // Check if current question was already answered in history (for resuming view)
  useEffect(() => {
    const existingAnswer = userAnswers.find(a => a.questionId === currentQuestion.id);
    if (existingAnswer) {
      setSelectedOption(existingAnswer.selectedOptionIndex);
      setIsAnswered(true);
      // Reset analysis when changing questions
      setAnalysisContent(null);
    } else {
      setSelectedOption(null);
      setIsAnswered(false);
      setAnalysisContent(null);
    }
    // Reset Tutor when changing questions
    setTutorResponse(null);
    setTutorQuery('');
  }, [currentIndex, currentQuestion, userAnswers]);

  const createCurrentResult = (finalStatus: 'IN_PROGRESS' | 'COMPLETED'): SimulationResult => {
      return {
          id: simulationId,
          examTitle: examTitle,
          date: new Date().toISOString(), // Update timestamp on save
          topic: topicContext || questions[0]?.topic || "Geral",
          score: score,
          totalQuestions: questions.length,
          questions: questions,
          userAnswers: userAnswers,
          status: finalStatus
      };
  };

  const handleSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
  };

  const handleConfirm = () => {
    if (selectedOption === null) return;
    
    setIsAnswered(true);
    
    const isCorrect = selectedOption === currentQuestion.correctOptionIndex;
    const newScore = isCorrect ? score + 1 : score;
    setScore(newScore);

    const answer: UserAnswer = {
        questionId: currentQuestion.id,
        selectedOptionIndex: selectedOption,
        isCorrect: isCorrect
    };
    
    const updatedAnswers = [...userAnswers, answer];
    setUserAnswers(updatedAnswers);

    // REAL-TIME SAVE
    const intermediateResult: SimulationResult = {
        id: simulationId,
        examTitle: examTitle,
        date: new Date().toISOString(),
        topic: topicContext || "Geral",
        score: newScore,
        totalQuestions: questions.length,
        questions: questions,
        userAnswers: updatedAnswers,
        status: 'IN_PROGRESS'
    };
    onUpdate(intermediateResult);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      finishSimulation();
    }
  };

  const handleDeepAnalysis = async () => {
      if (!isAnswered || selectedOption === null) return;
      
      setIsAnalyzing(true);
      try {
          const userOptionLabel = String.fromCharCode(65 + selectedOption);
          const explanation = await analyzeQuestionError(currentQuestion, userOptionLabel, examTitle);
          setAnalysisContent(explanation);
      } catch (e) {
          setAnalysisContent("Não foi possível gerar a análise detalhada no momento.");
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleAskTutor = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!tutorQuery.trim()) return;

      setIsAskingTutor(true);
      setTutorResponse(null);

      try {
          const response = await askQuestionTutor(currentQuestion, tutorQuery, isAnswered);
          setTutorResponse(response);
      } catch (e) {
          setTutorResponse("Desculpe, o tutor está indisponível no momento.");
      } finally {
          setIsAskingTutor(false);
      }
  };

  const finishSimulation = () => {
      setShowSummary(true);
      const result = createCurrentResult('COMPLETED');
      onFinish(result); // Final save
  };

  const handleExit = () => {
      // Just save state and exit, don't mark as completed if not done
      const result = createCurrentResult(userAnswers.length === questions.length ? 'COMPLETED' : 'IN_PROGRESS');
      onFinish(result);
  };

  const renderMarkdownSimple = (text: string) => {
      return text.split('\n').map((line, i) => {
          if (line.startsWith('### ')) return <h3 key={i} className="font-bold text-lg mt-4 mb-2 text-indigo-900">{line.replace('### ', '')}</h3>;
          if (line.startsWith('**')) return <p key={i} className="mb-2 font-bold">{line.replace(/\*\*/g, '')}</p>;
          return <p key={i} className="mb-2 text-slate-700 leading-relaxed">{line}</p>;
      });
  };

  const progress = useMemo(() => {
    return ((currentIndex + 1) / questions.length) * 100;
  }, [currentIndex, questions.length]);

  if (showSummary) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-8 text-center animate-fadeIn mt-10">
        <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">🏆</span>
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Simulado Finalizado!</h2>
        <p className="text-slate-600 mb-8">O resultado foi salvo no seu histórico.</p>
        
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-50 p-4 rounded-xl">
            <div className="text-sm text-slate-500 mb-1">Total</div>
            <div className="text-2xl font-bold text-slate-800">{questions.length}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-xl">
            <div className="text-sm text-green-600 mb-1">Acertos</div>
            <div className="text-2xl font-bold text-green-700">{score}</div>
          </div>
          <div className="bg-indigo-50 p-4 rounded-xl">
            <div className="text-sm text-indigo-600 mb-1">Aproveitamento</div>
            <div className="text-2xl font-bold text-indigo-700">{percentage}%</div>
          </div>
        </div>

        <button 
          onClick={handleExit}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2"
        >
          <RotateCcw size={20} />
          Voltar aos Estudos
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fadeIn pb-10 relative">
      {/* Header / Progress */}
      <div className="mb-4 flex items-center justify-between text-sm font-medium text-slate-500">
        <button onClick={handleExit} className="flex items-center hover:text-indigo-600 transition-colors">
            <ArrowRight className="rotate-180 mr-1" size={16} /> Salvar e Sair
        </button>
        <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
            {topicContext === 'Geral' ? 'Simulado Geral' : topicContext}
        </span>
      </div>
      
      <div className="w-full h-3 bg-slate-200 rounded-full mb-8 overflow-hidden relative">
        <div 
          className="h-full bg-indigo-600 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
        <div className="absolute top-0 right-0 h-full flex items-center pr-2">
           <span className="text-[9px] font-bold text-slate-500 mix-blend-multiply">{currentIndex + 1}/{questions.length}</span>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden mb-6 relative">
        <div className="p-6 md:p-8">
          <p className="text-lg md:text-xl text-slate-800 font-medium leading-relaxed mb-8">
            {currentQuestion.text}
          </p>

          <div className="space-y-3">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrect = currentQuestion.correctOptionIndex === idx;
              
              let baseClasses = "w-full text-left p-4 rounded-xl border-2 transition-all relative ";
              
              if (isAnswered) {
                if (isCorrect) {
                  baseClasses += "border-green-500 bg-green-50 text-green-900";
                } else if (isSelected && !isCorrect) {
                  baseClasses += "border-red-500 bg-red-50 text-red-900";
                } else {
                  baseClasses += "border-slate-100 text-slate-400 opacity-60";
                }
              } else {
                if (isSelected) {
                  baseClasses += "border-indigo-600 bg-indigo-50 text-indigo-900";
                } else {
                  baseClasses += "border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  disabled={isAnswered}
                  className={baseClasses}
                >
                  <div className="flex items-start gap-3">
                    <span className={`
                      flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold
                      ${isAnswered && isCorrect ? 'border-green-600 bg-green-600 text-white' : 
                        isAnswered && isSelected && !isCorrect ? 'border-red-500 bg-red-500 text-white' : 
                        isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 text-slate-500'}
                    `}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="flex-1">{option}</span>
                    {isAnswered && isCorrect && <CheckCircle2 size={20} className="text-green-600" />}
                    {isAnswered && isSelected && !isCorrect && <XCircle size={20} className="text-red-500" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end items-center gap-4">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1">
             <Save size={12} /> Progresso salvo automaticamente
          </div>
          {!isAnswered ? (
            <button
              onClick={handleConfirm}
              disabled={selectedOption === null}
              className="px-6 py-2 bg-indigo-600 disabled:bg-slate-300 text-white rounded-lg font-medium transition-colors"
            >
              Confirmar Resposta
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
            >
              {currentIndex < questions.length - 1 ? 'Próxima Questão' : 'Finalizar Simulado'} <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Explanation Area */}
      {isAnswered && (
        <div className="space-y-4 animate-slideUp">
             {/* Basic Explanation */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                <div className="flex items-center gap-2 text-blue-700 font-bold mb-2">
                    <BookOpen size={20} />
                    Gabarito & Comentário Rápido
                </div>
                <p className="text-blue-900 leading-relaxed mb-4">
                    {currentQuestion.explanation}
                </p>
                
                {!analysisContent && !isAnalyzing && (
                    <button 
                        onClick={handleDeepAnalysis}
                        className="w-full bg-white border border-blue-200 text-blue-600 py-3 rounded-lg font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                        <Sparkles size={18} />
                        Professor: Por que eu errei? (Análise Profunda)
                    </button>
                )}
            </div>
            
            {/* Deep Analysis Loading */}
            {isAnalyzing && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 flex flex-col items-center justify-center text-indigo-800">
                    <Loader2 className="animate-spin mb-3" size={32} />
                    <p className="font-medium">O professor está analisando sua resposta e a pegadinha da banca...</p>
                </div>
            )}

            {/* Deep Analysis Content */}
            {analysisContent && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 animate-fadeIn">
                    <div className="flex items-center gap-2 text-indigo-800 font-bold mb-4 pb-2 border-b border-indigo-200">
                        <Sparkles size={20} />
                        Análise de Elite & Aplicação
                    </div>
                    <div className="prose prose-indigo max-w-none">
                        {renderMarkdownSimple(analysisContent)}
                    </div>
                </div>
            )}
        </div>
      )}

      {/* Floating Tutor Button */}
      <button
        onClick={() => setIsTutorOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-white text-indigo-600 rounded-full shadow-2xl hover:bg-indigo-50 transition-all transform hover:scale-110 flex items-center justify-center group border border-indigo-100 z-40"
        title="Tirar dúvida sobre esta questão"
      >
          <Search size={28} />
          <span className="absolute right-full mr-4 bg-slate-900 text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-sm pointer-events-none">
              Dúvida na Questão?
          </span>
      </button>

      {/* Tutor Modal */}
      {isTutorOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                  {/* Header */}
                  <div className="bg-indigo-600 p-4 flex justify-between items-center">
                      <div className="flex items-center gap-2 text-white">
                          <Bot size={24} />
                          <div>
                              <h3 className="font-bold leading-none">Tutor da Questão</h3>
                              <p className="text-xs text-indigo-200 opacity-90 mt-0.5">Pergunte qualquer coisa sobre este exercício</p>
                          </div>
                      </div>
                      <button onClick={() => setIsTutorOpen(false)} className="text-white/80 hover:text-white transition-colors">
                          <X size={24} />
                      </button>
                  </div>

                  {/* Chat Area */}
                  <div className="flex-1 p-4 overflow-y-auto bg-slate-50">
                      {!tutorResponse && !isAskingTutor && (
                          <div className="text-center py-8 text-slate-500">
                              <Search className="w-12 h-12 mx-auto text-indigo-200 mb-2" />
                              <p className="font-medium text-slate-700">Qual sua dúvida?</p>
                              <p className="text-sm mb-4">Posso explicar termos, dar dicas ou traduzir o "juridiquês".</p>
                              <div className="flex flex-wrap gap-2 justify-center">
                                  {["Me dê uma dica", "O que significa o termo no enunciado?", "Por que a letra A está errada?"].map((s, i) => (
                                      <button 
                                          key={i}
                                          onClick={() => setTutorQuery(s)}
                                          className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                                      >
                                          {s}
                                      </button>
                                  ))}
                              </div>
                          </div>
                      )}

                      {isAskingTutor && (
                          <div className="flex flex-col items-center justify-center py-10">
                              <Loader2 className="animate-spin text-indigo-600 mb-2" />
                              <p className="text-sm text-indigo-600 font-medium">Analisando a questão...</p>
                          </div>
                      )}

                      {tutorResponse && (
                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                              <div className="flex gap-3">
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-1">
                                      <Bot size={16} className="text-indigo-600" />
                                  </div>
                                  <div className="prose prose-sm max-w-none text-slate-700">
                                      {renderMarkdownSimple(tutorResponse)}
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>

                  {/* Input */}
                  <form onSubmit={handleAskTutor} className="p-3 bg-white border-t border-slate-200">
                      <div className="relative">
                          <input 
                              type="text" 
                              value={tutorQuery}
                              onChange={(e) => setTutorQuery(e.target.value)}
                              placeholder="Digite sua dúvida..."
                              className="w-full pl-4 pr-12 py-3 bg-slate-100 rounded-xl border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                          />
                          <button 
                              type="submit"
                              disabled={!tutorQuery.trim() || isAskingTutor}
                              className="absolute right-2 top-2 bottom-2 bg-indigo-600 text-white px-3 rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                          >
                              <Send size={16} />
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default SimulationRunner;
