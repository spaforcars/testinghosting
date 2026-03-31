import type { SupabaseClient } from '@supabase/supabase-js';
import { getBookingSettings, getServicesContentForBooking } from './booking';
import { getCustomerWorkspaceContext } from './customerWorkspace';
import { getTodayDateKeyForTimeZone, getDailyOpsSummaryData } from './dailyOpsSummary';
import { buildServiceLabel, getOfferingById, getPrimaryOfferings } from '../../lib/serviceCatalog';
import { DEFAULT_APP_TIME_ZONE, formatDateTimeInTimeZone } from '../../lib/timeZone';
import type { ServiceOffering, ServicesPageContent } from '../../types/cms';
import type {
  AiDraft,
  AiEntityType,
  AiFeature,
  AiFeatureState,
  AiRecommendation,
  AiRun,
  AiRunStatus,
  AiSuggestedAction,
  AiSuggestion,
  AiSuggestionUrgency,
} from '../../types/ai';

export interface AiSettings {
  enabled: boolean;
  provider: 'groq' | 'openai';
  model: string;
  approvalMode: 'human_required';
  reviewConfidenceThreshold: number;
  features: {
    leadCopilot: boolean;
    replyDrafts: boolean;
    workBriefs: boolean;
    aftercareDrafts: boolean;
    dailyBriefs: boolean;
    visionAssessments: boolean;
  };
}

interface AiRunInsertResult {
  id: string;
  provider?: string | null;
  model?: string | null;
}

interface ProviderExecutionResult {
  suggestion: {
    summary: string;
    recommendations: AiRecommendation[];
    missingInfo: string[];
    drafts: AiDraft[];
    confidence: number;
    warnings: string[];
    recommendedNextAction?: string;
    urgency?: AiSuggestionUrgency;
    actions?: AiSuggestedAction[];
  };
  provider?: string | null;
  model?: string | null;
  latencyMs?: number | null;
  tokenInputCount?: number | null;
  tokenOutputCount?: number | null;
  tokenTotalCount?: number | null;
}

interface GenerateAiSuggestionOptions {
  feature: AiFeature;
  entityType: AiEntityType;
  entityId: string;
  userId?: string | null;
  sourceSnapshot: Record<string, unknown>;
  systemPrompt: string;
  userPrompt: string;
  fallbackSuggestion: ProviderExecutionResult['suggestion'];
  persistFeatureState?: boolean;
}

interface LeadAiContext {
  lead: Record<string, unknown>;
  enquiry: Record<string, unknown> | null;
  bookingAssets: Array<Record<string, unknown>>;
  matchedClient: Record<string, unknown> | null;
  priorJobs: Array<Record<string, unknown>>;
  servicesCatalog: Array<Record<string, unknown>>;
  matchedOffering: ServiceOffering | null;
}

interface JobAiContext {
  job: Record<string, unknown>;
  lead: Record<string, unknown> | null;
  client: Record<string, unknown> | null;
  priorJobs: Array<Record<string, unknown>>;
  vehicles: Array<Record<string, unknown>>;
  servicesCatalog: Array<Record<string, unknown>>;
  matchedOffering: ServiceOffering | null;
}

type CustomerAiContext = Awaited<ReturnType<typeof getCustomerWorkspaceContext>>;

const AI_PROMPT_VERSION = '2026-03-16.v1';

const defaultAiSettings: AiSettings = {
  enabled: true,
  provider: 'groq',
  model: 'openai/gpt-oss-20b',
  approvalMode: 'human_required',
  reviewConfidenceThreshold: 0.65,
  features: {
    leadCopilot: true,
    replyDrafts: true,
    workBriefs: true,
    aftercareDrafts: true,
    dailyBriefs: true,
    visionAssessments: false,
  },
};

const aiSuggestionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary',
    'recommendations',
    'missingInfo',
    'drafts',
    'confidence',
    'warnings',
    'recommendedNextAction',
    'urgency',
    'actions',
  ],
  properties: {
    summary: { type: 'string' },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'detail', 'priority', 'kind'],
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          kind: {
            type: 'string',
            enum: ['next_step', 'service', 'upsell', 'risk', 'prep', 'follow_up'],
          },
        },
      },
    },
    missingInfo: {
      type: 'array',
      items: { type: 'string' },
    },
    drafts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'channel', 'tone', 'subject', 'body'],
        properties: {
          label: { type: 'string' },
          channel: { type: 'string', enum: ['email', 'sms', 'whatsapp', 'internal'] },
          tone: { type: 'string' },
          subject: { type: ['string', 'null'] },
          body: { type: 'string' },
        },
      },
    },
    confidence: { type: 'number' },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
    recommendedNextAction: { type: 'string' },
    urgency: { type: 'string', enum: ['low', 'medium', 'high'] },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'label', 'status', 'serviceCatalogId', 'serviceType', 'serviceAddonIds', 'note'],
        properties: {
          type: {
            type: 'string',
            enum: [
              'update_lead_status',
              'set_lead_service_recommendation',
              'append_lead_note',
              'append_job_note',
            ],
          },
          label: { type: 'string' },
          status: { type: ['string', 'null'] },
          serviceCatalogId: { type: ['string', 'null'] },
          serviceType: { type: ['string', 'null'] },
          serviceAddonIds: {
            type: ['array', 'null'],
            items: { type: 'string' },
          },
          note: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const;

const defaultServicesContentProxy = {
  detailingOfferings: [] as ServiceOffering[],
  specialtyServices: [] as ServiceOffering[],
  additionalServices: [] as ServiceOffering[],
  detailingPackages: [],
  badge: '',
  title: '',
  subtitle: '',
  detailingPackagesTitle: '',
  exteriorIncludesTitle: '',
  exteriorIncludes: [],
  interiorIncludesTitle: '',
  interiorIncludes: [],
  specialtyServicesTitle: '',
  additionalServicesTitle: '',
  featuredOfferingIds: [],
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const readString = (value: unknown) => (typeof value === 'string' ? value : '');

const readNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const readFirstNumber = (...values: unknown[]) => {
  for (const value of values) {
    const numeric = readNumber(value);
    if (numeric !== null) return numeric;
  }
  return null;
};

const readBoolean = (value: unknown) => (typeof value === 'boolean' ? value : false);

const readStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const clampConfidence = (value: unknown, fallback = 0.5) => {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, numeric));
};

const normalizePhone = (value: string) => value.replace(/[^\d+]/g, '');

const normalizeAiProvider = (value: unknown): AiSettings['provider'] =>
  typeof value === 'string' && value.toLowerCase() === 'openai' ? 'openai' : 'groq';

const buildFeatureKey = (feature: AiFeature) => {
  switch (feature) {
    case 'lead_copilot':
      return 'copilot';
    case 'lead_reply_draft':
      return 'replyDraft';
    case 'job_work_brief':
      return 'workBrief';
    case 'job_aftercare_draft':
      return 'aftercareDraft';
    case 'daily_brief':
      return 'dailyBrief';
    default:
      return feature;
  }
};

const isAiFeatureEnabled = (settings: AiSettings, feature: AiFeature) => {
  switch (feature) {
    case 'lead_copilot':
      return settings.features.leadCopilot;
    case 'lead_reply_draft':
      return settings.features.replyDrafts;
    case 'job_work_brief':
      return settings.features.workBriefs;
    case 'job_aftercare_draft':
      return settings.features.aftercareDrafts;
    case 'daily_brief':
      return settings.features.dailyBriefs;
    default:
      return true;
  }
};

const getEntityTable = (entityType: AiEntityType) => {
  if (entityType === 'lead') return 'leads';
  if (entityType === 'service_job') return 'service_jobs';
  return null;
};

const buildServicesCatalogSnapshot = (servicesContent: ServicesPageContent) =>
  getPrimaryOfferings(servicesContent).map((offering) => ({
    id: offering.id,
    title: offering.title,
    shortTitle: offering.shortTitle || null,
    category: offering.category,
    priceLabel: offering.priceLabel,
    duration: offering.duration || null,
    bookingMode: offering.bookingMode,
    allowsPickupRequest: offering.allowsPickupRequest,
    intakeMode: offering.intakeMode,
    features: offering.features.slice(0, 6),
  }));

const buildOfferingSearchText = (offering: ServiceOffering) =>
  [
    offering.title,
    offering.shortTitle || '',
    offering.description,
    offering.category,
    offering.features.join(' '),
    offering.notes || '',
  ]
    .join(' ')
    .toLowerCase();

const tokenizeText = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3);

const findRecommendedOffering = (
  servicesContent: ServicesPageContent,
  inputs: string[]
): ServiceOffering | null => {
  const primaryOfferings = getPrimaryOfferings(servicesContent);
  const tokens = Array.from(new Set(inputs.flatMap(tokenizeText)));
  if (!tokens.length) return null;

  let bestMatch: { offering: ServiceOffering; score: number } | null = null;
  for (const offering of primaryOfferings) {
    const haystack = buildOfferingSearchText(offering);
    const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { offering, score };
    }
  }

  return bestMatch && bestMatch.score > 0 ? bestMatch.offering : null;
};

