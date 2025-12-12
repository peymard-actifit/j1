// Types pour les fonctionnalités IA

export interface AIRequest {
  type: 
    | 'analyze_cv' 
    | 'adapt_to_job_offer' 
    | 'optimize_for_ai_parsing'
    | 'suggest_format'
    | 'create_from_example'
    | 'create_business_card'
    | 'create_spontaneous_cv'
    | 'fill_form'
    | 'search_jobs'
    | 'get_advice'
    | 'find_similar_profiles'
    | 'search_profiles'
    | 'request_certification'
    | 'find_projects';
  input: any;
  userId: string;
}

export interface AIResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface JobOffer {
  title: string;
  company: string;
  description: string;
  requirements: string[];
  location?: string;
  url?: string;
}

export interface Advice {
  category: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  actions?: {
    type: 'training' | 'coaching' | 'certification';
    name: string;
    url?: string;
    cost?: number;
  }[];
}








