import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  setCORSHeaders, 
  checkMethod, 
  checkAPIKey,
  withRetry, 
  isRetryableError, 
  parseAPIError,
  logAPI 
} from './_utils';

// Types Affinda pour une meilleure typage
interface AffindaEducation {
  organization?: string;
  accreditation?: { education?: string; inputStr?: string };
  grade?: { value?: string; metric?: string };
  dates?: { startDate?: string; endDate?: string; rawText?: string; isCurrent?: boolean };
  location?: { formatted?: string; city?: string; country?: string };
}

interface AffindaWorkExperience {
  jobTitle?: string;
  organization?: string;
  location?: { formatted?: string; city?: string; country?: string };
  dates?: { startDate?: string; endDate?: string; rawText?: string; monthsInPosition?: number; isCurrent?: boolean };
  jobDescription?: string;
  occupation?: { classification?: { socCode?: string; title?: string; minorGroup?: string } };
}

interface AffindaSkill {
  name?: string;
  type?: string;
  lastUsed?: string;
  numberOfMonths?: number;
  sources?: Array<{ section?: string; position?: number }>;
}

interface AffindaLanguage {
  language?: string;
  level?: string;
}

interface AffindaCertification {
  title?: string;
  dates?: { completionDate?: string };
}

interface AffindaResponse {
  data?: {
    name?: { raw?: string; first?: string; last?: string; middle?: string; title?: string };
    phoneNumbers?: Array<{ rawText?: string; formattedNumber?: string; type?: string }>;
    emails?: string[];
    location?: { 
      formatted?: string; 
      city?: string; 
      state?: string; 
      country?: string; 
      postalCode?: string; 
      rawInput?: string;
      streetNumber?: string;
      street?: string;
    };
    dateOfBirth?: string;
    linkedin?: string;
    websites?: string[];
    github?: string;
    profession?: string;
    summary?: string;
    objective?: string;
    totalYearsExperience?: number;
    headShot?: { data?: string };
    education?: AffindaEducation[];
    workExperience?: AffindaWorkExperience[];
    skills?: AffindaSkill[];
    languages?: AffindaLanguage[];
    certifications?: AffindaCertification[];
    publications?: string[];
    referees?: Array<{ name?: string; text?: string; email?: string; number?: string }>;
    sections?: Array<{ sectionType?: string; text?: string; bbox?: number[] }>;
    rawText?: string;
    isResumeProbability?: number;
  };
  meta?: {
    identifier?: string;
    fileName?: string;
    ready?: boolean;
    failed?: boolean;
    expiryTime?: string;
  };
  error?: {
    errorCode?: string;
    errorDetail?: string;
  };
}

interface ExtractedField {
  tag: string;
  name: string;
  value: string;
  confidence: number;
  isNew: boolean;
  suggestedType: string;
  source: string;
  category?: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  setCORSHeaders(res);
  if (!checkMethod(req, res, ['POST'])) return;

  const startTime = Date.now();

  try {
    const { fileBase64, fileName, fileUrl, textContent } = req.body;

    if (!fileBase64 && !fileUrl && !textContent) {
      return res.status(400).json({ 
        success: false,
        error: { code: 'INVALID_INPUT', message: 'File (base64), file URL, or text content is required' }
      });
    }

    const affindaApiKey = process.env.AFFINDA_API_KEY;
    if (!checkAPIKey(affindaApiKey, 'AFFINDA', res)) return;

    logAPI('affinda', 'Starting CV parsing', { 
      hasFile: !!fileBase64, 
      hasUrl: !!fileUrl,
      hasText: !!textContent,
      fileName 
    });

    // Préparer la requête vers Affinda API v3
    const formData = new FormData();
    
    if (fileBase64) {
      const base64Data = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
      const binaryData = Buffer.from(base64Data, 'base64');
      const mimeType = fileBase64.includes('application/pdf') ? 'application/pdf' : 
                       fileBase64.includes('image/') ? 'image/png' : 'application/pdf';
      const blob = new Blob([binaryData], { type: mimeType });
      formData.append('file', blob, fileName || 'cv.pdf');
    } else if (fileUrl) {
      formData.append('url', fileUrl);
    } else if (textContent) {
      const blob = new Blob([textContent], { type: 'text/plain' });
      formData.append('file', blob, 'cv.txt');
    }

    formData.append('wait', 'true');

    // Appel à l'API Affinda avec retry
    const { result: affindaData, error: apiError, retryCount } = await withRetry(
      async () => {
        const response = await fetch('https://api.affinda.com/v3/documents', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${affindaApiKey}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`Affinda API error: ${response.status} - ${errorText}`);
          (error as any).status = response.status;
          throw error;
        }

        return response.json() as Promise<AffindaResponse>;
      },
      { maxRetries: 2, baseDelayMs: 1000 },
      (error) => isRetryableError(error, 'affinda')
    );