const deriveSuggestedAddOnIds = (issueText: string, currentAddOnIds: string[]) => {
  const lower = issueText.toLowerCase();
  const suggestions: string[] = [];

  if (!currentAddOnIds.includes('pet-hair-removal') && /(pet|dog|cat).{0,12}hair|hair/.test(lower)) {
    suggestions.push('pet-hair-removal');
  }
  if (!currentAddOnIds.includes('odor-removal') && /(odor|odour|smoke|smell)/.test(lower)) {
    suggestions.push('odor-removal');
  }
  if (!currentAddOnIds.includes('headlight-restoration') && /headlight|foggy lights|cloudy lights/.test(lower)) {
    suggestions.push('headlight-restoration');
  }
  if (!currentAddOnIds.includes('engine-bay-cleaning') && /engine bay|engine cleaning/.test(lower)) {
    suggestions.push('engine-bay-cleaning');
  }

  return suggestions;
};

const getOfferingByIdFromRows = (rows: Array<Record<string, unknown>>, offeringId: string): ServiceOffering | null => {
  const row = rows.find((item) => readString(item.id) === offeringId);
  if (!row) return null;
  return {
    id: readString(row.id),
    title: readString(row.title),
    shortTitle: readString(row.shortTitle) || undefined,
    description: '',
    category: (readString(row.category) || 'detailing') as ServiceOffering['category'],
    priceLabel: readString(row.priceLabel),
    duration: readString(row.duration) || undefined,
    image: '',
    features: readStringArray(row.features),
    notes: undefined,
    bookable: true,
    addOnOnly: false,
    bookingMode: readString(row.bookingMode) === 'request' ? 'request' : 'instant',
    allowsPickupRequest: readBoolean(row.allowsPickupRequest),
    intakeMode: readString(row.intakeMode) === 'assessment' ? 'assessment' : 'basic',
  };
};

const extractResponseOutputText = (payload: Record<string, unknown>) => {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as Array<Record<string, unknown>>)
      : [];
    for (const entry of content) {
      if (entry?.type === 'output_text' && typeof entry.text === 'string') {
        chunks.push(entry.text);
      }
    }
  }
  return chunks.join('\n').trim();
};

const sanitizeRecommendations = (value: unknown): AiRecommendation[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item): AiRecommendation => {
          const priority: AiRecommendation['priority'] =
            item.priority === 'high' || item.priority === 'low' ? item.priority : 'medium';
          const kind: AiRecommendation['kind'] =
            item.kind === 'service' ||
            item.kind === 'upsell' ||
            item.kind === 'risk' ||
            item.kind === 'prep' ||
            item.kind === 'follow_up'
              ? item.kind
              : 'next_step';
          return {
            title: readString(item.title),
            detail: readString(item.detail),
            priority,
            kind,
          };
        })
        .filter((item) => item.title && item.detail)
    : [];

const sanitizeDrafts = (value: unknown): AiDraft[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item): AiDraft => {
          const channel: AiDraft['channel'] =
            item.channel === 'email' ||
            item.channel === 'sms' ||
            item.channel === 'whatsapp' ||
            item.channel === 'internal'
              ? item.channel
              : 'internal';
          return {
            label: readString(item.label) || 'Draft',
            channel,
            tone: readString(item.tone) || 'neutral',
            subject: readString(item.subject) || undefined,
            body: readString(item.body),
          };
        })
        .filter((draft) => draft.body)
    : [];

const sanitizeActions = (value: unknown): AiSuggestedAction[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item): AiSuggestedAction => {
          const type: AiSuggestedAction['type'] =
            item.type === 'update_lead_status' ||
            item.type === 'set_lead_service_recommendation' ||
            item.type === 'append_lead_note' ||
            item.type === 'append_job_note'
              ? item.type
              : 'append_lead_note';
          return {
            type,
            label: readString(item.label) || 'Apply suggestion',
            status: readString(item.status) || undefined,
            serviceCatalogId: readString(item.serviceCatalogId) || undefined,
            serviceType: readString(item.serviceType) || undefined,
            serviceAddonIds: readStringArray(item.serviceAddonIds),
            note: readString(item.note) || undefined,
          };
        })
        .filter((action) => action.label)
    : [];

const parseProviderSuggestion = (
  raw: Record<string, unknown>,
  fallback: ProviderExecutionResult['suggestion']
): ProviderExecutionResult['suggestion'] => ({
  summary: readString(raw.summary) || fallback.summary,
  recommendations: sanitizeRecommendations(raw.recommendations).length
    ? sanitizeRecommendations(raw.recommendations)
    : fallback.recommendations,
  missingInfo: readStringArray(raw.missingInfo),
  drafts: sanitizeDrafts(raw.drafts),
  confidence: clampConfidence(raw.confidence, fallback.confidence),
  warnings: readStringArray(raw.warnings),
  recommendedNextAction: readString(raw.recommendedNextAction) || fallback.recommendedNextAction,
  urgency:
    raw.urgency === 'high' || raw.urgency === 'low' ? raw.urgency : raw.urgency === 'medium' ? 'medium' : fallback.urgency,
  actions: sanitizeActions(raw.actions),
});

const createAiRun = async (
  supabase: SupabaseClient,
  options: {
    entityType: AiEntityType;
    entityId: string;
    feature: AiFeature;
    userId?: string | null;
    provider?: string | null;
    model?: string | null;
    sourceSnapshot: Record<string, unknown>;
  }
): Promise<AiRunInsertResult> => {
  const { data, error } = await supabase
    .from('ai_runs')
    .insert({
      entity_type: options.entityType,
      entity_id: options.entityId,
      feature_name: options.feature,
      prompt_version: AI_PROMPT_VERSION,
      status: 'queued',
      provider: options.provider || null,
      model: options.model || null,
      source_snapshot: options.sourceSnapshot,
      created_by: options.userId || null,
    })
    .select('id, provider, model')
    .single();

  if (error) throw new Error(error.message);
  return data as AiRunInsertResult;
};

export const getAiRunById = async (supabase: SupabaseClient, runId: string): Promise<AiRun | null> => {
  const { data, error } = await supabase.from('ai_runs').select('*').eq('id', runId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AiRun | null) || null;
};

export const listAiRuns = async (
  supabase: SupabaseClient,
  options: {
    limit?: number;
    entityType?: AiEntityType | null;
    status?: AiRunStatus | null;
    feature?: AiFeature | null;
  } = {}
) => {
  let query = supabase
    .from('ai_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options.limit || 25);

  if (options.entityType) query = query.eq('entity_type', options.entityType);
  if (options.status) query = query.eq('status', options.status);
  if (options.feature) query = query.eq('feature_name', options.feature);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as AiRun[];
};

const updateAiRun = async (
  supabase: SupabaseClient,
  runId: string,
  updates: Record<string, unknown>
) => {
  const { error } = await supabase
    .from('ai_runs')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId);

  if (error) throw new Error(error.message);
};

export const getAiSettings = async (supabase: SupabaseClient): Promise<AiSettings> => {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'ai_settings')
    .maybeSingle();

  const raw = toRecord(data?.value);
  const features = toRecord(raw.features);

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : defaultAiSettings.enabled,
    provider: normalizeAiProvider(process.env.AI_PROVIDER || readString(raw.provider) || defaultAiSettings.provider),
    model: process.env.AI_MODEL || readString(raw.model) || defaultAiSettings.model,
    approvalMode: 'human_required',
    reviewConfidenceThreshold:
      typeof raw.reviewConfidenceThreshold === 'number'
        ? raw.reviewConfidenceThreshold
        : defaultAiSettings.reviewConfidenceThreshold,
    features: {
      leadCopilot:
        typeof features.leadCopilot === 'boolean'
          ? (features.leadCopilot as boolean)
          : defaultAiSettings.features.leadCopilot,
      replyDrafts:
        typeof features.replyDrafts === 'boolean'
          ? (features.replyDrafts as boolean)
          : defaultAiSettings.features.replyDrafts,
      workBriefs:
        typeof features.workBriefs === 'boolean'
          ? (features.workBriefs as boolean)
          : defaultAiSettings.features.workBriefs,
      aftercareDrafts:
        typeof features.aftercareDrafts === 'boolean'
          ? (features.aftercareDrafts as boolean)
          : defaultAiSettings.features.aftercareDrafts,
      dailyBriefs:
        typeof features.dailyBriefs === 'boolean'
          ? (features.dailyBriefs as boolean)
          : defaultAiSettings.features.dailyBriefs,
      visionAssessments:
        typeof features.visionAssessments === 'boolean'
          ? (features.visionAssessments as boolean)
          : defaultAiSettings.features.visionAssessments,
    },
  };
};

