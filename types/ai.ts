export type AiEntityType = 'lead' | 'service_job' | 'customer' | 'report';

export type AiFeature =
  | 'lead_copilot'
  | 'lead_reply_draft'
  | 'job_work_brief'
  | 'job_aftercare_draft'
  | 'customer_workspace_brief'
  | 'customer_message_draft'
  | 'customer_timeline_summary'
  | 'daily_brief';

export type AiRunStatus =
  | 'queued'
  | 'completed'
  | 'review_required'
  | 'applied'
  | 'dismissed'
  | 'failed';

export type AiRecommendationPriority = 'low' | 'medium' | 'high';
export type AiSuggestionUrgency = 'low' | 'medium' | 'high';

export interface AiRecommendation {
  title: string;
  detail: string;
  priority: AiRecommendationPriority;
  kind: 'next_step' | 'service' | 'upsell' | 'risk' | 'prep' | 'follow_up';
}

export interface AiDraft {
  label: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'internal';
  tone: string;
  subject?: string;
  body: string;
}

export type AiSuggestedActionType =
  | 'update_lead_status'
  | 'set_lead_service_recommendation'
  | 'append_lead_note'
  | 'append_job_note';

export interface AiSuggestedAction {
  type: AiSuggestedActionType;
  label: string;
  status?: string;
  serviceCatalogId?: string;
  serviceType?: string;
  serviceAddonIds?: string[];
  note?: string;
}

export interface AiSuggestion {
  feature: AiFeature;
  entityType: AiEntityType;
  entityId: string;
  summary: string;
  recommendations: AiRecommendation[];
  missingInfo: string[];
  drafts: AiDraft[];
  confidence: number;
  warnings: string[];
  sourceSnapshot: Record<string, unknown>;
  runId: string;
  recommendedNextAction?: string;
  urgency?: AiSuggestionUrgency;
  actions?: AiSuggestedAction[];
  promptVersion?: string;
  status?: AiRunStatus;
}

export interface AiFeatureState {
  feature: AiFeature;
  summary: string;
  recommendations: AiRecommendation[];
  missingInfo: string[];
  drafts: AiDraft[];
  confidence: number;
  warnings: string[];
  recommendedNextAction?: string;
  urgency?: AiSuggestionUrgency;
  actions?: AiSuggestedAction[];
  runId: string;
  promptVersion?: string;
  status?: AiRunStatus;
  approvalStatus?: 'pending' | 'applied' | 'dismissed';
  updatedAt: string;
  appliedAt?: string;
  dismissedAt?: string;
}

export interface AiRun {
  id: string;
  entity_type: AiEntityType;
  entity_id: string;
  feature_name: AiFeature;
  prompt_version: string;
  status: AiRunStatus;
  provider?: string | null;
  model?: string | null;
  confidence?: number | null;
  latency_ms?: number | null;
  token_input_count?: number | null;
  token_output_count?: number | null;
  token_total_count?: number | null;
  estimated_cost_usd?: number | null;
  output_snapshot?: Record<string, unknown> | null;
  source_snapshot?: Record<string, unknown> | null;
  accepted_at?: string | null;
  applied_at?: string | null;
  dismissed_at?: string | null;
  error_message?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}