    if (apiError || !affindaData) {
      const parsedError = parseAPIError(apiError, 'affinda');
      logAPI('affinda', 'Parsing failed', { error: parsedError, retryCount });
      
      return res.status(200).json({
        success: false,
        error: parsedError,
        extractedData: []
      });
    }

    if (affindaData.error) {
      return res.status(200).json({
        success: false,
        error: {
          code: 'PARSING_ERROR',
          message: affindaData.error.errorDetail || 'Erreur lors du parsing',
          provider: 'affinda'
        },
        extractedData: []
      });
    }

    // Mapper les données Affinda vers notre format enrichi
    const extractedData = mapAffindaToFields(affindaData);
    const summary = generateSummary(affindaData);
    const duration = Date.now() - startTime;

    logAPI('affinda', 'Parsing completed', { 
      fieldsExtracted: extractedData.length,
      duration,
      retryCount,
      isResumeProbability: affindaData.data?.isResumeProbability
    });

    return res.status(200).json({
      success: true,
      extractedData,
      rawData: affindaData.data,
      summary,
      isResumeProbability: affindaData.data?.isResumeProbability,
      metrics: {
        duration,
        retryCount,
        totalExperiences: affindaData.data?.workExperience?.length || 0,
        totalEducation: affindaData.data?.education?.length || 0,
        totalSkills: affindaData.data?.skills?.length || 0
      }
    });

  } catch (error: any) {
    const parsedError = parseAPIError(error, 'affinda');
    logAPI('affinda', 'Parsing error', { error: parsedError });
    
    return res.status(500).json({
      success: false,
      error: parsedError,
      extractedData: []
    });
  }
}

/**
 * Mapping amélioré des données Affinda vers nos champs
 */