const getAiProviderConfig = (provider: AiSettings['provider']) => {
  if (provider === 'openai') {
    return {
      provider,
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
      missingApiKeyMessage:
        'OPENAI_API_KEY is not configured. Returning a grounded fallback output instead of a model response.',
      requestFailureMessage: 'OpenAI request failed',
      includeStoreFlag: true,
    };
  }

  return {
    provider,
    apiKey: process.env.GROQ_API_KEY,
    baseUrl: (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
    missingApiKeyMessage:
      'GROQ_API_KEY is not configured. Returning a grounded fallback output instead of a model response.',
    requestFailureMessage: 'Groq request failed',
    includeStoreFlag: false,
  };
};

const callAiProvider = async (
  settings: AiSettings,
  input: { systemPrompt: string; userPrompt: string },
  fallback: ProviderExecutionResult['suggestion']
): Promise<ProviderExecutionResult> => {
  const providerConfig = getAiProviderConfig(settings.provider);
  if (!providerConfig.apiKey) {
    return {
      suggestion: {
        ...fallback,
        warnings: [
          ...fallback.warnings,
          providerConfig.missingApiKeyMessage,
        ],
      },
      provider: settings.provider,
      model: settings.model,
    };
  }

  const requestBody: Record<string, unknown> = {
    model: settings.model,
    instructions: input.systemPrompt,
    input: input.userPrompt,
    text: {
      format: {
        type: 'json_schema',
        name: 'ai_suggestion',
        strict: true,
        schema: aiSuggestionJsonSchema,
      },
    },
  };

  if (providerConfig.includeStoreFlag) {
    requestBody.store = false;
  }

  const startedAt = Date.now();
  const response = await fetch(`${providerConfig.baseUrl}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${providerConfig.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      readString(payload.error && typeof payload.error === 'object' ? (payload.error as Record<string, unknown>).message : '') ||
      response.statusText ||
      providerConfig.requestFailureMessage;
    throw new Error(message);
  }

  const outputText = extractResponseOutputText(payload);
  if (!outputText) {
    throw new Error('AI provider returned no structured content');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(outputText) as Record<string, unknown>;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to parse AI provider output');
  }

  const usage = toRecord(payload.usage);
  return {
    suggestion: parseProviderSuggestion(parsed, fallback),
    provider: settings.provider,
    model: settings.model,
    latencyMs: Date.now() - startedAt,
    tokenInputCount: readFirstNumber(usage.input_tokens, usage.prompt_tokens),
    tokenOutputCount: readFirstNumber(usage.output_tokens, usage.completion_tokens),
    tokenTotalCount: readFirstNumber(usage.total_tokens),
  };
};

const persistFeatureState = async (
  supabase: SupabaseClient,
  entityType: AiEntityType,
  entityId: string,
  feature: AiFeature,
  suggestion: AiSuggestion,
  approvalStatus: AiFeatureState['approvalStatus'] = 'pending'
) => {
  const table = getEntityTable(entityType);
  if (!table) return;

  const { data, error } = await supabase.from(table).select('ai_metadata').eq('id', entityId).maybeSingle();
  if (error) throw new Error(error.message);

  const currentMetadata = toRecord(data?.ai_metadata);
  const featureKey = buildFeatureKey(feature);
  const nextState: AiFeatureState = {
    feature,
    summary: suggestion.summary,
    recommendations: suggestion.recommendations,
    missingInfo: suggestion.missingInfo,
    drafts: suggestion.drafts,
    confidence: suggestion.confidence,
    warnings: suggestion.warnings,
    recommendedNextAction: suggestion.recommendedNextAction,
    urgency: suggestion.urgency,
    actions: suggestion.actions,
    runId: suggestion.runId,
    promptVersion: suggestion.promptVersion,
    status: suggestion.status,
    approvalStatus,
    updatedAt: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from(table)
    .update({
      ai_metadata: {
        ...currentMetadata,
        [featureKey]: nextState,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', entityId);

  if (updateError) throw new Error(updateError.message);
};

const updateFeatureApprovalState = async (
  supabase: SupabaseClient,
  entityType: AiEntityType,
  entityId: string,
  feature: AiFeature,
  approvalStatus: AiFeatureState['approvalStatus']
) => {
  const table = getEntityTable(entityType);
  if (!table) return;

  const { data, error } = await supabase.from(table).select('ai_metadata').eq('id', entityId).maybeSingle();
  if (error) throw new Error(error.message);

  const currentMetadata = toRecord(data?.ai_metadata);
  const featureKey = buildFeatureKey(feature);
  const currentState = toRecord(currentMetadata[featureKey]);
  if (!Object.keys(currentState).length) return;

  const updatedState = {
    ...currentState,
    approvalStatus,
    updatedAt: new Date().toISOString(),
    appliedAt: approvalStatus === 'applied' ? new Date().toISOString() : currentState.appliedAt,
    dismissedAt: approvalStatus === 'dismissed' ? new Date().toISOString() : currentState.dismissedAt,
  };

  const { error: updateError } = await supabase
    .from(table)
    .update({
      ai_metadata: {
        ...currentMetadata,
        [featureKey]: updatedState,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', entityId);

  if (updateError) throw new Error(updateError.message);
};

export const generateAiSuggestion = async (
  supabase: SupabaseClient,
  options: GenerateAiSuggestionOptions
): Promise<AiSuggestion> => {
  const settings = await getAiSettings(supabase);
  const run = await createAiRun(supabase, {
    entityType: options.entityType,
    entityId: options.entityId,
    feature: options.feature,
    userId: options.userId,
    provider: settings.provider,
    model: settings.model,
    sourceSnapshot: options.sourceSnapshot,
  });

  try {
    const execution = !settings.enabled || !isAiFeatureEnabled(settings, options.feature)
      ? {
          suggestion: {
            ...options.fallbackSuggestion,
            warnings: [
              ...options.fallbackSuggestion.warnings,
              'AI settings disabled this feature. Returning a grounded fallback output.',
            ],
          },
          provider: settings.provider,
          model: settings.model,
        }
      : await callAiProvider(
          settings,
          {
            systemPrompt: options.systemPrompt,
            userPrompt: options.userPrompt,
          },
          options.fallbackSuggestion
        );

    const status: AiRunStatus =
      execution.suggestion.confidence < settings.reviewConfidenceThreshold ||
      execution.suggestion.missingInfo.length > 0
        ? 'review_required'
        : 'completed';

    const suggestion: AiSuggestion = {
      feature: options.feature,
      entityType: options.entityType,
      entityId: options.entityId,
      summary: execution.suggestion.summary,
      recommendations: execution.suggestion.recommendations,
      missingInfo: execution.suggestion.missingInfo,
      drafts: execution.suggestion.drafts,
      confidence: clampConfidence(execution.suggestion.confidence, options.fallbackSuggestion.confidence),
      warnings: execution.suggestion.warnings,
      sourceSnapshot: options.sourceSnapshot,
      runId: run.id,
      recommendedNextAction: execution.suggestion.recommendedNextAction,
      urgency: execution.suggestion.urgency,
      actions: execution.suggestion.actions,
      promptVersion: AI_PROMPT_VERSION,
      status,
    };

    await updateAiRun(supabase, run.id, {
      status,
      provider: execution.provider || run.provider || null,
      model: execution.model || run.model || null,
      confidence: suggestion.confidence,
      latency_ms: execution.latencyMs || null,
      token_input_count: execution.tokenInputCount || null,
      token_output_count: execution.tokenOutputCount || null,
      token_total_count: execution.tokenTotalCount || null,
      output_snapshot: {
        summary: suggestion.summary,
        recommendations: suggestion.recommendations,
        missingInfo: suggestion.missingInfo,
        drafts: suggestion.drafts,
        warnings: suggestion.warnings,
        recommendedNextAction: suggestion.recommendedNextAction,
        urgency: suggestion.urgency,
        actions: suggestion.actions,
      },
    });

    if (options.persistFeatureState && (options.entityType === 'lead' || options.entityType === 'service_job')) {
      await persistFeatureState(supabase, options.entityType, options.entityId, options.feature, suggestion);
    }

    return suggestion;
  } catch (error) {
    await updateAiRun(supabase, run.id, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown AI error',
    });
    throw error;
  }
};

const buildLeadMissingInfo = (lead: Record<string, unknown>, matchedOffering: ServiceOffering | null) => {
  const intake = toRecord(lead.intake_metadata);
  const missingInfo: string[] = [];

  if (!readString(lead.phone) && !readString(lead.email)) {
    missingInfo.push('Add at least one reliable contact method for the customer.');
  }
  if (!readString(lead.service_type) && !readString(lead.service_catalog_id)) {
    missingInfo.push('Clarify the exact service scope before quoting or scheduling.');
  }
  if (!readString(lead.vehicle_make) || !readString(lead.vehicle_model)) {
    missingInfo.push('Capture the vehicle make and model to size the job correctly.');
  }
  if (
    (matchedOffering?.intakeMode === 'assessment' || readString(lead.booking_mode) === 'request') &&
    !readStringArray(intake.assetPaths).length
  ) {
    missingInfo.push('Request photos before finalizing the quote or recommended service path.');
  }

  return missingInfo;
};

const deriveUrgency = (value: string, pickupRequested: boolean, missingInfoCount: number): AiSuggestionUrgency => {
  const lower = value.toLowerCase();
  if (/asap|today|urgent|tomorrow|immediately/.test(lower)) return 'high';
  if (pickupRequested) return 'high';
  if (missingInfoCount >= 3) return 'low';
  return 'medium';
};

const buildLeadCopilotFallback = (context: LeadAiContext): ProviderExecutionResult['suggestion'] => {
  const lead = context.lead;
  const intake = toRecord(lead.intake_metadata);
  const currentAddOnIds = readStringArray(lead.service_addon_ids);
  const issueText = [readString(lead.service_type), readString(intake.issueDetails), readString(intake.notes)]
    .filter(Boolean)
    .join(' ');
  const recommendedOffering =
    context.matchedOffering ||
    findRecommendedOffering(defaultServicesContentProxy, [issueText]);

  const missingInfo = buildLeadMissingInfo(lead, recommendedOffering);
  const suggestedAddOnIds = deriveSuggestedAddOnIds(issueText, currentAddOnIds);
  const warnings = [
    !recommendedOffering ? 'Service mapping is low-confidence and should be reviewed by staff.' : '',
    readString(lead.booking_mode) === 'request' ? 'Do not promise a final price until the request is reviewed.' : '',
  ].filter(Boolean);
  const pickupRequested = readBoolean(intake.pickupRequested);
  const urgency = deriveUrgency(
    `${readString(intake.preferredSummary)} ${readString(intake.issueDetails)}`,
    pickupRequested,
    missingInfo.length
  );
  const confidenceBase = recommendedOffering ? 0.78 : 0.52;
  const confidence = clampConfidence(confidenceBase - missingInfo.length * 0.06, 0.45);
  const serviceRecommendationLabel = recommendedOffering
    ? buildServiceLabel(
        recommendedOffering,
        suggestedAddOnIds
          .map((addOnId) => getOfferingByIdFromRows(context.servicesCatalog, addOnId))
          .filter(Boolean) as ServiceOffering[],
        recommendedOffering.title
      )
    : 'Manual review required';

  const recommendations: AiRecommendation[] = [
    {
      title: recommendedOffering ? `Likely service fit: ${serviceRecommendationLabel}` : 'Service fit needs review',
      detail: recommendedOffering
        ? `Use ${recommendedOffering.title} as the working scope and confirm condition-based details before final approval.`
        : 'The intake does not map cleanly to one catalog service. Review the customer notes before confirming scope.',
      priority: recommendedOffering ? 'medium' : 'high',
      kind: 'service',
    },
    {
      title: missingInfo.length ? 'Fill intake gaps before next customer touchpoint' : 'Move to a customer response and scheduling step',
      detail: missingInfo.length
        ? missingInfo.join(' ')
        : readString(lead.booking_mode) === 'request'
          ? 'Reply with the next-step review process and request any final assessment details.'
          : 'Confirm the slot details and keep the lead moving toward execution.',
      priority: missingInfo.length ? 'high' : 'medium',
      kind: 'next_step',
    },
  ];

  if (pickupRequested) {
    recommendations.push({
      title: 'Pickup logistics need confirmation',
      detail: 'Verify pickup radius, address details, and service window before staff assignment.',
      priority: 'medium',
      kind: 'risk',
    });
  }

  const actions: AiSuggestedAction[] = [
    {
      type: 'append_lead_note',
      label: 'Append AI triage note',
      note: `AI triage: ${serviceRecommendationLabel}. ${missingInfo.length ? `Open items: ${missingInfo.join(' ')}` : 'Intake looks ready for follow-up.'}`,
    },
  ];

  if (recommendedOffering && recommendedOffering.id !== readString(lead.service_catalog_id)) {
    actions.unshift({
      type: 'set_lead_service_recommendation',
      label: 'Apply recommended service mapping',
      serviceCatalogId: recommendedOffering.id,
      serviceType: recommendedOffering.title,
      serviceAddonIds: suggestedAddOnIds,
    });
  }

  if (readString(lead.status) === 'lead') {
    actions.push({
      type: 'update_lead_status',
      label: 'Mark lead as contacted',
      status: 'contacted',
    });
  }

  return {
    summary: `${readString(lead.name)} requested ${readString(lead.service_type) || 'a manual service review'}${readString(intake.preferredSummary) ? ` with preferred timing of ${readString(intake.preferredSummary)}` : ''}. ${recommendedOffering ? `${recommendedOffering.title} is the strongest catalog fit.` : 'The service fit is ambiguous and needs staff review.'}`,
    recommendations,
    missingInfo,
    drafts: [],
    confidence,
    warnings,
    recommendedNextAction: missingInfo.length
      ? 'Collect the missing intake details before committing to pricing or scheduling.'
      : readString(lead.booking_mode) === 'request'
        ? 'Send a review reply and convert the request once the scope is confirmed.'
        : 'Confirm the booking details and move the lead into the scheduled queue.',
    urgency,
    actions,
  };
};

const buildLeadReplyDraftFallback = (context: LeadAiContext): ProviderExecutionResult['suggestion'] => {
  const lead = context.lead;
  const intake = toRecord(lead.intake_metadata);
  const issueDetails = readString(intake.issueDetails);
  const preferredSummary = readString(intake.preferredSummary);
  const missingInfo = buildLeadMissingInfo(lead, context.matchedOffering);
  const requestMode = readString(lead.booking_mode) === 'request';
  const serviceLabel = readString(lead.service_type) || 'your requested service';
  const intro = requestMode
    ? `Thanks for reaching out about ${serviceLabel}. We’ve reviewed your request and we’re lining up the next step.`
    : `Thanks for booking ${serviceLabel} with Spa for Cars.`;
  const intakeLine = issueDetails ? `We noted: ${issueDetails}.` : '';
  const missingInfoLine = missingInfo.length
    ? `Before we lock this in, please send ${missingInfo.join(' ').toLowerCase()}`
    : requestMode
      ? 'We will confirm the final scope and timing shortly.'
      : 'If anything changes before your appointment, reply here and we’ll adjust it.';

  const emailBody = [
    `Hi ${readString(lead.name) || 'there'},`,
    '',
    intro,
    intakeLine,
    preferredSummary ? `Preferred timing: ${preferredSummary}.` : '',
    missingInfoLine,
    '',
    'Thanks,',
    'Spa for Cars',
  ]
    .filter(Boolean)
    .join('\n');

  const smsBody = `${intro} ${preferredSummary ? `Preferred timing noted: ${preferredSummary}. ` : ''}${missingInfo.length ? `Please send: ${missingInfo.join(' ')}` : requestMode ? 'We’ll confirm next steps shortly.' : 'We’ll see you soon.'}`.trim();

  const whatsappBody = [
    `Hi ${readString(lead.name) || 'there'},`,
    intro,
    preferredSummary ? `Preferred timing: ${preferredSummary}.` : '',
    missingInfo.length ? `Could you send: ${missingInfo.join(' ')}` : requestMode ? 'We’ll follow up with the next step shortly.' : 'If you need any changes, just reply here.',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    summary: `Prepared customer-safe reply drafts for ${readString(lead.name)} based on the current lead intake.`,
    recommendations: [
      {
        title: 'Edit and send from your normal channel',
        detail: 'These drafts are intentionally conservative and should still be reviewed by staff before sending.',
        priority: 'medium',
        kind: 'follow_up',
      },
    ],
    missingInfo,
    drafts: [
      {
        label: 'Email Draft',
        channel: 'email',
        tone: 'professional',
        subject: requestMode ? `Next steps for ${serviceLabel}` : `Update on your ${serviceLabel} booking`,
        body: emailBody,
      },
      {
        label: 'SMS Draft',
        channel: 'sms',
        tone: 'concise',
        body: smsBody,
      },
      {
        label: 'WhatsApp Draft',
        channel: 'whatsapp',
        tone: 'friendly',
        body: whatsappBody,
      },
    ],
    confidence: clampConfidence(missingInfo.length ? 0.7 : 0.84, 0.7),
    warnings: requestMode
      ? ['Do not confirm final pricing or duration until the request is reviewed by staff.']
      : [],
    recommendedNextAction: 'Review the draft, make any necessary edits, and send it through the customer’s preferred channel.',
    urgency: deriveUrgency(`${preferredSummary} ${issueDetails}`, readBoolean(intake.pickupRequested), missingInfo.length),
    actions: [],
  };
};

const buildJobWorkBriefFallback = (context: JobAiContext): ProviderExecutionResult['suggestion'] => {
  const job = context.job;
  const client = context.client ? toRecord(context.client) : null;
  const priorJobs = context.priorJobs;
  const warnings = [
    !readString(job.scheduled_at) ? 'The appointment does not have a scheduled start time yet.' : '',
    !readString(job.vehicle_make) || !readString(job.vehicle_model) ? 'Vehicle details are incomplete.' : '',
  ].filter(Boolean);

  const prepLines = [
    readBoolean(job.pickup_requested) ? 'Confirm pickup/drop-off logistics before dispatch.' : '',
    readString(job.notes) ? `Review notes before handoff: ${readString(job.notes)}` : 'No existing staff notes are attached to this job.',
    priorJobs.length ? `Customer has ${priorJobs.length} prior recorded service job${priorJobs.length === 1 ? '' : 's'}.` : 'No prior service history is on file.',
  ].filter(Boolean);

  const recommendations: AiRecommendation[] = [
    {
      title: 'Prepare the job intake and handoff context',
      detail: prepLines.join(' '),
      priority: warnings.length ? 'high' : 'medium',
      kind: 'prep',
    },
  ];

  if (client?.notes) {
    recommendations.push({
      title: 'Review customer history before the appointment',
      detail: `Customer notes: ${readString(client.notes)}`,
      priority: 'medium',
      kind: 'risk',
    });
  }

  if (readString(job.service_type).toLowerCase().includes('detail')) {
    recommendations.push({
      title: 'Check for upsell opportunities during intake',
      detail: 'Look for odor, pet hair, headlight clouding, or engine-bay condition that could justify an add-on recommendation.',
      priority: 'low',
      kind: 'upsell',
    });
  }

  const internalDraft = [
    `Customer: ${readString(job.client_name)}`,
    `Service: ${readString(job.service_type)}`,
    `Vehicle: ${[readNumber(job.vehicle_year), readString(job.vehicle_make), readString(job.vehicle_model)].filter(Boolean).join(' ') || 'Vehicle details incomplete'}`,
    `Notes: ${readString(job.notes) || 'No notes on file'}`,
    `History: ${priorJobs.length ? `${priorJobs.length} previous jobs on record` : 'No previous jobs on record'}`,
  ].join('\n');

  return {
    summary: `${readString(job.client_name)} is scheduled for ${readString(job.service_type) || 'service work'}. ${priorJobs.length ? 'This customer has prior history on file.' : 'This appears to be a first recorded service.'}`,
    recommendations,
    missingInfo: warnings,
    drafts: [
      {
        label: 'Internal Work Brief',
        channel: 'internal',
        tone: 'operational',
        body: internalDraft,
      },
    ],
    confidence: clampConfidence(warnings.length ? 0.66 : 0.82, 0.74),
    warnings,
    recommendedNextAction: warnings.length
      ? 'Resolve the missing job details and review the intake notes before assigning final prep.'
      : 'Share the work brief with the assigned staff member and confirm prep readiness.',
    urgency: readBoolean(job.pickup_requested) ? 'high' : 'medium',
    actions: [
      {
        type: 'append_job_note',
        label: 'Append work brief to job notes',
        note: internalDraft,
      },
    ],
  };
};

const buildJobAftercareFallback = (context: JobAiContext): ProviderExecutionResult['suggestion'] => {
  const job = context.job;
  const customerName = readString(job.client_name) || readString(context.client?.name) || 'there';
  const serviceLabel = readString(job.service_type) || 'your service';
  const aftercareTips = serviceLabel.toLowerCase().includes('ceramic')
    ? [
        'Avoid washing the vehicle for the first 7 days unless the staff instructs otherwise.',
        'Use pH-neutral soap and avoid automatic brush washes.',
        'Dry with clean microfiber towels to preserve the coating finish.',
      ]
    : serviceLabel.toLowerCase().includes('tint')
      ? [
          'Keep the windows closed for at least 48 hours.',
          'Do not clean the tinted glass for several days after installation.',
          'Expect some temporary haze or small water pockets as the film cures.',
        ]
      : [
          'Avoid drive-through brush washes after the service.',
          'Use clean microfiber towels for maintenance wiping.',
          'Reach out if you notice anything that needs a touch-up.',
        ];

  const emailBody = [
    `Hi ${customerName},`,
    '',
    `Thanks for trusting Spa for Cars with ${serviceLabel}.`,
    'A few aftercare reminders:',
    ...aftercareTips.map((tip) => `- ${tip}`),
    '',
    'If you have any questions or want to book the next visit, reply here.',
    '',
    'Thanks,',
    'Spa for Cars',
  ].join('\n');

  return {
    summary: `Prepared a customer aftercare and follow-up draft for ${serviceLabel}.`,
    recommendations: [
      {
        title: 'Review before sending',
        detail: 'Confirm the care instructions match the actual work performed before sending the follow-up.',
        priority: 'medium',
        kind: 'follow_up',
      },
      {
        title: 'Use the follow-up to support retention',
        detail: 'A short aftercare note and review request helps reinforce the premium service experience.',
        priority: 'low',
        kind: 'upsell',
      },
    ],
    missingInfo: [],
    drafts: [
      {
        label: 'Aftercare Email',
        channel: 'email',
        tone: 'professional',
        subject: `Aftercare for your ${serviceLabel}`,
        body: emailBody,
      },
      {
        label: 'Review Request SMS',
        channel: 'sms',
        tone: 'friendly',
        body: `Hi ${customerName}, thanks again for choosing Spa for Cars for ${serviceLabel}. If everything looks great, we’d appreciate a review. Let us know if you need anything else.`,
      },
    ],
    confidence: 0.81,
    warnings: ['Confirm the finished service scope before sending care instructions or a review request.'],
    recommendedNextAction: 'Review the draft, personalize it if needed, and send it through the customer’s preferred channel.',
    urgency: 'low',
    actions: [
      {
        type: 'append_job_note',
        label: 'Append aftercare summary to job notes',
        note: `Aftercare prepared for ${serviceLabel}: ${aftercareTips.join(' ')}`,
      },
    ],
  };
};

const buildDailyBriefFallback = (sourceSnapshot: Record<string, unknown>): ProviderExecutionResult['suggestion'] => {
  const jobsToday = Array.isArray(sourceSnapshot.jobsToday)
    ? sourceSnapshot.jobsToday.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    : [];
  const openRequests = Array.isArray(sourceSnapshot.openRequests)
    ? sourceSnapshot.openRequests.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    : [];
  const overloadedSlots = Array.isArray(sourceSnapshot.overloadedSlots)
    ? sourceSnapshot.overloadedSlots.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    : [];
  const pickupJobs = jobsToday.filter((job) => readBoolean(job.pickupRequested));
  const unassignedJobs = jobsToday.filter((job) => !readString(job.assigneeId));

  const recommendations: AiRecommendation[] = [
    {
      title: 'Review today’s operational load',
      detail: `${jobsToday.length} scheduled job${jobsToday.length === 1 ? '' : 's'}, ${openRequests.length} open request booking${openRequests.length === 1 ? '' : 's'}, and ${pickupJobs.length} pickup-related job${pickupJobs.length === 1 ? '' : 's'}.`,
      priority: jobsToday.length || openRequests.length ? 'medium' : 'low',
      kind: 'next_step',
    },
  ];

  if (overloadedSlots.length) {
    recommendations.push({
      title: 'Rebalance overloaded appointment windows',
      detail: overloadedSlots
        .map((slot) => `${readString(slot.hourLabel)} (${readNumber(slot.count) || 0} jobs)`)
        .join(', '),
      priority: 'high',
      kind: 'risk',
    });
  }

  if (unassignedJobs.length) {
    recommendations.push({
      title: 'Assign owners to the remaining scheduled jobs',
      detail: `${unassignedJobs.length} job${unassignedJobs.length === 1 ? '' : 's'} do not currently have an assignee.`,
      priority: 'high',
      kind: 'prep',
    });
  }

  if (openRequests.length) {
    recommendations.push({
      title: 'Work the open request backlog early',
      detail: 'Assessment-heavy request bookings should be reviewed before the day fills up further.',
      priority: 'medium',
      kind: 'follow_up',
    });
  }

  return {
    summary: jobsToday.length || openRequests.length
      ? `Today has ${jobsToday.length} scheduled jobs and ${openRequests.length} open request bookings. ${pickupJobs.length ? `${pickupJobs.length} jobs involve pickup logistics.` : 'No pickup logistics are flagged.'}`
      : 'No scheduled jobs or open request bookings are currently on the board for this window.',
    recommendations,
    missingInfo: [],
    drafts: [],
    confidence: overloadedSlots.length ? 0.72 : 0.84,
    warnings: overloadedSlots.length
      ? ['One or more time windows look overloaded and should be reviewed by the service manager.']
      : [],
    recommendedNextAction: openRequests.length || unassignedJobs.length
      ? 'Prioritize unassigned jobs and open request bookings before the day gets underway.'
      : 'Keep the board monitored and refresh the brief after major scheduling changes.',
    urgency: overloadedSlots.length || pickupJobs.length ? 'high' : jobsToday.length ? 'medium' : 'low',
    actions: [],
  };
};

const buildCustomerWorkspaceSourceSnapshot = (context: CustomerAiContext) => ({
  client: context.client,
  summary: context.summary,
  vehicles: context.vehicles,
  serviceJobs: context.serviceJobs.slice(0, 12),
  unpaidJobs: context.unpaidJobs.slice(0, 8),
  paidJobs: context.paidJobs.slice(0, 8),
  leads: context.leads.slice(0, 12),
  enquiries: context.enquiries.slice(0, 12),
  messageLogs: context.messageLogs.slice(0, 20),
  billingRecords: context.billingRecords.slice(0, 12),
  aiRuns: context.aiRuns.slice(0, 12),
  timeline: context.timeline.slice(0, 25),
});

const buildCustomerWorkspaceBriefFallback = (
  context: CustomerAiContext
): ProviderExecutionResult['suggestion'] => {
  const clientName = readString(context.client.name) || 'This customer';
  const timeZone = DEFAULT_APP_TIME_ZONE;
  const nextService = context.summary.nextAppointment
    ? `${readString(context.summary.nextAppointment.service_type)} on ${formatDateTimeInTimeZone(readString(context.summary.nextAppointment.scheduled_at), {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }, timeZone)}`
    : 'No future appointment is currently scheduled.';
  const recentMessage = context.messageLogs[0];
  const lastMessageLine = recentMessage
    ? `${readString(recentMessage.channel).toUpperCase()} ${readString(recentMessage.status)}`
    : 'No recent outbound message has been logged.';

  return {
    summary: `${clientName} has ${context.serviceJobs.length} service job${context.serviceJobs.length === 1 ? '' : 's'} on record, ${context.unpaidJobs.length} unpaid item${context.unpaidJobs.length === 1 ? '' : 's'}, and ${context.enquiries.length} recent enquiry/message thread${context.enquiries.length === 1 ? '' : 's'}. ${nextService}`,
    recommendations: [
      {
        title: 'Anchor the next operator action',
        detail: context.summary.recommendedNextAction,
        priority: context.summary.unpaidBalance > 0 || context.summary.unassignedUpcomingCount > 0 ? 'high' : 'medium',
        kind: 'next_step',
      },
      {
        title: 'Review customer risk flags',
        detail: context.summary.riskFlags.length
          ? context.summary.riskFlags.join(' | ')
          : 'No active risk flags are currently surfaced from billing, assignments, or message backlog.',
        priority: context.summary.riskFlags.length ? 'medium' : 'low',
        kind: 'risk',
      },
      {
        title: 'Use recent communication context',
        detail: lastMessageLine,
        priority: recentMessage ? 'medium' : 'low',
        kind: 'follow_up',
      },
    ],
    missingInfo: [
      !readString(context.client.phone) && !readString(context.client.email)
        ? 'Add a reliable customer contact method before sending a follow-up.'
        : '',
      !context.summary.nextAppointment && !context.serviceJobs.length
        ? 'There is no completed or scheduled service history yet.'
        : '',
    ].filter(Boolean),
    drafts: [],
    confidence: context.timeline.length ? 0.84 : 0.68,
    warnings: context.summary.unpaidBalance > 0 ? ['Outstanding balance should be handled before promising new work.'] : [],
    recommendedNextAction: context.summary.recommendedNextAction,
    urgency:
      context.summary.unpaidBalance > 0 || context.summary.unassignedUpcomingCount > 0
        ? 'high'
        : context.enquiries.length
          ? 'medium'
          : 'low',
    actions: [],
  };
};

const buildCustomerMessageBody = (input: {
  clientName: string;
  intent: string;
  channel: AiDraft['channel'];
  summary: CustomerAiContext['summary'];
  latestServiceLabel: string;
}) => {
  const greeting = input.channel === 'email' ? `Hi ${input.clientName},` : `Hi ${input.clientName},`;
  if (input.intent === 'payment_reminder') {
    return [
      greeting,
      '',
      `This is a quick follow-up from Spa for Cars regarding the outstanding balance on your recent ${input.latestServiceLabel || 'service visit'}.`,
      'When you have a moment, please reply so we can confirm payment timing or help with the next step.',
      '',
      'Thank you,',
      'Spa for Cars',
    ].join('\n');
  }

  if (input.intent === 'reschedule_reply') {
    return [
      greeting,
      '',
      'Thanks for reaching out. We can help with a reschedule.',
      'Reply with your preferred day or time window and we will review the next available options for you.',
      '',
      'Thank you,',
      'Spa for Cars',
    ].join('\n');
  }

  if (input.intent === 'aftercare_follow_up') {
    return [
      greeting,
      '',
      `Thanks again for visiting Spa for Cars for ${input.latestServiceLabel || 'your recent service'}.`,
      'If you have any follow-up questions or want to plan your next visit, reply here and our team will help.',
      '',
      'Thank you,',
      'Spa for Cars',
    ].join('\n');
  }

  return [
    greeting,
    '',
    'Thanks for staying in touch with Spa for Cars.',
    `The current next step on your file is: ${input.summary.recommendedNextAction}`,
    'Reply here if you want us to review the schedule, payment status, or service details with you.',
    '',
    'Thank you,',
    'Spa for Cars',
  ].join('\n');
};

const buildCustomerMessageDraftFallback = (
  context: CustomerAiContext,
  intent: string,
  channel: AiDraft['channel']
): ProviderExecutionResult['suggestion'] => {
  const clientName = readString(context.client.name) || 'there';
  const latestService =
    readString(context.summary.nextAppointment?.service_type) ||
    readString(context.summary.lastCompletedService?.service_type) ||
    readString(context.serviceJobs[0]?.service_type);
  const body = buildCustomerMessageBody({
    clientName,
    intent,
    channel,
    summary: context.summary,
    latestServiceLabel: latestService,
  });

  const subjectByIntent: Record<string, string> = {
    payment_reminder: `Follow-up on your Spa for Cars balance`,
    reschedule_reply: 'Rescheduling your Spa for Cars booking',
    aftercare_follow_up: `Follow-up after your ${latestService || 'recent service'}`,
    booking_confirmation: 'Spa for Cars booking follow-up',
    general_follow_up: 'Following up from Spa for Cars',
  };

  return {
    summary: `Prepared a ${channel.toUpperCase()} draft for ${clientName} focused on ${intent.replace(/_/g, ' ')}.`,
    recommendations: [
      {
        title: 'Review before sending',
        detail: 'Confirm the timing, balance, and service scope details before copying or sending the message.',
        priority: 'medium',
        kind: 'follow_up',
      },
    ],
    missingInfo: !readString(context.client.phone) && channel !== 'email'
      ? ['A phone number is missing for SMS or WhatsApp follow-up.']
      : [],
    drafts: [
      {
        label: 'Customer Draft',
        channel,
        tone: intent === 'payment_reminder' ? 'firm but polite' : 'helpful',
        subject: channel === 'email' ? subjectByIntent[intent] || subjectByIntent.general_follow_up : undefined,
        body,
      },
    ],
    confidence: 0.81,
    warnings: context.summary.unpaidBalance > 0 && intent !== 'payment_reminder'
      ? ['There is still an unpaid balance on file. Keep the message aligned with that status.']
      : [],
    recommendedNextAction: 'Copy the draft, personalize it if needed, then log the communication after sending.',
    urgency: intent === 'payment_reminder' ? 'high' : 'medium',
    actions: [],
  };
};

const buildCustomerTimelineSummaryFallback = (
  context: CustomerAiContext
): ProviderExecutionResult['suggestion'] => {
  const latestTimelineItems = context.timeline.slice(0, 5);
  const lastTouch = latestTimelineItems
    .map((item) => `${item.category}: ${item.title}`)
    .join(' | ');

  return {
    summary: latestTimelineItems.length
      ? `Recent activity for ${readString(context.client.name) || 'this customer'} includes ${lastTouch}.`
      : `No recent timeline activity is logged yet for ${readString(context.client.name) || 'this customer'}.`,
    recommendations: [
      {
        title: 'Use the timeline to avoid duplicate outreach',
        detail: context.messageLogs.length
          ? 'Check the latest logged message before sending another follow-up.'
          : 'No outbound communication is logged yet, so the next outreach can be recorded cleanly.',
        priority: 'medium',
        kind: 'next_step',
      },
      {
        title: 'Tie the timeline to the next operator action',
        detail: context.summary.recommendedNextAction,
        priority: 'medium',
        kind: 'follow_up',
      },
    ],
    missingInfo: latestTimelineItems.length ? [] : ['There is not enough recorded history to build a richer timeline summary yet.'],
    drafts: [],
    confidence: latestTimelineItems.length ? 0.79 : 0.61,
    warnings: [],
    recommendedNextAction: context.summary.recommendedNextAction,
    urgency: context.summary.riskFlags.length ? 'medium' : 'low',
    actions: [],
  };
};

export const getCustomerAiContext = async (
  supabase: SupabaseClient,
  customerId: string
): Promise<CustomerAiContext> => getCustomerWorkspaceContext(supabase, customerId);

export const getLeadAiContext = async (supabase: SupabaseClient, leadId: string): Promise<LeadAiContext> => {
  const { data: lead, error } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead) throw new Error('Lead not found');

  const servicesContent = await getServicesContentForBooking();
  const matchedOffering =
    getOfferingById(servicesContent, lead.service_catalog_id) ||
    findRecommendedOffering(servicesContent, [readString(lead.service_type)]);

  const [enquiryResult, assetsResult] = await Promise.all([
    lead.enquiry_id
      ? supabase.from('enquiries').select('*').eq('id', lead.enquiry_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('booking_assets')
      .select('id, storage_path, original_filename, content_type, size_bytes, created_at')
      .or(`lead_id.eq.${lead.id}${lead.enquiry_id ? `,enquiry_id.eq.${lead.enquiry_id}` : ''}`),
  ]);

  if (enquiryResult.error) throw new Error(enquiryResult.error.message);
  if (assetsResult.error) throw new Error(assetsResult.error.message);

  let matchedClient: Record<string, unknown> | null = null;
  let priorJobs: Array<Record<string, unknown>> = [];
  const email = readString(lead.email);
  const phone = readString(lead.phone);
  if (email && !email.endsWith('@placeholder.local')) {
    const { data: client } = await supabase
      .from('clients')
      .select('id, name, email, phone, notes, tags')
      .eq('email', email)
      .limit(1)
      .maybeSingle();
    matchedClient = client || null;
  }
  if (!matchedClient && phone) {
    const { data: client } = await supabase
      .from('clients')
      .select('id, name, email, phone, notes, tags')
      .eq('phone', phone)
      .limit(1)
      .maybeSingle();
    matchedClient = client || null;
  }
  if (!matchedClient && phone) {
    const normalizedPhone = normalizePhone(phone);
    const { data: clientRows } = await supabase
      .from('clients')
      .select('id, name, email, phone, notes, tags')
      .limit(20);
    matchedClient =
      (clientRows || []).find((row) => normalizePhone(readString(row.phone)) === normalizedPhone) || null;
  }

  if (matchedClient?.id) {
    const { data: jobs } = await supabase
      .from('service_jobs')
      .select('id, service_type, status, scheduled_at, completed_at, notes, booking_reference')
      .eq('client_id', String(matchedClient.id))
      .order('created_at', { ascending: false })
      .limit(6);
    priorJobs = (jobs || []) as Array<Record<string, unknown>>;
  }

  return {
    lead: lead as Record<string, unknown>,
    enquiry: (enquiryResult.data as Record<string, unknown> | null) || null,
    bookingAssets: ((assetsResult.data || []) as Array<Record<string, unknown>>) || [],
    matchedClient,
    priorJobs,
    servicesCatalog: buildServicesCatalogSnapshot(servicesContent),
    matchedOffering,
  };
};

export const getJobAiContext = async (supabase: SupabaseClient, jobId: string): Promise<JobAiContext> => {
  const { data: job, error } = await supabase.from('service_jobs').select('*').eq('id', jobId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!job) throw new Error('Service job not found');

  const servicesContent = await getServicesContentForBooking();
  const matchedOffering =
    getOfferingById(servicesContent, job.service_catalog_id) ||
    findRecommendedOffering(servicesContent, [readString(job.service_type)]);

  const [leadResult, clientResult, priorJobsResult, vehiclesResult] = await Promise.all([
    job.lead_id
      ? supabase.from('leads').select('*').eq('id', job.lead_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    job.client_id
      ? supabase.from('clients').select('*').eq('id', job.client_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    job.client_id
      ? supabase
          .from('service_jobs')
          .select('id, service_type, status, scheduled_at, completed_at, notes, estimated_amount')
          .eq('client_id', job.client_id)
          .neq('id', job.id)
          .order('created_at', { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [], error: null }),
    job.client_id
      ? supabase
          .from('customer_vehicles')
          .select('id, make, model, year, color, notes')
          .eq('client_id', job.client_id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (leadResult.error) throw new Error(leadResult.error.message);
  if (clientResult.error) throw new Error(clientResult.error.message);
  if (priorJobsResult.error) throw new Error(priorJobsResult.error.message);
  if (vehiclesResult.error) throw new Error(vehiclesResult.error.message);

  return {
    job: job as Record<string, unknown>,
    lead: (leadResult.data as Record<string, unknown> | null) || null,
    client: (clientResult.data as Record<string, unknown> | null) || null,
    priorJobs: ((priorJobsResult.data || []) as Array<Record<string, unknown>>) || [],
    vehicles: ((vehiclesResult.data || []) as Array<Record<string, unknown>>) || [],
    servicesCatalog: buildServicesCatalogSnapshot(servicesContent),
    matchedOffering,
  };
};

export const getDailyBriefSourceSnapshot = async (
  supabase: SupabaseClient,
  options: { scope?: 'daily' | 'weekly' } = {}
) => {
  const bookingSettings = await getBookingSettings(supabase);
  const now = new Date();
  const localDateKey = getTodayDateKeyForTimeZone(now, bookingSettings.timeZone);
  const dailyOpsData = await getDailyOpsSummaryData(supabase, {
    localDateKey,
    timeZone: bookingSettings.timeZone,
  });

  const jobsTodayBase = dailyOpsData.scheduledJobs;
  const jobIds = jobsTodayBase.map((job) => job.id).filter(Boolean);
  const { data: detailedJobs, error: detailedJobsError } = jobIds.length
    ? await supabase
        .from('service_jobs')
        .select('id, assignee_id')
        .in('id', jobIds)
    : { data: [], error: null };
  if (detailedJobsError) throw new Error(detailedJobsError.message);

  const assigneeLookup = new Map(
    ((detailedJobs || []) as Array<Record<string, unknown>>).map((job) => [
      readString(job.id),
      readString(job.assignee_id),
    ])
  );
  const jobsToday = jobsTodayBase.map((job) => ({
    ...job,
    assigneeId: assigneeLookup.get(job.id) || '',
  }));
  const openRequests = dailyOpsData.requestLeads;
  const hourCounts = jobsToday.reduce<Record<string, number>>((acc, job) => {
    const date = new Date(job.scheduledAt);
    const hourLabel = new Intl.DateTimeFormat('en-CA', {
      timeZone: bookingSettings.timeZone,
      hour: 'numeric',
      hour12: true,
    }).format(date);
    acc[hourLabel] = (acc[hourLabel] || 0) + 1;
    return acc;
  }, {});

  const overloadedSlots = Object.entries(hourCounts)
    .filter(([, count]) => count >= 3)
    .map(([hourLabel, count]) => ({ hourLabel, count }));

  const metricsSnapshot = {
    scheduledJobsCount: jobsToday.length,
    openRequestCount: openRequests.length,
    pickupCount: jobsToday.filter((job) => Boolean(job.pickupRequested)).length,
    overloadCount: overloadedSlots.length,
  };

  if (options.scope === 'weekly') {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const { data: weeklyJobs, error: weeklyJobsError } = await supabase
      .from('service_jobs')
      .select('id, service_type, status, estimated_amount, scheduled_at, completed_at')
      .gte('created_at', weekStart.toISOString())
      .order('created_at', { ascending: false });
    if (weeklyJobsError) throw new Error(weeklyJobsError.message);

    return {
      scope: 'weekly',
      generatedAt: now.toISOString(),
      timeZone: bookingSettings.timeZone,
      localDateKey,
      jobsToday,
      openRequests,
      overloadedSlots,
      metrics: {
        ...metricsSnapshot,
        weeklyJobCount: (weeklyJobs || []).length,
        weeklyCompletedCount: (weeklyJobs || []).filter((job) => job.status === 'completed').length,
      },
    };
  }

  return {
    scope: 'daily',
    generatedAt: now.toISOString(),
    timeZone: bookingSettings.timeZone,
    localDateKey,
    jobsToday,
    openRequests,
    overloadedSlots,
    metrics: metricsSnapshot,
  };
};

export const buildLeadCopilotSuggestion = async (
  supabase: SupabaseClient,
  leadId: string,
  userId?: string | null
) => {
  const context = await getLeadAiContext(supabase, leadId);
  const lead = context.lead;
  const intake = toRecord(lead.intake_metadata);
  const sourceSnapshot = {
    lead: {
      id: readString(lead.id),
      name: readString(lead.name),
      email: readString(lead.email),
      phone: readString(lead.phone),
      serviceType: readString(lead.service_type),
      serviceCatalogId: readString(lead.service_catalog_id),
      serviceAddonIds: readStringArray(lead.service_addon_ids),
      sourcePage: readString(lead.source_page),
      status: readString(lead.status),
      bookingMode: readString(lead.booking_mode),
      vehicleMake: readString(lead.vehicle_make),
      vehicleModel: readString(lead.vehicle_model),
      vehicleYear: readNumber(lead.vehicle_year),
      preferredSummary: readString(intake.preferredSummary),
      issueDetails: readString(intake.issueDetails),
      notes: readString(intake.notes),
      pickupRequested: readBoolean(intake.pickupRequested),
      pickupAddress: toRecord(intake.pickupAddress),
      assetPaths: readStringArray(intake.assetPaths),
      createdAt: readString(lead.created_at),
    },
    enquiry: context.enquiry,
    bookingAssets: context.bookingAssets,
    matchedClient: context.matchedClient,
    priorJobs: context.priorJobs,
    servicesCatalog: context.servicesCatalog,
  };

  return generateAiSuggestion(supabase, {
    feature: 'lead_copilot',
    entityType: 'lead',
    entityId: leadId,
    userId,
    sourceSnapshot,
    systemPrompt:
      'You are an internal operations copilot for a premium car detailing business. Use only the provided source snapshot. Do not invent vehicle condition, pricing, or promises. Keep outputs actionable for staff. If the intake is incomplete, lower confidence and list the gaps. Only propose safe actions that require staff approval.',
    userPrompt: `Analyze this lead for internal triage. Return a concise staff summary, missing info, recommended next step, likely service mapping, urgency, and only safe actions.\n\nSource snapshot:\n${JSON.stringify(sourceSnapshot, null, 2)}`,
    fallbackSuggestion: buildLeadCopilotFallback(context),
    persistFeatureState: true,
  });
};

export const buildLeadReplyDraftSuggestion = async (
  supabase: SupabaseClient,
  leadId: string,
  userId?: string | null
) => {
  const context = await getLeadAiContext(supabase, leadId);
  const sourceSnapshot = {
    lead: context.lead,
    matchedClient: context.matchedClient,
    priorJobs: context.priorJobs,
  };

  return generateAiSuggestion(supabase, {
    feature: 'lead_reply_draft',
    entityType: 'lead',
    entityId: leadId,
    userId,
    sourceSnapshot,
    systemPrompt:
      'You draft customer-safe replies for internal staff at a premium car care business. Use only the provided source snapshot. Do not commit to pricing, exact turnaround, or automatic scheduling unless the snapshot already confirms it. Produce clean drafts for email, SMS, and WhatsApp that staff can edit before sending.',
    userPrompt: `Draft customer follow-up replies for this lead. Keep the drafts concise, polite, and grounded only in the source snapshot.\n\nSource snapshot:\n${JSON.stringify(sourceSnapshot, null, 2)}`,
    fallbackSuggestion: buildLeadReplyDraftFallback(context),
    persistFeatureState: true,
  });
};

export const buildJobWorkBriefSuggestion = async (
  supabase: SupabaseClient,
  jobId: string,
  userId?: string | null
) => {
  const context = await getJobAiContext(supabase, jobId);
  const sourceSnapshot = {
    job: context.job,
    lead: context.lead,
    client: context.client,
    priorJobs: context.priorJobs,
    vehicles: context.vehicles,
    servicesCatalog: context.servicesCatalog,
  };

  return generateAiSuggestion(supabase, {
    feature: 'job_work_brief',
    entityType: 'service_job',
    entityId: jobId,
    userId,
    sourceSnapshot,
    systemPrompt:
      'You are an internal work-brief copilot for a premium automotive detailing business. Use only the provided source snapshot. Summaries should help technicians and service managers prepare for the day. Do not invent prior issues or upsells. If details are missing, state that explicitly and lower confidence.',
    userPrompt: `Create an internal work brief for this service job. Include prep reminders, likely risks, and any customer history that matters for execution.\n\nSource snapshot:\n${JSON.stringify(sourceSnapshot, null, 2)}`,
    fallbackSuggestion: buildJobWorkBriefFallback(context),
    persistFeatureState: true,
  });
};

export const buildJobAftercareSuggestion = async (
  supabase: SupabaseClient,
  jobId: string,
  userId?: string | null
) => {
  const context = await getJobAiContext(supabase, jobId);
  const sourceSnapshot = {
    job: context.job,
    client: context.client,
    priorJobs: context.priorJobs,
  };

  return generateAiSuggestion(supabase, {
    feature: 'job_aftercare_draft',
    entityType: 'service_job',
    entityId: jobId,
    userId,
    sourceSnapshot,
    systemPrompt:
      'You prepare post-service follow-up drafts for internal staff at a premium car care business. Use only the provided source snapshot. Keep the messaging safe, avoid guarantees not present in the data, and make it easy for staff to review before sending.',
    userPrompt: `Generate an aftercare follow-up draft and a review request draft for this service job.\n\nSource snapshot:\n${JSON.stringify(sourceSnapshot, null, 2)}`,
    fallbackSuggestion: buildJobAftercareFallback(context),
    persistFeatureState: true,
  });
};

export const buildDailyBriefSuggestion = async (
  supabase: SupabaseClient,
  options: { scope?: 'daily' | 'weekly'; userId?: string | null } = {}
) => {
  const sourceSnapshot = await getDailyBriefSourceSnapshot(supabase, { scope: options.scope });
  const entityId = `${readString(sourceSnapshot.localDateKey)}:${readString(sourceSnapshot.scope) || 'daily'}`;

  return generateAiSuggestion(supabase, {
    feature: 'daily_brief',
    entityType: 'report',
    entityId,
    userId: options.userId,
    sourceSnapshot,
    systemPrompt:
      'You are an internal operations briefing assistant for a premium detailing studio. Use only the provided source snapshot. Summaries should help the service manager prioritize the day or the current weekly view. Highlight overload, pickups, backlog, and missing ownership clearly.',
    userPrompt: `Generate an internal ${readString(sourceSnapshot.scope) || 'daily'} manager brief from this operational snapshot.\n\nSource snapshot:\n${JSON.stringify(sourceSnapshot, null, 2)}`,
    fallbackSuggestion: buildDailyBriefFallback(sourceSnapshot),
    persistFeatureState: false,
  });
};

export const buildCustomerWorkspaceBriefSuggestion = async (
  supabase: SupabaseClient,
  customerId: string,
  userId?: string | null
) => {
  const context = await getCustomerAiContext(supabase, customerId);
  const sourceSnapshot = buildCustomerWorkspaceSourceSnapshot(context);

  return generateAiSuggestion(supabase, {
    feature: 'customer_workspace_brief',
    entityType: 'customer',
    entityId: customerId,
    userId,
    sourceSnapshot,
    systemPrompt:
      'You are an internal customer operations copilot for a premium car care business. Use only the provided customer workspace snapshot. Summaries must help staff understand the customer fast, prioritize risk, and decide the next action. Do not invent unpaid balances, communication, or service history.',
    userPrompt: `Create a grounded internal customer workspace brief from this snapshot. Focus on money, current work, communication history, and recommended next action.\n\nSource snapshot:\n${JSON.stringify(sourceSnapshot, null, 2)}`,
    fallbackSuggestion: buildCustomerWorkspaceBriefFallback(context),
    persistFeatureState: false,
  });
};

export const buildCustomerMessageDraftSuggestion = async (
  supabase: SupabaseClient,
  customerId: string,
  options: {
    intent: string;
    channel: AiDraft['channel'];
    userId?: string | null;
  }
) => {
  const context = await getCustomerAiContext(supabase, customerId);
  const sourceSnapshot = {
    ...buildCustomerWorkspaceSourceSnapshot(context),
    requestedIntent: options.intent,
    requestedChannel: options.channel,
  };

  return generateAiSuggestion(supabase, {
    feature: 'customer_message_draft',
    entityType: 'customer',
    entityId: customerId,
    userId: options.userId,
    sourceSnapshot,
    systemPrompt:
      'You draft internal-review customer messages for a premium car care business. Use only the provided customer workspace snapshot. Keep the tone clear and concise. Do not promise schedule times, pricing changes, or work that is not present in the data.',
    userPrompt: `Draft one grounded ${options.channel.toUpperCase()} message for the intent "${options.intent}". Use the customer workspace snapshot only.\n\nSource snapshot:\n${JSON.stringify(sourceSnapshot, null, 2)}`,
    fallbackSuggestion: buildCustomerMessageDraftFallback(context, options.intent, options.channel),
    persistFeatureState: false,
  });
};

export const buildCustomerTimelineSummarySuggestion = async (
  supabase: SupabaseClient,
  customerId: string,
  userId?: string | null
) => {
  const context = await getCustomerAiContext(supabase, customerId);
  const sourceSnapshot = {
    client: context.client,
    summary: context.summary,
    timeline: context.timeline.slice(0, 40),
    messageLogs: context.messageLogs.slice(0, 20),
  };

  return generateAiSuggestion(supabase, {
    feature: 'customer_timeline_summary',
    entityType: 'customer',
    entityId: customerId,
    userId,
    sourceSnapshot,
    systemPrompt:
      'You summarize internal customer timelines for a premium detailing business. Use only the provided timeline snapshot. Focus on the meaningful sequence of events, recent communication, payment movement, and what operations should do next.',
    userPrompt: `Summarize this customer timeline into a concise internal narrative with recommended follow-up.\n\nSource snapshot:\n${JSON.stringify(sourceSnapshot, null, 2)}`,
    fallbackSuggestion: buildCustomerTimelineSummaryFallback(context),
    persistFeatureState: false,
  });
};

export const applyAiRunSuggestion = async (
  supabase: SupabaseClient,
  run: AiRun,
  actionIndex = 0
) => {
  if (!run.output_snapshot || typeof run.output_snapshot !== 'object') {
    throw new Error('AI run has no applyable output');
  }

  const output = toRecord(run.output_snapshot);
  const actions = sanitizeActions(output.actions);
  const action = actions[actionIndex];
  if (!action) throw new Error('Requested AI action was not found');

  if (run.entity_type === 'lead') {
    const { data: lead, error } = await supabase.from('leads').select('*').eq('id', run.entity_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead) throw new Error('Lead not found');

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (action.type === 'update_lead_status' && action.status) {
      updates.status = action.status;
    }

    if (action.type === 'set_lead_service_recommendation') {
      if (action.serviceCatalogId) updates.service_catalog_id = action.serviceCatalogId;
      if (typeof action.serviceType !== 'undefined') updates.service_type = action.serviceType || null;
      if (action.serviceAddonIds) {
        updates.service_addon_ids = action.serviceAddonIds.length ? action.serviceAddonIds : null;
      }
    }

    if (action.type === 'append_lead_note' && action.note) {
      const intakeMetadata = toRecord(lead.intake_metadata);
      const aiStaffNotes = readStringArray(intakeMetadata.aiStaffNotes);
      if (!aiStaffNotes.includes(action.note)) {
        updates.intake_metadata = {
          ...intakeMetadata,
          aiStaffNotes: [...aiStaffNotes, action.note],
        };
      }
    }

    const { data: updatedLead, error: updateError } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', run.entity_id)
      .select('*')
      .single();
    if (updateError) throw new Error(updateError.message);

    await updateAiRun(supabase, run.id, {
      status: 'applied',
      accepted_at: new Date().toISOString(),
      applied_at: new Date().toISOString(),
    });
    await updateFeatureApprovalState(supabase, 'lead', run.entity_id, run.feature_name, 'applied');

    return { action, entity: updatedLead };
  }

  if (run.entity_type === 'service_job') {
    const { data: job, error } = await supabase.from('service_jobs').select('*').eq('id', run.entity_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!job) throw new Error('Service job not found');

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (action.type === 'append_job_note' && action.note) {
      const nextNotes = [readString(job.notes), action.note].filter(Boolean).join('\n\n');
      updates.notes = nextNotes;
    }

    const { data: updatedJob, error: updateError } = await supabase
      .from('service_jobs')
      .update(updates)
      .eq('id', run.entity_id)
      .select('*')
      .single();
    if (updateError) throw new Error(updateError.message);

    await updateAiRun(supabase, run.id, {
      status: 'applied',
      accepted_at: new Date().toISOString(),
      applied_at: new Date().toISOString(),
    });
    await updateFeatureApprovalState(supabase, 'service_job', run.entity_id, run.feature_name, 'applied');

    return { action, entity: updatedJob };
  }

  throw new Error('This AI run does not support apply actions');
};

export const dismissAiRun = async (supabase: SupabaseClient, run: AiRun) => {
  await updateAiRun(supabase, run.id, {
    status: 'dismissed',
    dismissed_at: new Date().toISOString(),
  });

  if (run.entity_type === 'lead' || run.entity_type === 'service_job') {
    await updateFeatureApprovalState(supabase, run.entity_type, run.entity_id, run.feature_name, 'dismissed');
  }
};
