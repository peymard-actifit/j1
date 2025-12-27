import type { VercelRequest, VercelResponse } from '@vercel/node';

interface AffindaEducation {
  organization?: string;
  accreditation?: { education?: string; inputStr?: string };
  grade?: { value?: string };
  dates?: { startDate?: string; endDate?: string; rawText?: string };
  location?: { formatted?: string };
}

interface AffindaWorkExperience {
  jobTitle?: string;
  organization?: string;
  location?: { formatted?: string };
  dates?: { startDate?: string; endDate?: string; rawText?: string; monthsInPosition?: number };
  jobDescription?: string;
  occupation?: { classification?: { socCode?: string; title?: string } };
}

interface AffindaSkill {
  name?: string;
  type?: string;
  lastUsed?: string;
  numberOfMonths?: number;
}

interface AffindaLanguage {
  language?: string;
  level?: string;
}

interface AffindaResponse {
  data?: {
    name?: { raw?: string; first?: string; last?: string; middle?: string; title?: string };
    phoneNumbers?: Array<{ rawText?: string; formattedNumber?: string }>;
    emails?: string[];
    location?: { formatted?: string; city?: string; state?: string; country?: string; postalCode?: string; rawInput?: string };
    dateOfBirth?: string;
    linkedin?: string;
    websites?: string[];
    profession?: string;
    summary?: string;
    objective?: string;
    totalYearsExperience?: number;
    headShot?: string;
    education?: AffindaEducation[];
    workExperience?: AffindaWorkExperience[];
    skills?: AffindaSkill[];
    languages?: AffindaLanguage[];
    certifications?: string[];
    publications?: string[];
    referees?: Array<{ name?: string; text?: string }>;
    sections?: Array<{ sectionType?: string; text?: string }>;
    rawText?: string;
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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileBase64, fileName, fileUrl, textContent } = req.body;

    if (!fileBase64 && !fileUrl && !textContent) {
      return res.status(400).json({ 
        error: 'File (base64), file URL, or text content is required' 
      });
    }

    // Vérifier si la clé Affinda est configurée
    const affindaApiKey = process.env.AFFINDA_API_KEY;
    
    if (!affindaApiKey) {
      return res.status(200).json({ 
        success: false,
        error: 'AFFINDA_API_KEY non configurée',
        extractedData: []
      });
    }

    // Préparer la requête vers Affinda API v3
    const formData = new FormData();
    
    if (fileBase64) {
      // Convertir base64 en Blob
      const base64Data = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
      const binaryData = Buffer.from(base64Data, 'base64');
      const blob = new Blob([binaryData], { type: 'application/pdf' });
      formData.append('file', blob, fileName || 'cv.pdf');
    } else if (fileUrl) {
      formData.append('url', fileUrl);
    } else if (textContent) {
      // Pour le texte brut, on crée un fichier texte
      const blob = new Blob([textContent], { type: 'text/plain' });
      formData.append('file', blob, 'cv.txt');
    }

    // Spécifier qu'on veut parser un CV (resume)
    formData.append('collection', 'resumes');
    formData.append('wait', 'true'); // Attendre le résultat

    // Appel à l'API Affinda v3
    const affindaResponse = await fetch('https://api.affinda.com/v3/documents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${affindaApiKey}`,
      },
      body: formData,
    });

    if (!affindaResponse.ok) {
      const errorText = await affindaResponse.text();
      console.error('Affinda API error:', affindaResponse.status, errorText);
      return res.status(200).json({
        success: false,
        error: `Erreur Affinda: ${affindaResponse.status} - ${errorText}`,
        extractedData: []
      });
    }

    const affindaData: AffindaResponse = await affindaResponse.json();

    if (affindaData.error) {
      return res.status(200).json({
        success: false,
        error: affindaData.error.errorDetail || 'Erreur lors du parsing',
        extractedData: []
      });
    }

    // Mapper les données Affinda vers notre format
    const extractedData = mapAffindaToFields(affindaData);

    return res.status(200).json({
      success: true,
      extractedData,
      rawData: affindaData.data,
      summary: generateSummary(affindaData),
      confidence: 0.95 // Affinda a généralement une bonne précision
    });

  } catch (error: any) {
    console.error('Error parsing CV with Affinda:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors du parsing du CV',
      extractedData: []
    });
  }
}

