
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ExamData, Question, ExamAnalysisResult, StudyContent, Subject, DailyPlan, StudySlot } from "../types";

// Models
const SEARCH_MODEL = 'gemini-2.5-flash'; 
const SIMULATION_MODEL = 'gemini-flash-lite-latest'; 
const PRECISION_MODEL = 'gemini-2.5-flash'; // Used for High Quality Simulations

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const questionSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      text: { type: Type.STRING, description: "The question stem" },
      options: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "Exactly 5 options (A, B, C, D, E)"
      },
      correctOptionIndex: { type: Type.INTEGER, description: "0-based index of correct option" },
      explanation: { type: Type.STRING, description: "Brief explanation of the answer" },
      topic: { type: Type.STRING, description: "The specific topic this question covers" }
    },
    required: ["id", "text", "options", "correctOptionIndex", "explanation", "topic"]
  }
};

const planSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    slots: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          subject: { type: Type.STRING },
          topic: { type: Type.STRING },
          activityType: { type: Type.STRING, enum: ['TEORIA', 'REVISAO', 'QUESTOES', 'LEI_SECA'] },
          durationMinutes: { type: Type.INTEGER },
          notes: { type: Type.STRING, description: "Brief advice for this slot" }
        },
        required: ["subject", "topic", "activityType", "durationMinutes"]
      }
    }
  }
};

export const analyzeExam = async (examName: string): Promise<ExamAnalysisResult> => {
  try {
    const prompt = `
      ATUAÇÃO: Auditor Especialista em Editais de Concursos Públicos.
      TAREFA: Analisar com PRECISÃO TÉCNICA o concurso: "${examName}".
      
      INSTRUÇÕES DE PESQUISA:
      1. Localize o EDITAL MAIS RECENTE ou o EDITAL ANTERIOR se o atual não saiu.
      2. Identifique a BANCA EXAMINADORA correta.
      3. Liste os CARGOS com exatidão.
      
      SAÍDA JSON OBRIGATÓRIA:
      {
        "title": "Nome Oficial Completo",
        "organization": "Banca (ex: Cebraspe, FGV)",
        "estimatedVacancies": "Total de vagas",
        "registrationPeriod": "Datas ou 'A definir'",
        "fee": "Valor ou 'A definir'",
        "examDate": "Data ou 'A definir'",
        "summary": "Resumo executivo sobre o concurso e oportunidades.",
        "previousContestAnalysis": "Análise técnica: Mudanças no estilo da banca, matérias novas introduzidas e nível de dificuldade esperado.",
        "availableRoles": ["Cargo 1", "Cargo 2", "Cargo 3"],
        "subjects": [
          {
            "name": "Nome da Matéria (Conhecimentos Básicos)",
            "importance": "Alta" | "Média",
            "topics": ["Tópico Principal 1", "Tópico Principal 2"],
            "questionCount": "Estimativa"
          }
        ],
        "strategies": [
          { "phase": "Pré-Edital", "advice": "Dica estratégica" },
          { "phase": "Pós-Edital", "advice": "Dica de reta final" }
        ]
      }
    `;

    const response = await ai.models.generateContent({
      model: SEARCH_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2, 
      },
    });

    let jsonString = response.text || "";
    // Clean markdown code blocks if present
    jsonString = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();
    
    // Fallback: Try to find JSON object if text surrounds it
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    }
    
    let parsedData: ExamData;
    try {
      parsedData = JSON.parse(jsonString);
    } catch (e) {
      console.error("Failed to parse JSON from search result", jsonString);
      throw new Error("Não foi possível processar os dados do concurso. Tente novamente.");
    }

    const sources: { title: string; uri: string }[] = [];
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      response.candidates[0].groundingMetadata.groundingChunks.forEach((chunk) => {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title || "Fonte Web",
            uri: chunk.web.uri || "#"
          });
        }
      });
    }

    return {
      data: parsedData,
      sources: sources
    };

  } catch (error) {
    console.error("Erro ao analisar concurso:", error);
    throw error;
  }
};

