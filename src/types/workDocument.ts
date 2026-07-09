export type WorkDocumentType = 'checksheet' | 'procedure' | 'reference';

export type WorkDocumentCategory =
  | 'egress_lighting'
  | 'stairwell'
  | 'exit_path'
  | 'general'
  | 'custom';

export type WorkDocumentStatus = 'draft' | 'active' | 'archived';

export type WorkDocumentFieldType =
  | 'pass_fail'
  | 'yes_no'
  | 'text'
  | 'checkbox'
  | 'number';

/**
 * Future: org/{orgId}/workDocumentRuns/{runId} will store in-app walk results
 * keyed by documentId + itemId + fieldKey with WorkDocumentItemResultStatus.
 */
export type WorkDocumentItemResultStatus = 'pass' | 'fail' | 'na' | 'pending';

export interface WorkDocumentField {
  key: string;
  label: string;
  type: WorkDocumentFieldType;
  required?: boolean;
}

export interface WorkDocumentItem {
  id: string;
  label: string;
  locationId?: string | null;
  locationType?: string | null;
  meta?: Record<string, string | number | boolean | null>;
  fields: WorkDocumentField[];
}

export interface WorkDocumentSection {
  id: string;
  title: string;
  description?: string | null;
  items: WorkDocumentItem[];
}

export interface WorkDocumentSchema {
  sections: WorkDocumentSection[];
  printNotes?: string | null;
  footerText?: string | null;
}

export interface WorkDocument {
  id: string;
  title: string;
  description: string | null;
  type: WorkDocumentType;
  category: WorkDocumentCategory;
  status: WorkDocumentStatus;
  schema: WorkDocumentSchema;
  source: 'ai_generated' | 'manual' | 'template';
  relatedLocationId: string | null;
  relatedLocationLabel: string | null;
  createdBy: string;
  createdByEmail: string | null;
  createdAt: unknown;
  updatedBy: string;
  updatedByEmail: string | null;
  updatedAt: unknown;
}