function mapAffindaToFields(response: AffindaResponse): ExtractedField[] {
  const data = response.data;
  if (!data) return [];

  const fields: ExtractedField[] = [];

  // Helper pour ajouter un champ avec validation
  const addField = (
    tag: string, 
    name: string, 
    value: string | undefined | null, 
    type: string = 'text', 
    confidence: number = 0.9,
    category?: string
  ) => {
    if (value && value.trim()) {
      fields.push({
        tag,
        name,
        value: value.trim(),
        confidence: Math.min(1, Math.max(0, confidence)),
        isNew: false,
        suggestedType: type,
        source: 'affinda',
        category
      });
    }
  };

  // ============ IDENTITÉ ============
  if (data.name) {
    if (data.name.first) addField('PRENOM', 'Prénom', data.name.first, 'text', 0.95, 'identity');
    if (data.name.last) addField('NOM', 'Nom', data.name.last, 'text', 0.95, 'identity');
    if (data.name.title) addField('Civilite', 'Civilité', data.name.title, 'text', 0.9, 'identity');
    
    // Si pas de prénom/nom séparés mais nom complet
    if (data.name.raw && !data.name.first && !data.name.last) {
      const nameParts = data.name.raw.split(' ').filter(p => p.trim());
      if (nameParts.length >= 2) {
        addField('PRENOM', 'Prénom', nameParts[0], 'text', 0.8, 'identity');
        addField('NOM', 'Nom', nameParts.slice(1).join(' '), 'text', 0.8, 'identity');
      } else if (nameParts.length === 1) {
        addField('NOM', 'Nom', nameParts[0], 'text', 0.7, 'identity');
      }
    }
  }
  
  addField('DateDeNaissance', 'Date de naissance', data.dateOfBirth, 'date', 0.9, 'identity');

  // ============ CONTACT ============
  if (data.emails && data.emails.length > 0) {
    addField('Mail', 'Email', data.emails[0], 'email', 0.95, 'contact');
    if (data.emails.length > 1) {
      addField('MailSecondaire', 'Email secondaire', data.emails[1], 'email', 0.9, 'contact');
    }
  }
  
  if (data.phoneNumbers && data.phoneNumbers.length > 0) {
    const mainPhone = data.phoneNumbers[0];
    addField('Telephone', 'Téléphone', mainPhone.formattedNumber || mainPhone.rawText, 'phone', 0.95, 'contact');
    if (data.phoneNumbers.length > 1) {
      const secondPhone = data.phoneNumbers[1];
      addField('TelephoneSecondaire', 'Téléphone secondaire', secondPhone.formattedNumber || secondPhone.rawText, 'phone', 0.9, 'contact');
    }
  }

  // Localisation détaillée
  if (data.location) {
    if (data.location.street || data.location.streetNumber) {
      const adresse = [data.location.streetNumber, data.location.street].filter(Boolean).join(' ');
      addField('adresse01', 'Adresse ligne 1', adresse, 'text', 0.9, 'contact');
    }
    addField('CodePostal', 'Code postal', data.location.postalCode, 'text', 0.9, 'contact');
    addField('Ville', 'Ville', data.location.city, 'text', 0.95, 'contact');
    addField('Region', 'Région', data.location.state, 'text', 0.85, 'contact');
    addField('Pays', 'Pays', data.location.country, 'text', 0.9, 'contact');
    
    if (data.location.formatted && !data.location.street) {
      addField('AdresseComplete', 'Adresse complète', data.location.formatted, 'text', 0.85, 'contact');
    }
  }

  // Réseaux sociaux et web
  addField('LinkedIn', 'LinkedIn', data.linkedin, 'url', 0.95, 'contact');
  addField('GitHub', 'GitHub', data.github, 'url', 0.95, 'contact');
  if (data.websites && data.websites.length > 0) {
    addField('SiteWeb', 'Site web', data.websites[0], 'url', 0.9, 'contact');
  }

  // ============ OBJECTIF / PROFESSION ============
  addField('POSTERECHERCHE', 'Poste recherché', data.profession, 'text', 0.9, 'objective');
  addField('AUTRESINTITULESDUPOSTE', 'Autres intitulés du poste', data.objective, 'textarea', 0.85, 'objective');

  // ============ RÉSUMÉ ============
  addField('resumegeneral', 'Résumé général', data.summary, 'textarea', 0.9, 'summary');

  // ============ COMPÉTENCES ============
  if (data.skills && data.skills.length > 0) {
    // Séparer les compétences techniques des soft skills
    const techSkills = data.skills.filter(s => 
      s.type === 'hard_skill' || s.type === 'technical' || 
      !s.type // Par défaut, considérer comme technique
    );
    const softSkills = data.skills.filter(s => s.type === 'soft_skill');
    
    // Compétences clés (top 8)
    techSkills.slice(0, 8).forEach((skill, index) => {
      const num = String(index + 1).padStart(2, '0');
      const confidence = skill.numberOfMonths 
        ? Math.min(0.95, 0.7 + (skill.numberOfMonths / 120) * 0.25) 
        : 0.85;
      addField(`CompetenceClef${num}`, `Compétence clé ${index + 1}`, skill.name, 'text', confidence, 'skills');
    });

    // Compétences comportementales
    softSkills.slice(0, 4).forEach((skill, index) => {
      const num = String(index + 1).padStart(2, '0');
      addField(`SoftSkill${num}`, `Soft skill ${index + 1}`, skill.name, 'text', 0.8, 'skills');
    });
  }

  // ============ LANGUES ============
  if (data.languages && data.languages.length > 0) {
    data.languages.slice(0, 5).forEach((lang, index) => {
      const num = String(index + 1).padStart(2, '0');
      addField(`Langue${num}`, `Langue ${index + 1}`, lang.language, 'text', 0.95, 'languages');
      if (lang.level) {
        addField(`NiveauLangue${num}`, `Niveau langue ${index + 1}`, lang.level, 'text', 0.9, 'languages');
      }
    });
  }

  // ============ FORMATIONS ============
  if (data.education && data.education.length > 0) {
    data.education.slice(0, 6).forEach((edu, index) => {
      const num = String(index + 1).padStart(2, '0');
      
      // Formation complète
      const formationParts = [
        edu.dates?.rawText,
        edu.accreditation?.inputStr || edu.accreditation?.education,
        edu.organization,
        edu.location?.formatted || edu.location?.city
      ].filter(Boolean);
      
      addField(`FormationInitiale${num}`, `Formation initiale ${index + 1}`, formationParts.join(' - '), 'textarea', 0.9, 'education');
      
      // Détails séparés si disponibles
      if (edu.accreditation?.education) {
        addField(`Diplome${num}`, `Diplôme ${index + 1}`, edu.accreditation.education, 'text', 0.9, 'education');
      }
      if (edu.organization) {
        addField(`EcoleFormation${num}`, `École/Formation ${index + 1}`, edu.organization, 'text', 0.9, 'education');
      }
      if (edu.dates?.rawText) {
        addField(`PeriodeFormation${num}`, `Période formation ${index + 1}`, edu.dates.rawText, 'text', 0.85, 'education');
      }
    });
  }

  // ============ EXPÉRIENCES PROFESSIONNELLES ============
  if (data.workExperience && data.workExperience.length > 0) {
    // Expériences significatives (résumé)
    data.workExperience.slice(0, 10).forEach((exp, index) => {
      const num = String(index + 1).padStart(2, '0');
      const expSummary = [
        exp.dates?.rawText,
        exp.jobTitle,
        exp.organization
      ].filter(Boolean).join(' - ');
      
      addField(`ExperienceSignificative${num}`, `Expérience significative ${index + 1}`, expSummary, 'textarea', 0.9, 'experience');
    });

    // Détails complets des expériences (XP01 à XP30)
    data.workExperience.slice(0, 30).forEach((exp, index) => {
      const num = String(index + 1).padStart(2, '0');
      const isCurrent = exp.dates?.isCurrent;
      const confidence = isCurrent ? 0.95 : 0.9;
      
      // Période
      addField(`XP${num}Periode`, `XP${num} - Période`, exp.dates?.rawText, 'text', confidence, 'experience');
      
      // Durée calculée
      if (exp.dates?.monthsInPosition) {
        const years = Math.floor(exp.dates.monthsInPosition / 12);
        const months = exp.dates.monthsInPosition % 12;
        const duration = years > 0 
          ? `${years} an${years > 1 ? 's' : ''}${months > 0 ? ` ${months} mois` : ''}`
          : `${months} mois`;
        addField(`XP${num}Duree`, `XP${num} - Durée`, duration, 'text', 0.95, 'experience');
      }
      
      // Entreprise et contexte
      addField(`XP${num}ENTREPRISE`, `XP${num} - Entreprise`, exp.organization, 'text', confidence, 'experience');
      
      if (exp.occupation?.classification) {
        addField(`XP${num}SecteurEntreprise`, `XP${num} - Secteur entreprise`, 
          exp.occupation.classification.minorGroup || exp.occupation.classification.title, 
          'text', 0.85, 'experience');
      }
      
      // Poste
      addField(`XP${num}POSTE`, `XP${num} - Poste`, exp.jobTitle, 'text', confidence, 'experience');
      
      // Version abrégée du poste
      if (exp.jobTitle && exp.jobTitle.length > 30) {
        const shortTitle = exp.jobTitle.split(/[-–,]/)[0].trim();
        addField(`XP${num}PosteAbrege`, `XP${num} - Poste abrégé`, shortTitle, 'text', 0.8, 'experience');
      } else {
        addField(`XP${num}PosteAbrege`, `XP${num} - Poste abrégé`, exp.jobTitle, 'text', confidence, 'experience');
      }
      
      // Mission/Description
      addField(`XP${num}Mission`, `XP${num} - Mission`, exp.jobDescription, 'textarea', 0.9, 'experience');
      
      // Localisation
      if (exp.location?.formatted || exp.location?.city) {
        addField(`XP${num}Localisation`, `XP${num} - Localisation`, 
          exp.location.formatted || exp.location.city, 
          'text', 0.85, 'experience');
      }
    });

    // Années d'expérience totales
    if (data.totalYearsExperience) {
      addField('AnneesExperienceTotal', 'Années d\'expérience totales', 
        `${data.totalYearsExperience} ans`, 'text', 0.9, 'experience');
    }

    // Secteurs d'activité uniques
    const sectors = new Set<string>();
    data.workExperience.forEach(exp => {
      if (exp.occupation?.classification?.minorGroup) {
        sectors.add(exp.occupation.classification.minorGroup);
      } else if (exp.occupation?.classification?.title) {
        sectors.add(exp.occupation.classification.title);
      }
    });
    Array.from(sectors).slice(0, 8).forEach((sector, index) => {
      const num = String(index + 1).padStart(2, '0');
      addField(`SecteurActivite${num}`, `Secteur d'activité ${index + 1}`, sector, 'text', 0.8, 'experience');
    });
  }

  // ============ CERTIFICATIONS ============
  if (data.certifications && data.certifications.length > 0) {
    data.certifications.slice(0, 8).forEach((cert, index) => {
      const num = String(index + 1).padStart(2, '0');
      const certText = cert.dates?.completionDate 
        ? `${cert.title} (${cert.dates.completionDate})`
        : cert.title;
      addField(`Certification${num}`, `Certification ${index + 1}`, certText, 'text', 0.9, 'certifications');
    });
  }

  // ============ PUBLICATIONS ============
  if (data.publications && data.publications.length > 0) {
    data.publications.slice(0, 5).forEach((pub, index) => {
      addField(`Publication${String(index + 1).padStart(2, '0')}`, `Publication ${index + 1}`, pub, 'textarea', 0.85, 'other');
    });
  }

  // ============ RÉFÉRENCES ============
  if (data.referees && data.referees.length > 0) {
    data.referees.slice(0, 3).forEach((ref, index) => {
      const num = String(index + 1).padStart(2, '0');
      const refText = [ref.name, ref.text, ref.email, ref.number].filter(Boolean).join(' - ');
      addField(`Reference${num}`, `Référence ${index + 1}`, refText, 'textarea', 0.8, 'other');
    });
  }

  return fields;
}