export const getSubjectsForRole = async (
  examTitle: string,
  organization: string,
  role: string
): Promise<Subject[]> => {
  try {
    // STEP 1: Research Phase (Get Raw Content via Search)
    const researchPrompt = `
      ATUAÇÃO: Especialista Técnico em Mapeamento de Editais.
      
      CONTEXTO:
      - Concurso: "${examTitle}"
      - Banca: "${organization}"
      - CARGO ALVO: "${role}"

      MISSÃO:
      Pesquise e retorne o "Conteúdo Programático" (Syllabus) COMPLETO e DETALHADO para este cargo específico.
      Copie os tópicos de cada matéria conforme o edital.
      
      IMPORTANTE:
      - Identifique se é Nível Médio ou Superior.
      - Liste todas as matérias e seus tópicos internos.
      - Não formate em JSON ainda, apenas traga o texto estruturado e legível.
    `;

    const researchResponse = await ai.models.generateContent({
      model: SEARCH_MODEL,
      contents: researchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
      },
    });

    const rawContent = researchResponse.text || "";

    // STEP 2: Structuring Phase (Convert to JSON using Schema)
    const structurePrompt = `
      Você é um formatador de dados estrito.
      
      Transforme o texto abaixo (Conteúdo Programático de Concurso) em um JSON Array estruturado.
      
      TEXTO BASE:
      """
      ${rawContent.substring(0, 50000)}
      """
      
      REGRAS:
      1. Extraia cada disciplina como um objeto.
      2. 'importance': Estime 'Alta', 'Média' ou 'Baixa' com base na relevância típica para o cargo ${role}.
      3. 'topics': Lista de strings com os tópicos detalhados.
      4. 'questionCount': Estimativa numérica (ex: "10 questões").
    `;

    const subjectsSchema: Schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          importance: { type: Type.STRING, enum: ["Alta", "Média", "Baixa"] },
          topics: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          },
          questionCount: { type: Type.STRING }
        },
        required: ["name", "importance", "topics"]
      }
    };

    const structureResponse = await ai.models.generateContent({
      model: SEARCH_MODEL, // Using same model but without search tool for formatting
      contents: structurePrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: subjectsSchema,
        temperature: 0.1,
      },
    });

    const jsonString = structureResponse.text || "[]";
    return JSON.parse(jsonString) as Subject[];

  } catch (error) {
    console.error("Erro ao buscar matérias do cargo:", error);
    throw new Error("Não foi possível carregar as matérias. Tente novamente.");
  }
};

// NEW FUNCTION: Search for missing topics
export const enhanceSubjectTopics = async (
  examData: ExamData,
  subjectName: string,
  currentTopics: string[]
): Promise<string[]> => {
  try {
    const roleContext = examData.selectedRole ? `Cargo: ${examData.selectedRole}` : "";
    
    const prompt = `
      ATUE COMO UM "CAÇADOR DE TÓPICOS" EM EDITAIS.
      
      CONTEXTO:
      - Concurso: ${examData.title}
      - Banca: ${examData.organization}
      - ${roleContext}
      - Disciplina Alvo: "${subjectName}"
      
      LISTA ATUAL DE TÓPICOS QUE JÁ TEMOS:
      ${JSON.stringify(currentTopics)}
      
      SUA MISSÃO:
      1. Pesquise no edital oficial O QUE ESTÁ FALTANDO nesta lista para a matéria de "${subjectName}".
      2. Encontre tópicos específicos, leis ou subtemas que foram esquecidos na primeira análise.
      3. Se a lista atual já estiver perfeita e completa, retorne um array vazio.
      4. NÃO retorne tópicos que já estão na lista (evite duplicatas).
      
      SAÍDA OBRIGATÓRIA:
      Retorne APENAS um JSON Array de strings cru (ex: ["Topico X", "Topico Y"]).
      NÃO use Markdown (sem \`\`\`json).
    `;

    const response = await ai.models.generateContent({
      model: SEARCH_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        // responseMimeType: "application/json", // REMOVED CAUSE ERROR WITH TOOLS
        temperature: 0.2,
      },
    });

    let jsonString = response.text || "[]";
    // Manual cleanup
    jsonString = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();
    
    // Find array brackets if surrounded by text
    const firstBracket = jsonString.indexOf('[');
    const lastBracket = jsonString.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket !== -1) {
        jsonString = jsonString.substring(firstBracket, lastBracket + 1);
    }

    try {
        return JSON.parse(jsonString) as string[];
    } catch (e) {
        console.error("Failed to parse JSON for enhanced topics", jsonString);
        return [];
    }

  } catch (error) {
    console.error("Erro ao refinar tópicos:", error);
    throw new Error("Não foi possível buscar novos tópicos.");
  }
};

