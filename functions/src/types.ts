export interface PLO {
  code: string;
  description: string;
}

export interface Program {
  id?: string;
  name: string;
  description: string;
  plos: PLO[];
  ownerUid: string;
  sourceFiles?: { name: string; path: string }[];
  createdAt?: number;
  updatedAt?: number;
}

export interface CourseSuggestion {
  code: string;
  name: string;
  credits: number;
  rationale: string;
  mappedPlos: string[];
}

export interface CLO {
  code: string;
  description: string;
  bloomLevel?: string;
  mappedPlos: string[];
}

export interface ChapterTopic {
  title: string;
  hours: number;
  content: string;
  mappedClos: string[];
}

export interface AssessmentItem {
  type: string;
  weight: number;
  mappedClos: string[];
  description: string;
}

export interface Reference {
  title: string;
  authors: string;
  year?: number;
  publisher?: string;
  type: "main" | "supplementary";
}

export interface Syllabus {
  id?: string;
  programId: string;
  ownerUid: string;
  code: string;
  name: string;
  nameEn?: string;
  credits: number;
  prerequisites?: string;
  description: string;
  objectives: string;
  clos: CLO[];
  cloPloMatrix?: Record<string, Record<string, number>>;
  chapters: ChapterTopic[];
  teachingMethods: string[];
  assessments: AssessmentItem[];
  references: Reference[];
  templateId?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface SyllabusTemplate {
  id?: string;
  programId: string;
  ownerUid: string;
  name: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: number;
}