/**
 * Génère un résumé structuré des données extraites
 */
function generateSummary(response: AffindaResponse): string {
  const data = response.data;
  if (!data) return 'Aucune donnée extraite';

  const parts: string[] = [];
  
  // Nom complet
  if (data.name?.raw || (data.name?.first && data.name?.last)) {
    parts.push(`👤 ${data.name.raw || `${data.name.first} ${data.name.last}`}`);
  }
  
  // Profession
  if (data.profession) {
    parts.push(`💼 ${data.profession}`);
  }
  
  // Expérience totale
  if (data.totalYearsExperience) {
    parts.push(`📅 ${data.totalYearsExperience} ans d'expérience`);
  }
  
  // Statistiques
  const stats: string[] = [];
  if (data.workExperience?.length) {
    stats.push(`${data.workExperience.length} expérience${data.workExperience.length > 1 ? 's' : ''}`);
  }
  if (data.education?.length) {
    stats.push(`${data.education.length} formation${data.education.length > 1 ? 's' : ''}`);
  }
  if (data.skills?.length) {
    stats.push(`${data.skills.length} compétence${data.skills.length > 1 ? 's' : ''}`);
  }
  if (data.languages?.length) {
    stats.push(`${data.languages.length} langue${data.languages.length > 1 ? 's' : ''}`);
  }
  if (data.certifications?.length) {
    stats.push(`${data.certifications.length} certification${data.certifications.length > 1 ? 's' : ''}`);
  }
  
  if (stats.length > 0) {
    parts.push(`📊 ${stats.join(' | ')}`);
  }

  // Probabilité CV
  if (data.isResumeProbability !== undefined) {
    const prob = Math.round(data.isResumeProbability * 100);
    parts.push(`🎯 Confiance: ${prob}%`);
  }

  return parts.join('\n');
}