export const getExamBlueprint = async (
    examTitle: string,
    organization: string,
    role: string,
    totalQuestions: number
): Promise<string> => {
    try {
        const prompt = `
            Você é o Coordenador Pedagógico do concurso "${examTitle}" para o cargo de "${role}".
            
            PESQUISE AGORA:
            1. O último edital ou o edital atual para este cargo específico.
            2. A estrutura EXATA da prova (Quantas questões de Português? Quantas de Direito? Quantas de Conhecimentos Específicos?).
            3. O estilo da banca "${organization}" nas provas recentes para este cargo (Ex: Cobra mais jurisprudência? Mais gramática normativa?).

            Sua tarefa é criar um "BLUEPRINT" (Plano de Distribuição) para um simulado de ${totalQuestions} questões que seja IDÊNTICO à prova real.

            SAÍDA OBRIGATÓRIA (Texto Simples):
            Responda APENAS com um resumo estruturado para instruir a IA geradora, no seguinte formato:
            
            "ESTRUTURA DA PROVA:
            - Matéria A: X questões (Foco em: Tópicos recorrentes)
            - Matéria B: Y questões (Foco em: ...)
            ...
            
            ESTILO DA BANCA:
            - Nível de dificuldade: ...
            - Tipo de enunciado: ...
            - Pegadinhas comuns: ..."
        `;

        const response = await ai.models.generateContent({
            model: SEARCH_MODEL,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.2,
            }
        });

        return response.text || "";
    } catch (e) {
        console.error("Erro ao gerar blueprint", e);
        return ""; // Fallback will handle it
    }
};

export const generateSimulation = async (
  examContext: string,
  count: number,
  topic: string = "Geral",
  studyContextContent: string = "",
  allSubjects?: Subject[],
  organization?: string, 
  role?: string, 
  examBlueprint?: string 
): Promise<Question[]> => {
  try {
    let prompt = "";
    let selectedModel = SIMULATION_MODEL; 
    
    const orgContext = organization ? `BANCA OFICIAL: ${organization}` : "Banca Organizadora";
    const roleContext = role ? `CARGO: ${role}` : "Cargo Genérico";

    if (studyContextContent) {
        selectedModel = PRECISION_MODEL; 

        prompt = `
          VOCÊ É A PRÓPRIA BANCA EXAMINADORA ${orgContext}.
          
          OBJETIVO: Elaborar um simulado de ${count} questões para o concurso "${examContext}" (${roleContext}).
          ASSUNTO DA PROVA: ${topic}.
          
          MATERIAL DE BASE (O que o aluno estudou):
          """
          ${studyContextContent.substring(0, 50000)} ...
          """
          
          REGRAS DE OURO PARA ELABORAÇÃO (LEIA COM ATENÇÃO):
          1. **PROIBIDO fazer perguntas sobre o texto acima**. (Ex: "Segundo o texto...", "O autor diz..."). O texto acima serve APENAS para você saber qual é o CONTEÚDO TÉCNICO que deve ser cobrado.
          2. **Crie questões de PROVA REAL**: Aplique o conhecimento do texto em situações novas, casos hipotéticos ou questões teóricas diretas, EXATAMENTE como a ${organization} faria no dia da prova.
          3. **Mimetismo da Banca**: Copie o vocabulário, o tamanho dos enunciados e o estilo das alternativas da ${organization}.
          4. **Interpretação de Texto**: Se o assunto for Interpretação, gere um TEXTO NOVO (curto) ou frase complexa no enunciado para o aluno interpretar, não use o texto de estudo como base da interpretação.
          5. **Dificuldade**: Nível difícil/competitivo.

          Retorne APENAS o JSON array.
        `;
    } else if (topic === "Geral" && allSubjects && allSubjects.length > 0) {
        selectedModel = PRECISION_MODEL; 
        
        const structureInstruction = examBlueprint 
            ? `SIGA ESTRITAMENTE ESTA DISTRIBUIÇÃO E ESTRUTURA REAL (BLUEPRINT):\n${examBlueprint}`
            : `DISTRIBUA AS QUESTÕES BASEADO NA IMPORTÂNCIA:\n${allSubjects.map(s => `${s.name} (Peso: ${s.importance})`).join("; ")}`;

        prompt = `
          ATENÇÃO: VOCÊ É O EXAMINADOR CHEFE DA ${orgContext}.
          
          Sua missão é criar a PROVA FINAL (Simulado Real) para o concurso: "${examContext}" (${roleContext}).
          
          QUANTIDADE TOTAL: ${count} Questões.
          
          ${structureInstruction}

          DIRETRIZES DE REALISMO EXTREMO:
          1. **Mimetismo da Banca**: Escreva EXATAMENTE como a ${organization} escreve.
             - Se for Cebraspe: Use linguagem técnica, focada em "situação-problema" (mesmo sendo múltipla escolha aqui, adapte o estilo do texto).
             - Se for FGV: Textos longos, interpretação complexa, casos práticos em Direito.
             - Se for Vunesp/FCC: Texto da lei (lei seca) misturado com doutrina consolidada.
          2. **Contexto do Cargo**: As questões devem ser pertinentes ao dia a dia do ${role}.
          3. **Nível de Dificuldade**: A prova deve ser difícil, compatível com a concorrência real. Inclua questões fáceis (10%), médias (50%) e difíceis (40%).
          4. **Pegadinhas**: Use os distratores clássicos desta banca.
          
          FORMATO DE SAÍDA:
          Retorne APENAS o JSON Array.
        `;
    } else {
        prompt = `Crie um simulado de questões inéditas para o concurso: "${examContext}".
        Foco do conteúdo: ${topic}.
        Quantidade de questões: ${count}.
        Estilo da banca: Imite o estilo da banca organizadora comum para este cargo.
        IMPORTANTE: Gere 5 alternativas por questão.
        Retorne apenas o JSON array.`;
    }

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: questionSchema,
        temperature: 0.5,
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as Question[];
    }
    throw new Error("Resposta vazia da IA ao gerar simulado");
  } catch (error) {
    console.error("Erro ao gerar simulado:", error);
    throw error;
  }
};

