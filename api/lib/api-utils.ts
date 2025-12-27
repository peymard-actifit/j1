/**
 * Utilitaires communs pour les APIs
 * Gestion des erreurs, retry, rate limiting, et logging
 */

// Types d'erreurs API
export type APIErrorCode = 
  | 'MISSING_API_KEY'
  | 'INVALID_API_KEY'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_INPUT'
  | 'PARSING_ERROR'
  | 'UNKNOWN_ERROR';

export interface APIError {
  code: APIErrorCode;
  message: string;
  details?: string;
  retryable: boolean;
  provider: 'openai' | 'deepl' | 'affinda' | 'documint' | 'internal';
}

export interface APIResult<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  metrics?: {
    duration: number;
    tokensUsed?: number;
    charactersUsed?: number;
    retryCount?: number;
  };
}

// Configuration de retry avec exponential backoff
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

// Fonction de délai
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Calcul du délai avec exponential backoff et jitter
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% de jitter
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

// Fonction de retry générique
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  shouldRetry: (error: any) => boolean = () => true
): Promise<{ result?: T; error?: any; retryCount: number }> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: any;
  
  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      const result = await operation();
      return { result, retryCount: attempt };
    } catch (error: any) {
      lastError = error;
      
      if (attempt < finalConfig.maxRetries && shouldRetry(error)) {
        const delayMs = calculateDelay(attempt, finalConfig);
        console.log(`[RETRY] Attempt ${attempt + 1}/${finalConfig.maxRetries + 1} failed, retrying in ${Math.round(delayMs)}ms...`);
        await delay(delayMs);
      }
    }
  }
  
  return { error: lastError, retryCount: finalConfig.maxRetries };
}

// Déterminer si une erreur est retryable
export function isRetryableError(error: any, provider: string): boolean {
  // Erreurs HTTP retryables
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
  
  if (error?.status && retryableStatusCodes.includes(error.status)) {
    return true;
  }
  
  // Erreurs réseau
  if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT') {
    return true;
  }
  
  // Erreurs spécifiques par provider
  if (provider === 'openai') {
    if (error?.status === 429) return true; // Rate limit
    if (error?.message?.includes('overloaded')) return true;
  }
  
  if (provider === 'deepl') {
    if (error?.status === 429) return true;
    if (error?.status === 529) return true; // Too many requests
  }
  
  return false;
}

// Parser les erreurs API en format unifié
export function parseAPIError(error: any, provider: APIError['provider']): APIError {
  // Erreur de clé API manquante
  if (error?.message?.includes('API key') || error?.status === 401) {
    return {
      code: 'INVALID_API_KEY',
      message: `Clé API ${provider} invalide ou expirée`,
      details: error?.message,
      retryable: false,
      provider,
    };
  }
  
  // Rate limiting
  if (error?.status === 429 || error?.status === 529) {
    return {
      code: 'RATE_LIMITED',
      message: `Limite de requêtes atteinte pour ${provider}`,
      details: error?.message,
      retryable: true,
      provider,
    };
  }
  
  // Quota dépassé
  if (error?.message?.includes('quota') || error?.message?.includes('insufficient')) {
    return {
      code: 'QUOTA_EXCEEDED',
      message: `Quota ${provider} épuisé`,
      details: error?.message,
      retryable: false,
      provider,
    };
  }
  
  // Timeout
  if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
    return {
      code: 'TIMEOUT',
      message: `Délai d'attente dépassé pour ${provider}`,
      details: error?.message,
      retryable: true,
      provider,
    };
  }
  
  // Erreur réseau
  if (error?.code === 'ECONNRESET' || error?.code === 'ENOTFOUND') {
    return {
      code: 'NETWORK_ERROR',
      message: `Erreur réseau avec ${provider}`,
      details: error?.message,
      retryable: true,
      provider,
    };
  }
  
  // Erreur de parsing
  if (error?.message?.includes('JSON') || error?.message?.includes('parse')) {
    return {
      code: 'PARSING_ERROR',
      message: 'Erreur lors du parsing de la réponse',
      details: error?.message,
      retryable: false,
      provider,
    };
  }
  
  // Erreur inconnue
  return {
    code: 'UNKNOWN_ERROR',
    message: error?.message || 'Erreur inconnue',
    details: JSON.stringify(error),
    retryable: false,
    provider,
  };
}

// Nettoyer une réponse JSON (enlever les backticks markdown)
export function cleanJSONResponse(text: string): string {
  let cleaned = text.trim();
  
  // Enlever les backticks markdown
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  
  return cleaned.trim();
}

// Parser une réponse JSON avec fallback
export function safeJSONParse<T>(text: string): { success: boolean; data?: T; error?: string } {
  try {
    const cleaned = cleanJSONResponse(text);
    const data = JSON.parse(cleaned) as T;
    return { success: true, data };
  } catch (e1) {
    // Essayer d'extraire le JSON du texte
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[0]) as T;
        return { success: true, data };
      } catch (e2) {
        return { success: false, error: `JSON parse error: ${e2}` };
      }
    }
    return { success: false, error: `JSON parse error: ${e1}` };
  }
}

// Mesurer le temps d'exécution
export async function withMetrics<T>(
  operation: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await operation();
  const duration = Date.now() - start;
  return { result, duration };
}

// Headers CORS standard
export function setCORSHeaders(res: any): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Vérifier la méthode HTTP
export function checkMethod(req: any, res: any, allowedMethods: string[] = ['POST']): boolean {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return false;
  }
  
  if (!allowedMethods.includes(req.method)) {
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }
  
  return true;
}

// Vérifier une clé API
export function checkAPIKey(key: string | undefined, provider: string, res: any): boolean {
  if (!key) {
    res.status(200).json({
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message: `${provider}_API_KEY non configurée`,
        retryable: false,
        provider: provider.toLowerCase(),
      },
    });
    return false;
  }
  return true;
}

// Logger pour debug
export function logAPI(provider: string, action: string, details?: any): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${provider.toUpperCase()}] ${action}`, details ? JSON.stringify(details) : '');
}

