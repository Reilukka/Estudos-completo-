
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import ExamCard from './components/ExamCard';
import SimulationRunner from './components/SimulationRunner';
import StudyViewer from './components/StudyViewer';
import SimulationHistory from './components/SimulationHistory';
import Profile from './components/Profile';
import { analyzeExam, generateSimulation, generateStudyContent, getSubjectsForRole, askStudyTutor, expandStudyContent, generateStepByStepExplanation, findPastExamQuestions, getExamBlueprint, generateDailyStudyPlan, enhanceSubjectTopics } from './services/geminiService';
import { ExamData, Question, ViewState, StudyContent, Subject, SimulationResult, UserAnswer, TutorInteraction, DailyPlan } from './types';
import { Search, Loader2, Sparkles, SlidersHorizontal, ArrowLeft, Bookmark, Trash2, FileText, Calendar, Briefcase, ChevronRight } from 'lucide-react';

const App: React.FC = () => {
  // State
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Data
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [examSources, setExamSources] = useState<{ title: string; uri: string }[]>([]);
  const [savedExams, setSavedExams] = useState<ExamData[]>([]);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  
  // Past Exams State
  const [pastExamSearch, setPastExamSearch] = useState('');
  const [foundPastExam, setFoundPastExam] = useState<{ questions: Question[], title: string, year: string, org: string } | null>(null);

  // Study & Sim State
  const [simConfig, setSimConfig] = useState({ count: 5, topic: 'Geral', contextContent: '' });
  // Active Simulation State
  const [activeSimId, setActiveSimId] = useState<string | null>(null);
  const [activeSimQuestions, setActiveSimQuestions] = useState<Question[]>([]);
  const [activeSimInitialAnswers, setActiveSimInitialAnswers] = useState<UserAnswer[]>([]);
  const [activeSimTitle, setActiveSimTitle] = useState<string>(''); // To know which exam context

  const [studyContent, setStudyContent] = useState<StudyContent | null>(null);

  // --- PERSISTENCE LOGIC START ---

  // 1. Load Data on Mount (Session & Database)
  useEffect(() => {
    // A. Load "Database" (Saved Exams List)
    const saved = localStorage.getItem('concursoMestre_saved');
    if (saved) {
      try {
        setSavedExams(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar estudos salvos");
      }
    }

    // B. Load "Session" (Current Workspace State)
    const sessionJson = localStorage.getItem('concursoMestre_session');
    if (sessionJson) {
      try {
        const session = JSON.parse(sessionJson);
        
        // Restore specific states if they exist
        if (session.view) setView(session.view);
        if (session.searchTerm) setSearchTerm(session.searchTerm);
        if (session.examData) setExamData(session.examData);
        if (session.examSources) setExamSources(session.examSources);
        
        // Restore Active Simulation
        if (session.activeSimId) setActiveSimId(session.activeSimId);
        if (session.activeSimQuestions) setActiveSimQuestions(session.activeSimQuestions);
        if (session.activeSimInitialAnswers) setActiveSimInitialAnswers(session.activeSimInitialAnswers);
        if (session.activeSimTitle) setActiveSimTitle(session.activeSimTitle);
        if (session.simConfig) setSimConfig(session.simConfig);
        
        // Restore Study Content
        if (session.studyContent) setStudyContent(session.studyContent);
        
        // Restore Past Exam Search
        if (session.pastExamSearch) setPastExamSearch(session.pastExamSearch);
        if (session.foundPastExam) setFoundPastExam(session.foundPastExam);

      } catch (e) {
        console.error("Erro ao restaurar sessão anterior", e);
      }
    }
  }, []);

  // 2. Save "Database" (Saved Exams) whenever it changes
  useEffect(() => {
    localStorage.setItem('concursoMestre_saved', JSON.stringify(savedExams));
  }, [savedExams]);

  // 3. Save "Session" (Workspace) whenever ANY relevant state changes
  useEffect(() => {
    const sessionState = {
      view,
      searchTerm,
      examData,
      examSources,
      activeSimId,
      activeSimQuestions,
      activeSimInitialAnswers,
      activeSimTitle,
      simConfig,
      studyContent,
      pastExamSearch,
      foundPastExam
    };
    localStorage.setItem('concursoMestre_session', JSON.stringify(sessionState));
  }, [
    view, 
    searchTerm, 
    examData, 
    examSources, 
    activeSimId, 
    activeSimQuestions, 
    activeSimInitialAnswers, 
    activeSimTitle, 
    simConfig, 
    studyContent,
    pastExamSearch,
    foundPastExam
  ]);

  // --- PERSISTENCE LOGIC END ---

  // Handlers
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setLoadingMessage(`Pesquisando e analisando edital e estilo de banca para "${searchTerm}"...`);
    try {
      const result = await analyzeExam(searchTerm);
      setExamData(result.data);
      setExamSources(result.sources);
      setView(ViewState.GUIDE);
    } catch (err) {
      alert("Falha ao analisar o concurso. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSave = () => {
    if (!examData) return;
    const isSaved = savedExams.some(e => e.title === examData.title);
    
    if (isSaved) {
      setSavedExams(prev => prev.filter(e => e.title !== examData.title));
    } else {
      setSavedExams(prev => [...prev, examData]);
    }
  };

  const handleOpenSavedExam = (exam: ExamData) => {
    setExamData(exam);
    setExamSources([]); // Saved exams might not have persisted sources for now
    setView(ViewState.GUIDE);
  };

  const handleRemoveSaved = (e: React.MouseEvent, title: string) => {
    e.stopPropagation();
    setSavedExams(prev => prev.filter(ex => ex.title !== title));
  };

  const handleRoleSelection = async (role: string) => {
     if (!examData) return;
     
     // Update selected role immediately
     const updatedExamData = { ...examData, selectedRole: role };
     setExamData(updatedExamData);
     setIsUpdatingRole(true);

     try {
        const specificSubjects = await getSubjectsForRole(examData.title, examData.organization, role);
        const finalData = {
            ...updatedExamData,
            subjects: specificSubjects
        };
        setExamData(finalData);
        
        // If this exam is saved, update the saved version too
        setSavedExams(prev => prev.map(ex => 
            ex.title === examData.title ? finalData : ex
        ));

     } catch (error) {
        alert("Erro ao carregar matérias específicas para este cargo.");
     } finally {
        setIsUpdatingRole(false);
     }
  };
  
  // NEW: Enhance Subject Topics (Add missing ones)
  const handleEnhanceSubject = async (subjectName: string): Promise<boolean> => {
      if (!examData) return false;
      
      try {
          // Find the specific subject
          const subject = examData.subjects.find(s => s.name === subjectName);
          if (!subject) return false;

          const newTopics = await enhanceSubjectTopics(examData, subjectName, subject.topics);
          
          if (newTopics.length === 0) return false; // Nothing new found

          // Merge new topics
          const updatedSubjects = examData.subjects.map(s => {
              if (s.name === subjectName) {
                  return { ...s, topics: [...s.topics, ...newTopics] };
              }
              return s;
          });

          const updatedExam = { ...examData, subjects: updatedSubjects };
          setExamData(updatedExam);
          
          // Update Persistence
          setSavedExams(prev => prev.map(ex => 
              ex.title === examData.title ? updatedExam : ex
          ));
          
          return true;
      } catch (e) {
          console.error(e);
          return false;
      }
  };

  // NEW: Generate Daily Plan
  const handleGeneratePlan = async (hours: number) => {
      if (!examData) return;
      
      setLoading(true);
      setLoadingMessage(`Organizando ${hours} horas de estudo. Balanceando revisão (o que você já viu) com novos tópicos do edital...`);
      
      try {
          const plan = await generateDailyStudyPlan(examData, hours);
          
          const currentPlans = examData.dailyPlans || [];
          // Keep only the latest plan for "today" or append to history. 
          // For simplicity, let's append but UI will show the latest.
          const updatedPlans = [...currentPlans, plan];
          
          const updatedExam = { ...examData, dailyPlans: updatedPlans };
          setExamData(updatedExam);
          
          // Update persistent store
          setSavedExams(prev => prev.map(ex => 
              ex.title === examData.title ? updatedExam : ex
          ));
          
      } catch (e) {
          alert("Erro ao gerar plano de estudo.");
      } finally {
          setLoading(false);
      }
  };

  // NEW: Toggle Plan Slot Completion
  const handleTogglePlanSlot = (planId: string, slotId: string) => {
      if (!examData || !examData.dailyPlans) return;
      
      const updatedPlans = examData.dailyPlans.map(plan => {
          if (plan.id === planId) {
              const updatedSlots = plan.slots.map(slot => {
                  if (slot.id === slotId) {
                      return { ...slot, completed: !slot.completed };
                  }
                  return slot;
              });
              return { ...plan, slots: updatedSlots };
          }
          return plan;
      });
      
      const updatedExam = { ...examData, dailyPlans: updatedPlans };
      setExamData(updatedExam);
      
      // Update persistent store
      setSavedExams(prev => prev.map(ex => 
          ex.title === examData.title ? updatedExam : ex
      ));
  };

  // --- Simulation Logic ---

  const prepareSimulation = () => {
    setSimConfig({ count: 5, topic: 'Geral', contextContent: '' });
    setView(ViewState.SIMULATION_SETUP);
  };

  // Helper to persist simulation updates
  const updateSimulationInHistory = (result: SimulationResult, targetExamTitle: string) => {
     // We need to find the exam data to update, which might be 'examData' or one in 'savedExams'
     setSavedExams(prev => prev.map(ex => {
         if (ex.title === targetExamTitle) {
             const existingHistory = ex.simulationHistory || [];
             // Check if exists
             const exists = existingHistory.find(h => h.id === result.id);
             let newHistory;
             if (exists) {
                 newHistory = existingHistory.map(h => h.id === result.id ? result : h);
             } else {
                 newHistory = [...existingHistory, result];
             }
             return { ...ex, simulationHistory: newHistory };
         }
         return ex;
     }));

     // If current examData matches, update it too to reflect UI changes instantly
     if (examData && examData.title === targetExamTitle) {
         setExamData(prev => {
             if (!prev) return null;
             const existingHistory = prev.simulationHistory || [];
             const exists = existingHistory.find(h => h.id === result.id);
             let newHistory;
             if (exists) {
                 newHistory = existingHistory.map(h => h.id === result.id ? result : h);
             } else {
                 newHistory = [...existingHistory, result];
             }
             return { ...prev, simulationHistory: newHistory };
         });
     }
  };

  const initializeSimulationSession = (questions: Question[], topic: string, examTitle: string) => {
      const newSimId = Date.now().toString();
      const initialResult: SimulationResult = {
          id: newSimId,
          examTitle: examTitle,
          date: new Date().toISOString(),
          topic: topic,
          score: 0,
          totalQuestions: questions.length,
          questions: questions,
          userAnswers: [],
          status: 'IN_PROGRESS'
      };

      // 1. Save immediately to history
      updateSimulationInHistory(initialResult, examTitle);

      // 2. Set active state
      setActiveSimId(newSimId);
      setActiveSimQuestions(questions);
      setActiveSimInitialAnswers([]);
      setActiveSimTitle(examTitle);

      setView(ViewState.SIMULATION_ACTIVE);
  };

  const startSimulation = async () => {
    if (!examData) return;
    
    setLoading(true);
    setLoadingMessage(`Gerando ${simConfig.count} questões inéditas de ${simConfig.topic}...`);
    
    try {
      const questions = await generateSimulation(
        examData.title,
        simConfig.count,
        simConfig.topic,
        simConfig.contextContent,
        undefined, // allSubjects not needed for simple sim
        examData.organization // pass org to maintain style
      );
      initializeSimulationSession(questions, simConfig.topic, examData.title);
    } catch (err) {
      alert("Erro ao criar simulado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSimulation = async (count: number) => {
      if (!studyContent || !examData) return;

      setLoading(true);
      setLoadingMessage(`Criando ${count} questões no estilo da banca ${examData.organization} sobre "${studyContent.title}"...`);
      
      try {
        const questions = await generateSimulation(
            examData.title,
            count,
            studyContent.title,
            studyContent.content,
            undefined, 
            examData.organization, // Pass Org
            examData.selectedRole  // Pass Role
        );
        initializeSimulationSession(questions, `${studyContent.title} (Treino Focado)`, examData.title);
      } catch (err) {
        alert("Erro ao gerar simulado personalizado.");
      } finally {
        setLoading(false);
      }
  };

  const handleCreateGeneralSimulation = async (targetExam: ExamData, count: number) => {
      setLoading(true);
      
      const role = targetExam.selectedRole || "Geral";
      
      // Step 1: Analyze Exam Structure First (The Blueprint)
      setLoadingMessage(`Investigando edital do cargo "${role}" e analisando últimas provas da banca ${targetExam.organization} para desenhar o espelho da prova...`);
      
      try {
          // Get the strict distribution logic first
          const blueprint = await getExamBlueprint(targetExam.title, targetExam.organization, role, count);
          
          // Step 2: Generate Questions based on Blueprint
          setLoadingMessage(`Elaborando ${count} questões inéditas com base na estrutura real descoberta...`);
          
          const questions = await generateSimulation(
              targetExam.title,
              count,
              "Geral",
              "",
              targetExam.subjects, 
              targetExam.organization,
              role, // Pass Role
              blueprint // Pass Strict Blueprint
          );
          
          initializeSimulationSession(questions, `Simulado Espelho (${role})`, targetExam.title);
      } catch (e) {
          alert("Erro ao criar simulado geral. Verifique sua conexão.");
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handleReviewErrors = (examTitle: string) => {
      // Find the exam data to get history
      const targetExam = savedExams.find(e => e.title === examTitle);
      if (!targetExam || !targetExam.simulationHistory) return;

      // Extract wrong questions
      const wrongQuestionsMap = new Map<string, Question>();
      
      targetExam.simulationHistory.forEach(sim => {
          sim.userAnswers.forEach(ans => {
              if (!ans.isCorrect) {
                  const originalQuestion = sim.questions.find(q => q.id === ans.questionId);
                  if (originalQuestion) {
                      wrongQuestionsMap.set(originalQuestion.id, originalQuestion);
                  }
              }
          });
      });

      const wrongQuestions = Array.from(wrongQuestionsMap.values());

      if (wrongQuestions.length === 0) {
          alert("Parabéns! Você não possui erros registrados para este concurso.");
          return;
      }

      // Shuffle them slightly
      const shuffled = wrongQuestions.sort(() => Math.random() - 0.5);

      initializeSimulationSession(shuffled, "Revisão de Erros", examTitle);
  };

  const handleResumeSimulation = (sim: SimulationResult) => {
      setActiveSimId(sim.id);
      setActiveSimQuestions(sim.questions);
      setActiveSimInitialAnswers(sim.userAnswers);
      setActiveSimTitle(sim.examTitle);
      setView(ViewState.SIMULATION_ACTIVE);
  };

  const handleSimulationUpdate = (result: SimulationResult) => {
      // Real-time save to history database
      updateSimulationInHistory(result, result.examTitle);
      
      // Real-time save to active session state (this ensures if you reload, the answers are here)
      setActiveSimInitialAnswers(result.userAnswers);
  };

  const handleFinishSimulation = (result: SimulationResult) => {
      updateSimulationInHistory(result, result.examTitle);
      setView(ViewState.SIMULATION_HISTORY);
      
      // Clear active simulation state after finish
      setActiveSimId(null);
      setActiveSimQuestions([]);
      setActiveSimInitialAnswers([]);
      setActiveSimTitle('');
  };

  // --- Past Exams Logic ---
  const handlePastExamSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!pastExamSearch.trim()) return;

      setLoading(true);
      setLoadingMessage(`Procurando arquivos e questões da prova "${pastExamSearch}"...`);
      setFoundPastExam(null);

      try {
          const result = await findPastExamQuestions(pastExamSearch);
          setFoundPastExam(result);
      } catch (err) {
          alert("Não foi possível encontrar essa prova específica. Tente refinar a busca com o ano (ex: 'IBGE 2021').");
      } finally {
          setLoading(false);
      }
  };

  const handleStartPastExam = () => {
      if (!foundPastExam) return;
      // We start a session. We use the exam title found.
      // Note: This exam might not be in "savedExams" yet, but initializeSimulationSession handles history for 'new' titles implicitly if we adapt it or just save it.
      // For simplicity, we create a temporary 'saved' entry if needed, or just let it float in history under that title.
      
      // Check if we need to create a placeholder examData to store this history properly
      const exists = savedExams.find(e => e.title === foundPastExam.title);
      if (!exists) {
          const placeholderExam: ExamData = {
              title: foundPastExam.title,
              organization: foundPastExam.org,
              estimatedVacancies: "N/A",
              registrationPeriod: foundPastExam.year,
              fee: "",
              examDate: foundPastExam.year,
              summary: "Prova anterior importada.",
              previousContestAnalysis: "",
              subjects: [],
              strategies: [],
              simulationHistory: []
          };
          setSavedExams(prev => [...prev, placeholderExam]);
      }

      initializeSimulationSession(
          foundPastExam.questions, 
          `Prova Real: ${foundPastExam.year}`, 
          foundPastExam.title
      );
  };

  // --- Study Logic ---

  const updateExamDataWithContent = (topicName: string, content: string) => {
      if (!examData) return;

      const updatedExam = {
          ...examData,
          cachedContent: {
              ...(examData.cachedContent || {}),
              [topicName]: content
          }
      };

      setExamData(updatedExam);
      
      // Update persistent storage if this exam is saved
      setSavedExams(prev => prev.map(ex => 
        ex.title === examData.title ? updatedExam : ex
      ));
  };

  const handleStudyTopic = async (subjectName: string, topicName: string) => {
    if (!examData) return;

    // 1. Check Cache First
    if (examData.cachedContent && examData.cachedContent[topicName]) {
        setStudyContent({
            subject: subjectName,
            title: topicName,
            content: examData.cachedContent[topicName]
        });
        setView(ViewState.STUDY_CONTENT);
        return;
    }

    // 2. If not found, generate
    setLoading(true);
    setLoadingMessage(`Consultando fontes e criando aula sobre "${topicName}" para a banca ${examData.organization}...`);

    try {
        const content = await generateStudyContent(examData, subjectName, topicName);
        setStudyContent(content);
        
        // Save to cache
        updateExamDataWithContent(topicName, content.content);
        
        setView(ViewState.STUDY_CONTENT);
    } catch (err) {
        alert("Erro ao gerar material de estudo. Tente novamente.");
    } finally {
        setLoading(false);
    }
  };

  const handleExpandContent = async () => {
    if (!studyContent || !examData) return;

    try {
        const extraContent = await expandStudyContent(studyContent.content, examData, studyContent.title);
        
        const newFullContent = studyContent.content + "\n\n" + extraContent;
        
        const updatedStudyContent = {
            ...studyContent,
            content: newFullContent
        };
        
        setStudyContent(updatedStudyContent);
        updateExamDataWithContent(studyContent.title, newFullContent);

    } catch (e) {
        console.error(e);
        throw e; // Let the component handle the alert
    }
  };
  
  const handleAdvancedExplanation = async (): Promise<string> => {
      if (!studyContent) return "Conteúdo não disponível.";
      return await generateStepByStepExplanation(studyContent.title, studyContent.content);
  };

  const handleToggleTopicCompletion = (topicName: string) => {
      if (!examData) return;
      
      const currentCompleted = examData.completedTopics || [];
      let newCompleted;

      if (currentCompleted.includes(topicName)) {
          newCompleted = currentCompleted.filter(t => t !== topicName);
      } else {
          newCompleted = [...currentCompleted, topicName];
      }

      const updatedExam = {
          ...examData,
          completedTopics: newCompleted
      };

      setExamData(updatedExam);
      setSavedExams(prev => prev.map(ex => 
        ex.title === examData.title ? updatedExam : ex
      ));
  };

  const handleAskTutor = async (question: string): Promise<string> => {
      if (!studyContent) return "Contexto de estudo não encontrado.";
      return await askStudyTutor(studyContent.content, question);
  };

  const handleSaveNote = (topicName: string, noteContent: string) => {
      if (!examData) return;

      const updatedNotes = {
          ...(examData.userNotes || {}),
          [topicName]: noteContent
      };

      const updatedExam = {
          ...examData,
          userNotes: updatedNotes
      };

      setExamData(updatedExam);
      setSavedExams(prev => prev.map(ex => 
          ex.title === examData.title ? updatedExam : ex
      ));
  };
  
  // NEW: Save Tutor Interaction
  const handleSaveTutorInteraction = (topicName: string, question: string, answer: string) => {
      if (!examData) return;
      
      const interaction: TutorInteraction = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          question,
          answer
      };
      
      const currentHistory = examData.tutorHistory?.[topicName] || [];
      const updatedHistory = [...currentHistory, interaction];
      
      const updatedExam = {
          ...examData,
          tutorHistory: {
              ...(examData.tutorHistory || {}),
              [topicName]: updatedHistory
          }
      };
      
      setExamData(updatedExam);
      setSavedExams(prev => prev.map(ex => 
          ex.title === examData.title ? updatedExam : ex
      ));
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
          <p className="text-lg font-medium text-slate-700">{loadingMessage}</p>
          <p className="text-sm opacity-75 mt-2 max-w-md text-center">
            Utilizando Google Search para dados atualizados e Flash 2.5 para precisão didática.
          </p>
        </div>
      );
    }

    switch (view) {
      case ViewState.HOME:
        return (
          <div className="flex flex-col items-center justify-center h-[80vh] text-center px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-3xl flex items-center justify-center shadow-2xl mb-8 transform rotate-3">
              <Sparkles className="text-white w-10 h-10" />
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6">
              Sua Aprovação <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">
                Começa Aqui
              </span>
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mb-10 leading-relaxed">
              Digite o concurso (ex: "Polícia Federal 2025"). Nossa IA busca o edital real na internet, 
              analisa taxas, datas e matérias, e cria simulados personalizados instantaneamente.
            </p>
            
            <form onSubmit={handleSearch} className="w-full max-w-lg relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ex: IBGE, Banco do Brasil, PRF..."
                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-200 rounded-xl text-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-sm transition-all"
              />
              <button 
                type="submit"
                className="absolute right-2 top-2 bottom-2 bg-indigo-600 text-white px-6 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                Analisar
              </button>
            </form>
          </div>
        );

      case ViewState.PAST_EXAMS:
          return (
              <div className="animate-fadeIn max-w-2xl mx-auto mt-10">
                   <h2 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
                      <FileText className="text-indigo-600" /> Banco de Provas Reais
                   </h2>
                   <p className="text-slate-600 mb-8">
                       Pesquise por provas anteriores e resolva-as com revisão automática.
                       <br/><span className="text-sm text-slate-400">Ex: "IBGE 2021", "Polícia Federal Agente 2021"</span>
                   </p>

                   <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 mb-8">
                       <form onSubmit={handlePastExamSearch} className="flex gap-2">
                           <input 
                              type="text"
                              value={pastExamSearch}
                              onChange={(e) => setPastExamSearch(e.target.value)}
                              placeholder="Digite o nome do concurso e o ano..."
                              className="flex-1 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                           />
                           <button 
                              type="submit"
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
                           >
                              Buscar
                           </button>
                       </form>
                   </div>

                   {foundPastExam && (
                       <div className="bg-gradient-to-br from-white to-indigo-50 p-8 rounded-xl shadow-lg border border-indigo-100 animate-slideUp">
                           <div className="flex justify-between items-start mb-6">
                               <div>
                                   <div className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide inline-block mb-3">
                                       Prova Encontrada
                                   </div>
                                   <h3 className="text-2xl font-bold text-slate-900 leading-tight">{foundPastExam.title}</h3>
                               </div>
                               <div className="bg-white p-3 rounded-lg shadow-sm text-center min-w-[80px]">
                                   <div className="text-3xl font-bold text-indigo-600">{foundPastExam.questions.length}</div>
                                   <div className="text-[10px] text-slate-500 uppercase font-bold">Questões</div>
                               </div>
                           </div>

                           <div className="grid grid-cols-2 gap-4 mb-8">
                               <div className="flex items-center gap-3 text-slate-700">
                                   <Calendar className="text-slate-400" />
                                   <div>
                                       <p className="text-xs text-slate-400 font-bold uppercase">Ano</p>
                                       <p className="font-semibold">{foundPastExam.year}</p>
                                   </div>
                               </div>
                               <div className="flex items-center gap-3 text-slate-700">
                                   <Briefcase className="text-slate-400" />
                                   <div>
                                       <p className="text-xs text-slate-400 font-bold uppercase">Banca</p>
                                       <p className="font-semibold">{foundPastExam.org}</p>
                                   </div>
                               </div>
                           </div>
                           
                           <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6 text-sm text-yellow-800">
                               <strong>Nota:</strong> As questões foram extraídas e reconstruídas pela IA baseada nos arquivos originais encontrados na web. O sistema adicionou comentários didáticos automaticamente.
                           </div>

                           <button 
                              onClick={handleStartPastExam}
                              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                           >
                               Resolver Prova Agora <ChevronRight size={20} />
                           </button>
                       </div>
                   )}
              </div>
          );

      case ViewState.MY_STUDIES:
        return (
            <div className="animate-fadeIn">
                <h2 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-2">
                    <Bookmark className="text-indigo-600" /> Meus Estudos
                </h2>
                
                {savedExams.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                        <p className="text-slate-500 mb-4">Você ainda não salvou nenhum concurso.</p>
                        <button 
                            onClick={() => setView(ViewState.HOME)}
                            className="text-indigo-600 font-semibold hover:underline"
                        >
                            Pesquisar novos concursos
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {savedExams.map((exam, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => handleOpenSavedExam(exam)}
                                className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group relative"
                            >
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={(e) => handleRemoveSaved(e, exam.title)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                                        title="Remover"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-indigo-700">{exam.title}</h3>
                                <p className="text-sm text-slate-500 mb-4">{exam.organization} • {exam.estimatedVacancies} Vagas</p>
                                
                                {exam.selectedRole && (
                                   <div className="mb-3">
                                     <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                                       Cargo: {exam.selectedRole}
                                     </span>
                                   </div>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    {exam.subjects.slice(0, 3).map((s, i) => (
                                        <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                                            {s.name}
                                        </span>
                                    ))}
                                    {exam.subjects.length > 3 && (
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                                            +{exam.subjects.length - 3}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );

      case ViewState.SIMULATION_HISTORY:
          return (
              <SimulationHistory 
                history={
                    savedExams.flatMap(e => e.simulationHistory || [])
                }
                availableExams={savedExams}
                onResume={handleResumeSimulation}
                onCreateGeneralSim={handleCreateGeneralSimulation}
                onReviewErrors={handleReviewErrors}
              />
          );
      
      case ViewState.PROFILE:
          return (
              <Profile exams={savedExams} />
          );

      case ViewState.GUIDE:
        return examData ? (
          <ExamCard 
            data={examData} 
            sources={examSources}
            isSaved={savedExams.some(e => e.title === examData.title)}
            onToggleSave={handleToggleSave}
            onStartSimulation={prepareSimulation}
            onStudyTopic={handleStudyTopic}
            onRoleSelect={handleRoleSelection}
            onToggleTopicCompletion={handleToggleTopicCompletion}
            isUpdatingRole={isUpdatingRole}
            onGenerateDailyPlan={handleGeneratePlan}
            onTogglePlanSlot={handleTogglePlanSlot}
            onEnhanceSubject={handleEnhanceSubject} // Pass Handler
          />
        ) : null;

      case ViewState.SIMULATION_SETUP:
        return (
          <div className="max-w-xl mx-auto mt-10 animate-fadeIn">
             <button 
              onClick={() => setView(ViewState.GUIDE)}
              className="flex items-center text-slate-500 hover:text-indigo-600 mb-6 transition-colors"
            >
              <ArrowLeft size={20} className="mr-1" /> Voltar ao Guia
            </button>
            
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                  <SlidersHorizontal size={24} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Configurar Simulado</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Foco do Simulado
                  </label>
                  <select
                    value={simConfig.topic}
                    onChange={(e) => setSimConfig({...simConfig, topic: e.target.value})}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                  >
                    <option value="Geral">Geral (Todas as matérias)</option>
                    {examData?.subjects.map((sub, i) => (
                      <option key={i} value={sub.name}>{sub.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Quantidade de Questões
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[5, 10, 15].map(num => (
                      <button
                        key={num}
                        onClick={() => setSimConfig({...simConfig, count: num})}
                        className={`py-3 rounded-lg border-2 font-medium transition-all ${
                          simConfig.count === num 
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                            : 'border-slate-200 hover:border-indigo-200 text-slate-600'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={startSimulation}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-transform active:scale-[0.98]"
                  >
                    Gerar Simulado com IA
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case ViewState.SIMULATION_ACTIVE:
        return activeSimId ? (
          <SimulationRunner 
            simulationId={activeSimId}
            examTitle={activeSimTitle}
            questions={activeSimQuestions} 
            initialAnswers={activeSimInitialAnswers}
            onFinish={handleFinishSimulation}
            onUpdate={handleSimulationUpdate}
            topicContext={simConfig.topic}
          />
        ) : null;
      
      case ViewState.STUDY_CONTENT:
        return studyContent ? (
            <StudyViewer 
                content={studyContent} 
                initialNote={examData?.userNotes?.[studyContent.title] || ''}
                history={examData?.tutorHistory?.[studyContent.title] || []} // PASS HISTORY
                onSaveNote={(note) => handleSaveNote(studyContent.title, note)}
                onSaveInteraction={(question, answer) => handleSaveTutorInteraction(studyContent.title, question, answer)} // SAVE HISTORY
                onBack={() => setView(ViewState.GUIDE)} 
                onAskTutor={handleAskTutor}
                onExpandContent={handleExpandContent}
                onCreateSimulation={handleCustomSimulation}
                onGetAdvancedExplanation={handleAdvancedExplanation}
            />
        ) : null;
        
      default:
        return null;
    }
  };

  return (
    <Layout activeView={view} onNavigate={(v) => {
        if (v === 'HOME') setView(ViewState.HOME);
        if (v === 'MY_STUDIES') setView(ViewState.MY_STUDIES);
        if (v === 'SIMULATION_HISTORY') setView(ViewState.SIMULATION_HISTORY);
        if (v === 'PAST_EXAMS') setView(ViewState.PAST_EXAMS);
        if (v === 'PROFILE') setView(ViewState.PROFILE);
        if (v === 'GUIDE' && examData) setView(ViewState.GUIDE);
    }}>
      {renderContent()}
    </Layout>
  );
};

export default App;