export const analyzeQuestionError = async (
    question: Question,
    userSelectedOptionLabel: string, 
    examContext: string
): Promise<string> => {
    try {
        const correctOptionLabel = String.fromCharCode(65 + question.correctOptionIndex);
        
        const prompt = `
            ATUE COMO O MELHOR PROFESSOR DE CURSINHO PREPARATÓRIO.
            
            O aluno acabou de responder uma questão do concurso "${examContext}" e precisa de uma análise profunda.
            
            A QUESTÃO:
            "${question.text}"
            
            ALTERNATIVAS:
            ${question.options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n')}
            
            GABARITO: ${correctOptionLabel}
            ALUNO MARCOU: ${userSelectedOptionLabel}
            
            MISSÃO:
            Gere uma explicação didática e completa em Markdown.
        `;

        const response = await ai.models.generateContent({
            model: PRECISION_MODEL,
            contents: prompt,
            config: {
                temperature: 0.4,
            }
        });

        return response.text || "Não foi possível gerar a análise detalhada.";

    } catch (error) {
        console.error("Erro na análise de questão:", error);
        return "Erro ao analisar a questão.";
    }
};

export const findPastExamQuestions = async (
    searchQuery: string
): Promise<{ questions: Question[], title: string, year: string, org: string }> => {
    try {
        const prompt = `
            Você é um Arquivista de Concursos Públicos.
            O usuário quer encontrar a PROVA REAL (Questões Históricas) com a seguinte busca: "${searchQuery}".
            
            1. PESQUISE NA WEB o conteúdo original desta prova específica (PDFs, sites de questões, gabaritos).
            2. Identifique o Ano e a Banca Organizadora exata.
            3. EXTRAIA ou RECONSTRUA o texto das questões REAIS. 
               - Tente encontrar pelo menos 20 a 30 questões originais.
               - Mantenha o enunciado fiel ao original.
               - Mantenha as alternativas originais.
               - Indique a alternativa correta baseada no gabarito oficial encontrado.
            
            SAÍDA OBRIGATÓRIA:
            Responda APENAS com um objeto JSON válido, sem texto introdutório ou markdown.
            Estrutura:
            {
                "meta": { "title": "Titulo da Prova", "year": "Ano", "org": "Banca" },
                "questions": [
                    {
                        "id": "1",
                        "text": "Enunciado...",
                        "options": ["A", "B", "C", "D", "E"],
                        "correctOptionIndex": 0,
                        "explanation": "Comentário...",
                        "topic": "Assunto"
                    }
                ]
            }
        `;

        const response = await ai.models.generateContent({
            model: SEARCH_MODEL,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.1, 
            },
        });

        let jsonString = response.text || "";
        jsonString = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();

        let result;
        try {
             result = JSON.parse(jsonString);
        } catch (e) {
            console.error("JSON parse error for past exam", jsonString);
            throw new Error("Erro ao processar os dados da prova encontrada.");
        }

        if (!result.questions || result.questions.length === 0) {
            throw new Error("Não foi possível encontrar questões para esta prova.");
        }

        return {
            questions: result.questions,
            title: result.meta?.title || searchQuery,
            year: result.meta?.year || "Ano desconhecido",
            org: result.meta?.org || "Banca desconhecida"
        };

    } catch (error) {
        console.error("Erro ao buscar prova anterior:", error);
        throw error;
    }
};

