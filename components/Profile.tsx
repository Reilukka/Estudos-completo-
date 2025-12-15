
import React from 'react';
import { ExamData, SimulationResult } from '../types';
import { Trophy, Clock, Target, Award, Star, Activity, CheckCircle2, XCircle, TrendingUp, BarChart3, Zap, Flag, Timer, Crosshair, Crown, GraduationCap } from 'lucide-react';

interface ProfileProps {
  exams: ExamData[];
}

const Profile: React.FC<ProfileProps> = ({ exams }) => {
  // --- Calculation Logic ---

  // 1. Questions & Simulations
  const allSimulations = exams.flatMap(e => e.simulationHistory || []);
  const totalSimulations = allSimulations.length;
  
  let totalQuestions = 0;
  let correctAnswers = 0;
  
  allSimulations.forEach(sim => {
      // Only count completed questions or all answers in the array
      sim.userAnswers.forEach(ans => {
          totalQuestions++;
          if (ans.isCorrect) correctAnswers++;
      });
  });

  const incorrectAnswers = totalQuestions - correctAnswers;
  const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  // 2. Study Hours (Based on Completed Daily Plan Slots)
  const allPlans = exams.flatMap(e => e.dailyPlans || []);
  const completedMinutes = allPlans.flatMap(p => p.slots)
      .filter(s => s.completed)
      .reduce((acc, curr) => acc + curr.durationMinutes, 0);
  
  const totalHours = (completedMinutes / 60).toFixed(1);

  // 3. Topics Mastered
  const completedTopicsCount = exams.reduce((acc, e) => acc + (e.completedTopics?.length || 0), 0);

  // 4. Gamification / Level System
  const xp = (correctAnswers * 10) + (completedMinutes * 2) + (totalSimulations * 50);
  const getLevel = (xp: number) => {
      if (xp < 500) return { level: 1, title: "Iniciante", next: 500 };
      if (xp < 2000) return { level: 2, title: "Estudante Dedicado", next: 2000 };
      if (xp < 5000) return { level: 3, title: "Concurseiro Sênior", next: 5000 };
      if (xp < 10000) return { level: 4, title: "Mestre da Banca", next: 10000 };
      return { level: 5, title: "Aprovado", next: 100000 };
  };
  
  const currentLevel = getLevel(xp);
  const progressToNext = Math.min(100, (xp / currentLevel.next) * 100);

  // --- Components ---

  const StatCard = ({ icon: Icon, label, value, color, subValue }: any) => (
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between">
          <div>
              <p className="text-slate-500 text-sm font-medium mb-1">{label}</p>
              <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
              {subValue && <p className="text-xs text-slate-400 mt-2">{subValue}</p>}
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
              <Icon size={24} />
          </div>
      </div>
  );

  return (
    <div className="animate-fadeIn pb-10">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 rounded-3xl p-8 text-white mb-8 shadow-xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
             
             <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
                 <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center border-4 border-white/20 backdrop-blur-sm">
                     <GraduationCap size={48} className="text-white" />
                 </div>
                 <div className="flex-1 text-center md:text-left">
                     <h2 className="text-3xl font-bold">Concurseiro Focado</h2>
                     <p className="text-indigo-200 mt-1 flex items-center justify-center md:justify-start gap-2">
                        <Award size={16} /> Nível {currentLevel.level}: {currentLevel.title}
                     </p>
                     
                     {/* XP Bar */}
                     <div className="mt-4 max-w-md">
                        <div className="flex justify-between text-xs font-bold text-indigo-300 mb-1">
                            <span>{xp} XP</span>
                            <span>{currentLevel.next} XP</span>
                        </div>
                        <div className="w-full h-3 bg-black/20 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-400 to-green-400 transition-all duration-1000" style={{ width: `${progressToNext}%` }}></div>
                        </div>
                     </div>
                 </div>
                 
                 <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10 text-center min-w-[120px]">
                     <div className="text-2xl font-bold">{totalHours}h</div>
                     <div className="text-xs text-indigo-200 uppercase tracking-wider">Tempo de Estudo</div>
                 </div>
             </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
             <StatCard 
                icon={Target} 
                label="Precisão Global" 
                value={`${accuracy}%`} 
                color="bg-blue-100 text-blue-600"
                subValue={`${correctAnswers} acertos de ${totalQuestions}`}
             />
             <StatCard 
                icon={CheckCircle2} 
                label="Questões Resolvidas" 
                value={totalQuestions} 
                color="bg-emerald-100 text-emerald-600"
                subValue={`+${incorrectAnswers} erros para revisar`}
             />
             <StatCard 
                icon={Trophy} 
                label="Simulados Finalizados" 
                value={totalSimulations} 
                color="bg-amber-100 text-amber-600"
                subValue="Histórico completo"
             />
             <StatCard 
                icon={Zap} 
                label="Tópicos Dominados" 
                value={completedTopicsCount} 
                color="bg-purple-100 text-purple-600"
                subValue="Itens do edital marcados"
             />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Activity */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Activity className="text-indigo-600" /> Atividade Recente
                </h3>
                
                {allSimulations.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <BarChart3 size={48} className="mx-auto mb-2 opacity-50" />
                        <p>Nenhuma atividade registrada ainda.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {allSimulations.slice().reverse().slice(0, 5).map((sim, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors">
                                <div>
                                    <p className="font-bold text-slate-800">{sim.topic}</p>
                                    <p className="text-xs text-slate-500">{new Date(sim.date).toLocaleDateString()} • {sim.examTitle}</p>
                                </div>
                                <div className="text-right">
                                    <div className={`font-bold ${
                                        (sim.score/sim.totalQuestions) >= 0.7 ? 'text-green-600' : 'text-orange-500'
                                    }`}>
                                        {sim.score}/{sim.totalQuestions}
                                    </div>
                                    <div className="text-xs text-slate-400">Acertos</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Achievements / Badges */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                 <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Star className="text-amber-500" /> Conquistas
                </h3>

                <div className="space-y-4">
                    {[
                        { title: "Primeiros Passos", desc: "Completou 1 simulado", achieved: totalSimulations >= 1, Icon: Flag },
                        { title: "Maratonista", desc: "Estudou mais de 10 horas", achieved: parseFloat(totalHours) >= 10, Icon: Timer },
                        { title: "Sniper", desc: "Acertou 100 questões", achieved: correctAnswers >= 100, Icon: Crosshair },
                        { title: "Mestre da Banca", desc: "Alcançou 80% de precisão", achieved: accuracy >= 80 && totalQuestions > 20, Icon: Crown },
                    ].map((badge, idx) => (
                        <div key={idx} className={`flex items-center gap-4 p-3 rounded-xl border ${
                            badge.achieved ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100 opacity-60 grayscale'
                        }`}>
                             <div className="w-10 h-10 rounded-lg bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm">
                                <badge.Icon size={20} className={badge.achieved ? "text-indigo-600" : "text-slate-400"} />
                             </div>
                             <div>
                                 <p className="font-bold text-slate-800 text-sm">{badge.title}</p>
                                 <p className="text-xs text-slate-500">{badge.desc}</p>
                             </div>
                             {badge.achieved && (
                                 <CheckCircle2 size={16} className="text-indigo-600 ml-auto" />
                             )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );
};

export default Profile;
