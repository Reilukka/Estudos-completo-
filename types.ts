
export interface Subject {
  name: string;
  importance: 'Alta' | 'Média' | 'Baixa';
  topics: string[];
  questionCount?: string; // Estimated number of questions
}

export interface ExamStrategy {
  phase: string;
  advice: string;
}

export interface UserAnswer {
  questionId: string;
  selectedOptionIndex: number;
  isCorrect: boolean;
}

export interface SimulationResult {
  id: string;
  examTitle: string; // Link simulation to specific exam
  date: string;
  topic: string; // "Geral" or specific topic name
  score: number;
  totalQuestions: number;
  questions: Question[];
  userAnswers: UserAnswer[];
  status: 'IN_PROGRESS' | 'COMPLETED';
}

export interface TutorInteraction {
  id: string;
  date: string;
  question: string;
  answer: string;
}

// NEW: Daily Planner Types
export interface StudySlot {
  id: string;
  subject: string;
  topic: string;
  activityType: 'TEORIA' | 'REVISAO' | 'QUESTOES' | 'LEI_SECA';
  durationMinutes: number;
  completed: boolean;
  notes?: string;
}

export interface DailyPlan {
  id: string;
  date: string; // ISO Date String (YYYY-MM-DD)
  targetHours: number;
  slots: StudySlot[];
}

export interface ExamData {
  title: string;
  organization: string;
  estimatedVacancies: string;
  registrationPeriod: string;
  fee: string;
  examDate: string;
  summary: string;
  previousContestAnalysis: string; 
  availableRoles?: string[]; 
  selectedRole?: string; 
  subjects: Subject[];
  strategies: ExamStrategy[];
  
  // Persistence fields
  completedTopics?: string[]; 
  cachedContent?: Record<string, string>;
  userNotes?: Record<string, string>; // Personal notes per topic
  tutorHistory?: Record<string, TutorInteraction[]>; // History of tutor Q&A per topic
  simulationHistory?: SimulationResult[]; // History of taken sims
  dailyPlans?: DailyPlan[]; // New: History of plans
}

export interface ExamAnalysisResult {
  data: ExamData;
  sources: { title: string; uri: string }[];
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  topic: string;
}

export interface SimulationConfig {
  questionCount: number;
  specificTopic?: string;
  contextContent?: string; // New: content to base questions on
}

export interface StudyContent {
  subject: string;
  title: string;
  content: string; // Markdown format
}

export enum ViewState {
  HOME = 'HOME',
  GUIDE = 'GUIDE',
  MY_STUDIES = 'MY_STUDIES',
  SIMULATION_SETUP = 'SIMULATION_SETUP',
  SIMULATION_ACTIVE = 'SIMULATION_ACTIVE',
  SIMULATION_HISTORY = 'SIMULATION_HISTORY',
  STUDY_CONTENT = 'STUDY_CONTENT',
  PAST_EXAMS = 'PAST_EXAMS',
  PROFILE = 'PROFILE' // New View
}