function mapAffindaToFields(response: AffindaResponse): Array<{
  tag: string;
  name: string;
  value: string;
  confidence: number;
  isNew: boolean;
  suggestedType: string;
  source: string;
}> {
  const data = response.data;
  if (!data) return [];

  const fields: Array<{
    tag: string;
    name: string;
    value: string;
    confidence: number;
    isNew: boolean;
    suggestedType: string;
    source: string;
  }> = [];

  // Helper pour ajouter un champ
  const addField = (tag: string, name: string, value: string | undefined | null, type: string = 'text', confidence: number = 0.9) => {
    if (value && value.trim()) {
      fields.push({
        tag,
        name,
        value: value.trim(),
        confidence,
        isNew: false,
        suggestedType: type,
        source: 'affinda'
      });
    }
  };

  // Informations personnelles
  if (data.name) {
    addField('PRENOM', 'Prénom', data.name.first);
    addField('NOM', 'Nom', data.name.last);
    if (data.name.raw && !data.name.first && !data.name.last) {
      const nameParts = data.name.raw.split(' ');
      if (nameParts.length >= 2) {
        addField('PRENOM', 'Prénom', nameParts[0]);
        addField('NOM', 'Nom', nameParts.slice(1).join(' '));
      }
    }
  }

  // Contact
  if (data.emails && data.emails.length > 0) {
    addField('Mail', 'Email', data.emails[0]);
  }
  if (data.phoneNumbers && data.phoneNumbers.length > 0) {
    addField('Telephone', 'Téléphone', data.phoneNumbers[0].formattedNumber || data.phoneNumbers[0].rawText);
  }

  // Localisation
  if (data.location) {
    addField('Ville', 'Ville', data.location.city);
    addField('CodePostal', 'Code postal', data.location.postalCode);
    addField('Pays', 'Pays', data.location.country);
    addField('Region', 'Région', data.location.state);
    if (data.location.rawInput) {
      const addressLines = data.location.rawInput.split('\n');
      if (addressLines.length >= 1) addField('adresse01', 'Adresse ligne 1', addressLines[0]);
      if (addressLines.length >= 2) addField('adresse02', 'Adresse ligne 2', addressLines[1]);
    }
  }

  // Date de naissance
  addField('DateDeNaissance', 'Date de naissance', data.dateOfBirth, 'date');

  // Profession / Poste recherché
  addField('POSTERECHERCHE', 'Poste recherché', data.profession);
  addField('AUTRESINTITULESDUPOSTE', 'Autres intitulés du poste', data.objective);

  // Résumé
  addField('resumegeneral', 'Résumé général', data.summary);

  // Compétences (jusqu'à 8)
  if (data.skills && data.skills.length > 0) {
    const topSkills = data.skills.slice(0, 8);
    topSkills.forEach((skill, index) => {
      const num = String(index + 1).padStart(2, '0');
      addField(`CompetenceClef${num}`, `Compétence clé ${index + 1}`, skill.name);
    });
  }

  // Langues
  if (data.languages && data.languages.length > 0) {
    data.languages.slice(0, 3).forEach((lang, index) => {
      const num = String(index + 1).padStart(2, '0');
      addField(`Langue${num}`, `Langue ${index + 1}`, lang.language);
      addField(`NiveauLangue${num}`, `Niveau langue ${index + 1}`, lang.level);
    });
  }

  // Formations (jusqu'à 4)
  if (data.education && data.education.length > 0) {
    data.education.slice(0, 4).forEach((edu, index) => {
      const num = String(index + 1).padStart(2, '0');
      const formationText = [
        edu.dates?.rawText || '',
        edu.accreditation?.inputStr || edu.accreditation?.education || '',
        edu.organization || '',
        edu.location?.formatted || ''
      ].filter(Boolean).join(' - ');
      
      addField(`FormationInitiale${num}`, `Formation initiale ${index + 1}`, formationText);
    });
  }

  // Expériences professionnelles (jusqu'à 30)
  if (data.workExperience && data.workExperience.length > 0) {
    // Extraire les expériences significatives (les 10 premières)
    data.workExperience.slice(0, 10).forEach((exp, index) => {
      const num = String(index + 1).padStart(2, '0');
      const expSummary = [
        exp.dates?.rawText || '',
        exp.jobTitle || '',
        exp.organization || ''
      ].filter(Boolean).join(' - ');
      
      addField(`ExperienceSignificative${num}`, `Expérience significative ${index + 1}`, expSummary);
    });

    // Détail complet des expériences (XP01 à XP30)
    data.workExperience.slice(0, 30).forEach((exp, index) => {
      const num = String(index + 1).padStart(2, '0');
      
      // Période
      addField(`XP${num}Periode`, `XP${num} - Période`, exp.dates?.rawText);
      
      // Durée
      if (exp.dates?.monthsInPosition) {
        const years = Math.floor(exp.dates.monthsInPosition / 12);
        const months = exp.dates.monthsInPosition % 12;
        const duration = years > 0 
          ? `${years} an${years > 1 ? 's' : ''}${months > 0 ? ` ${months} mois` : ''}`
          : `${months} mois`;
        addField(`XP${num}Duree`, `XP${num} - Durée`, duration);
      }
      
      // Entreprise
      addField(`XP${num}ENTREPRISE`, `XP${num} - Entreprise`, exp.organization);
      
      // Secteur (si disponible via occupation)
      if (exp.occupation?.classification?.title) {
        addField(`XP${num}SecteurEntreprise`, `XP${num} - Secteur entreprise`, exp.occupation.classification.title);
      }
      
      // Poste
      addField(`XP${num}POSTE`, `XP${num} - Poste`, exp.jobTitle);
      addField(`XP${num}PosteAbrege`, `XP${num} - Poste abrégé`, exp.jobTitle);
      
      // Mission/Description
      addField(`XP${num}Mission`, `XP${num} - Mission`, exp.jobDescription);
      
      // Contexte (utiliser la localisation si disponible)
      if (exp.location?.formatted) {
        addField(`XP${num}Contexte`, `XP${num} - Contexte`, `Localisation: ${exp.location.formatted}`);
      }
    });

    // Secteurs d'activité uniques (jusqu'à 8)
    const sectors = new Set<string>();
    data.workExperience.forEach(exp => {
      if (exp.occupation?.classification?.title) {
        sectors.add(exp.occupation.classification.title);
      }
    });
    Array.from(sectors).slice(0, 8).forEach((sector, index) => {
      const num = String(index + 1).padStart(2, '0');
      addField(`SecteurActivite${num}`, `Secteur d'activité ${index + 1}`, sector);
    });
  }

  // Certifications
  if (data.certifications && data.certifications.length > 0) {
    // Ajouter comme compétences supplémentaires ou créer de nouveaux tags
    data.certifications.slice(0, 5).forEach((cert, index) => {
      addField(`Certification${String(index + 1).padStart(2, '0')}`, `Certification ${index + 1}`, cert);
    });
  }

  // Publications
  if (data.publications && data.publications.length > 0) {
    data.publications.slice(0, 5).forEach((pub, index) => {
      addField(`Publication${index + 1}`, `Publication ${index + 1}`, pub);
    });
  }

  // LinkedIn et sites web
  if (data.linkedin) {
    addField('LinkedIn', 'LinkedIn', data.linkedin, 'url');
  }
  if (data.websites && data.websites.length > 0) {
    addField('SiteWeb', 'Site web', data.websites[0], 'url');
  }

  return fields;
}

function generateSummary(response: AffindaResponse): string {
  const data = response.data;
  if (!data) return 'Aucune donnée extraite';

  const parts: string[] = [];
  
  if (data.name?.raw || (data.name?.first && data.name?.last)) {
    parts.push(`Candidat: ${data.name.raw || `${data.name.first} ${data.name.last}`}`);
  }
  
  if (data.profession) {
    parts.push(`Profession: ${data.profession}`);
  }
  
  if (data.totalYearsExperience) {
    parts.push(`Expérience totale: ${data.totalYearsExperience} ans`);
  }
  
  if (data.workExperience?.length) {
    parts.push(`${data.workExperience.length} expérience(s) professionnelle(s)`);
  }
  
  if (data.education?.length) {
    parts.push(`${data.education.length} formation(s)`);
  }
  
  if (data.skills?.length) {
    parts.push(`${data.skills.length} compétence(s) identifiée(s)`);
  }
  
  if (data.languages?.length) {
    parts.push(`${data.languages.length} langue(s)`);
  }

  return parts.join(' | ');
}