export const generateStudyContent = async (
  examData: ExamData,
  subjectName: string,
  topicName: string
): Promise<StudyContent> => {
  try {
    const roleContext = examData.selectedRole ? `Cargo Foco: ${examData.selectedRole}` : "";

    const prompt = `
      ATUE COMO O MELHOR PROFESSOR DE CONCURSOS DO BRASIL (Especialista na banca ${examData.organization}).
      
      Sua missão é criar o material de estudo DEFINITIVO e PERFEITO para o tópico: "${topicName}" (${subjectName}).
      
      CONTEXTO RÍGIDO:
      - Concurso: ${examData.title}
      - Banca: ${examData.organization}
      - ${roleContext}
      - Pesquise questões anteriores dessa banca sobre esse assunto para moldar a explicação.

      ESTRUTURA OBRIGATÓRIA DA AULA (MARKDOWN AVANÇADO):
      # ${topicName}
      > **Visão Geral:** O que é isso e por que cai na prova da ${examData.organization}? (Seja direto).
      ## 1. A Mecânica da Regra (Teoria Pura)
      ## 2. Regras de Ouro & Exceções (O que cai de verdade)
      ## 3. Raio-X da Banca ${examData.organization}
      ## 4. Exemplos Práticos Comentados
      ## 5. Resumo para Memorizar (Flashcards)
      
      TOM DE VOZ: Autoritário mas didático.
    `;

    const response = await ai.models.generateContent({
      model: SEARCH_MODEL, 
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.25, 
      },
    });

    if (!response.text) {
      throw new Error("Não foi possível gerar o conteúdo de estudo.");
    }

    return {
      subject: subjectName,
      title: topicName,
      content: response.text
    };

  } catch (error) {
    console.error("Erro ao gerar material de estudo:", error);
    throw error;
  }
};

export const expandStudyContent = async (
  currentContent: string,
  examData: ExamData,
  topicName: string
): Promise<string> => {
  try {
    const prompt = `
      VOCÊ É O PROFESSOR DO CURSO AVANÇADO.
      O aluno já leu o material básico abaixo sobre "${topicName}".
      Agora ele clicou em "MAIS CONTEÚDO" para se aprofundar.
      
      MATERIAL JÁ EXISTENTE: "${currentContent.substring(currentContent.length - 2000)} ..."

      SUA MISSÃO - CRIE UM "APÊNDICE AVANÇADO":
      1. Pesquise nuances mais profundas.
      2. Adicione 2 questões "Nível Hard".
    `;

    const response = await ai.models.generateContent({
      model: SEARCH_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.3,
      },
    });

    return response.text || "";

  } catch (error) {
    console.error("Erro ao expandir conteúdo:", error);
    throw new Error("Não foi possível expandir o conteúdo.");
  }
};

export const askStudyTutor = async (
  currentContent: string,
  userQuestion: string
): Promise<string> => {
  try {
    const prompt = `
      Você é um Professor Particular Gentil e Extremamente Didático.
      CONTEXTO: "${currentContent.substring(0, 3000)}..."
      DÚVIDA: "${userQuestion}"
      Responda de forma clara.
    `;

    const response = await ai.models.generateContent({
      model: SIMULATION_MODEL, 
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });

    return response.text || "Desculpe, não consegui processar sua dúvida agora.";
  } catch (error) {
    console.error("Erro no tutor:", error);
    return "Ocorreu um erro ao consultar o tutor. Tente novamente.";
  }
};

export const generateStepByStepExplanation = async (
    topicName: string,
    currentContent: string
): Promise<string> => {
    try {
        const prompt = `
            ATUE COMO UM "PROFESSOR AVANÇADO".
            Tópico: "${topicName}".
            Missão: Explicar o passo a passo lógico, algoritmo mental de resolução.
        `;

        const response = await ai.models.generateContent({
            model: SIMULATION_MODEL, 
            contents: prompt,
            config: {
                temperature: 0.4,
            },
        });

        return response.text || "Não foi possível gerar a explicação avançada.";
    } catch (error) {
        console.error("Erro no professor avançado:", error);
        throw error;
    }
};

