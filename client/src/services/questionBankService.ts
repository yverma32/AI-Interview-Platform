import api from './api';

export interface GeneratedQuestion {
  id: number;
  question: string;
  difficulty: string;
  topic: string;
}

export interface QuestionAnswer {
  id: number;
  answer: string;
  keyPoints: string | null;
  tips: string | null;
}

export const questionBankService = {
  async generateQuestions(technology: string, topic?: string, count = 10): Promise<GeneratedQuestion[]> {
    const { data } = await api.post<GeneratedQuestion[]>('/questionbank/generate', {
      technology,
      topic: topic || undefined,
      count,
    });
    return data;
  },

  async getBatchAnswers(technology: string, questions: { id: number; question: string }[]): Promise<QuestionAnswer[]> {
    const { data } = await api.post<QuestionAnswer[]>('/questionbank/answers', {
      technology,
      questions,
    });
    return data;
  },
};