// NEW: Generates a daily study plan based on user hours
export const generateDailyStudyPlan = async (
    examData: ExamData,
    availableHours: number
): Promise<DailyPlan> => {
    try {
        const completedTopics = examData.completedTopics || [];
        const roleContext = examData.selectedRole ? `Focado no cargo: ${examData.selectedRole}` : "";
        
        // Prepare lists for prompt
        const allTopics = examData.subjects.flatMap(s => s.topics.map(t => `${t} (Matéria: ${s.name}, Importância: ${s.importance})`));
        
        const prompt = `
            ATUE COMO UM COACH DE CONCURSOS DE ALTO NÍVEL.
            
            O aluno tem ${availableHours} horas disponíveis HOJE.
            
            MISSÃO: Criar um Plano de Estudos (Cronograma) extremamente eficiente para hoje.
            CONCURSO: ${examData.title} (${roleContext}).
            
            ESTADO ATUAL DO ALUNO:
            - Tópicos já estudados (Candidatos a REVISÃO): ${completedTopics.join(', ') || "Nenhum ainda."}
            - Lista de tópicos do edital (Candidatos a TEORIA): ${allTopics.join('; ')}
            
            REGRA DE OURO DA APROVAÇÃO (Ciclo de Estudo):
            1. **REVISÃO (20% do tempo):** Selecione tópicos que ele JÁ ESTUDOU para revisar. Se não tiver nenhum, ignore.
            2. **TEORIA NOVA (60% do tempo):** Selecione tópicos NOVOS de alta importância que ele AINDA NÃO ESTUDOU. Intercale matérias (ex: Português e depois Direito).
            3. **QUESTÕES (20% do tempo):** Reserve tempo para bateria de exercícios dos temas estudados hoje.
            
            DETALHES TÉCNICOS:
            - Divida o tempo em blocos de 30 a 60 minutos.
            - Seja específico: Diga qual matéria e qual tópico exato estudar em cada bloco.
            - Inclua intervalos curtos se for muitas horas, mas não liste no JSON, ajuste a duração do estudo.
            
            Retorne APENAS o JSON.
        `;

        const response = await ai.models.generateContent({
            model: SEARCH_MODEL, // Using smarter model for planning logic
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: planSchema,
                temperature: 0.4,
            }
        });

        let jsonString = response.text || "";
        jsonString = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();
        
        const parsed = JSON.parse(jsonString);
        
        // Assign UUIDs and defaults
        const slots: StudySlot[] = parsed.slots.map((s: any) => ({
            ...s,
            id: Date.now().toString() + Math.random().toString(),
            completed: false
        }));

        return {
            id: Date.now().toString(),
            date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
            targetHours: availableHours,
            slots: slots
        };

    } catch (error) {
        console.error("Erro ao gerar plano de estudo:", error);
        throw error;
    }
};

// NEW: Tutor specifically for questions
export const askQuestionTutor = async (
  question: Question,
  userQuery: string,
  isAnswered: boolean
): Promise<string> => {
  try {
    const prompt = `
      ATUE COMO UM TUTOR DE ELITE DE CONCURSOS.
      
      O ALUNO ESTÁ RESOLVENDO ESTA QUESTÃO AGORA:
      Enunciado: "${question.text}"
      Alternativas:
      ${question.options.map((opt, i) => `${String.fromCharCode(65 + i)}) ${opt}`).join('\n')}
      Gabarito Correto: ${String.fromCharCode(65 + question.correctOptionIndex)}
      
      STATUS DO ALUNO: ${isAnswered ? "JÁ RESPONDEU A QUESTÃO" : "AINDA NÃO RESPONDEU (ESTÁ COM DÚVIDA)"}
      
      PERGUNTA DO ALUNO:
      "${userQuery}"
      
      SUA MISSÃO:
      1. Se o aluno AINDA NÃO RESPONDEU: **NÃO DÊ A RESPOSTA DIRETA**. Dê dicas, explique o conceito por trás, ajude-o a eliminar alternativas absurdas, mas faça ele pensar. Guie-o até a resposta.
      2. Se o aluno JÁ RESPONDEU: Você pode explicar tudo livremente, confirmar o gabarito e aprofundar a explicação.
      3. Seja breve, direto e didático. Use Markdown.
    `;

    const response = await ai.models.generateContent({
      model: SIMULATION_MODEL, 
      contents: prompt,
      config: {
        temperature: 0.6,
      },
    });

    return response.text || "Não consegui processar sua dúvida sobre a questão.";
  } catch (error) {
    console.error("Erro no tutor de questão:", error);
    return "Erro ao consultar o tutor da questão.";
  }
};
