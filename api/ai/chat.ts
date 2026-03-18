import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthContext, hasPermission } from '../_lib/auth';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { badRequest, forbidden, methodNotAllowed, serverError, unauthorized } from '../_lib/http';
import { isFeatureEnabled } from '../_lib/featureFlags';
import { getServicesContentForBooking } from '../_lib/booking';
import { getAiSettings, type AiSettings } from '../_lib/ai';
import { estimateServiceAmount } from '../../lib/serviceCatalog';

type ChatRole = 'user' | 'assistant';

type ChatMessageInput = {
  role?: ChatRole;
  content?: string;
};

type NoteMatch = {
  source: 'job' | 'client' | 'lead';
  customerName: string;
  summary: string;
  serviceType?: string | null;
  createdAt?: string | null;
};

type RetrievalSource =
  | 'job_note'
  | 'client_note'
  | 'lead_intake'
  | 'lead_pickup'
  | 'enquiry_message'
  | 'job_pickup';

type RetrievalDocument = {
  id: string;
  source: RetrievalSource;
  customerName: string;
  serviceType?: string | null;
  createdAt?: string | null;
  text: string;
  snippet: string;
  tags: string[];
  score: number;
};

type OpsChatResponse = {
  answer: string;
  supportingFacts: string[];
  followUpQuestions: string[];
  mode: 'ai' | 'fallback';
  warning?: string | null;
};

const chatAnswerJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['answer', 'supportingFacts', 'followUpQuestions'],
  properties: {
    answer: { type: 'string' },
    supportingFacts: {
      type: 'array',
      items: { type: 'string' },
    },
    followUpQuestions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} as const;

const stopWords = new Set([
  'a',
  'about',
  'all',
  'am',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'booked',
  'booking',
  'bookings',
  'by',
  'can',
  'did',
  'do',
  'for',
  'from',
  'have',
  'how',
  'i',
  'in',
  'is',
  'it',
  'jobs',
  'me',
  'my',
  'of',
  'on',
  'or',
  'our',
  'pending',
  'please',
  'revenue',
  'scheduled',
  'show',
  'status',
  'that',
  'the',
  'their',
  'them',
  'these',
  'they',
  'to',
  'today',
  'unpaid',
  'upcoming',
  'we',
  'what',
  'who',
  'with',
  'write',
  'written',
  'wrote',
  'you',
]);

const semanticAliasMap: Record<string, string[]> = {
  pickup: ['dropoff', 'drop', 'collect', 'collection', 'address', 'parking', 'gate'],
  dropoff: ['pickup', 'collect', 'collection', 'address'],
  paid: ['payment', 'settled', 'collected', 'invoice'],
  unpaid: ['payment', 'outstanding', 'balance', 'invoice'],
  pending: ['open', 'queued', 'upcoming', 'scheduled'],
  schedule: ['scheduled', 'appointment', 'booking', 'slot'],
  booking: ['appointment', 'schedule', 'scheduled'],
  appointment: ['booking', 'schedule', 'scheduled'],
  note: ['notes', 'message', 'messages', 'details', 'issue'],
  notes: ['note', 'message', 'messages', 'details', 'issue'],
  message: ['messages', 'notes', 'details'],
  smoke: ['odor', 'odour', 'smell', 'cigarette'],
  smell: ['odor', 'odour', 'smoke'],
  odor: ['odour', 'smell', 'smoke'],
  odour: ['odor', 'smell', 'smoke'],
  pet: ['pets', 'dog', 'dogs', 'cat', 'cats', 'fur', 'hair'],
  hair: ['fur', 'pet', 'pets'],
  stain: ['stains', 'spill', 'spills'],
  dirty: ['soiled', 'stain', 'mess'],
  revenue: ['earning', 'earnings', 'sales', 'amount', 'money'],
  earning: ['revenue', 'sales', 'amount', 'money'],
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const readString = (value: unknown) => (typeof value === 'string' ? value : '');

const readStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const normalizeQuestion = (value: string) => value.trim().replace(/\s+/g, ' ');

const tokenizeQuestion = (value: string) =>
  Array.from(
    new Set(
      normalizeQuestion(value)
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter((token) => token.length >= 3 && !stopWords.has(token))
    )
  );

const isMissingColumnError = (message: string, column: string) =>
  message.includes(`Could not find the '${column}' column`) ||
  new RegExp(`column\\s+(?:[a-z0-9_]+\\.)?${column}\\s+does not exist`, 'i').test(message);

const buildSnippet = (text: string, tokens: string[]) => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (!tokens.length) return normalized.slice(0, 180);

  const lower = normalized.toLowerCase();
  const matchIndex = tokens
    .map((token) => lower.indexOf(token))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (typeof matchIndex !== 'number') return normalized.slice(0, 180);
  const start = Math.max(0, matchIndex - 50);
  const end = Math.min(normalized.length, matchIndex + 130);
  return normalized.slice(start, end);
};

const expandSearchTerms = (question: string, baseTokens: string[]) => {
  const expanded = new Set<string>(baseTokens);
  const lower = question.toLowerCase();

  for (const token of baseTokens) {
    (semanticAliasMap[token] || []).forEach((alias) => expanded.add(alias));
  }

  if (lower.includes('pick up') || lower.includes('pickup')) {
    ['pickup', 'dropoff', 'address', 'parking', 'gate'].forEach((token) => expanded.add(token));
  }

  if (lower.includes('customer') || lower.includes('client')) {
    ['customer', 'client'].forEach((token) => expanded.add(token));
  }

  if (lower.includes('who paid') || lower.includes('have paid')) {
    ['paid', 'payment', 'settled'].forEach((token) => expanded.add(token));
  }

  return Array.from(expanded);
};

const getRecencyBoost = (createdAt?: string | null) => {
  if (!createdAt) return 0;
  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) return 0;
  const ageDays = Math.max(0, (Date.now() - createdTime) / 86_400_000);
  if (ageDays <= 3) return 2;
  if (ageDays <= 14) return 1;
  return 0;
};

const sourceLabel = (source: RetrievalSource) =>
  ({
    job_note: 'Job note',
    client_note: 'Client note',
    lead_intake: 'Lead intake',
    lead_pickup: 'Lead pickup',
    enquiry_message: 'Enquiry message',
    job_pickup: 'Job pickup',
  } satisfies Record<RetrievalSource, string>)[source];

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

const getProviderConfig = (settings: AiSettings) => {
  if (settings.provider === 'openai') {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
      missingApiKeyMessage: 'OPENAI_API_KEY is not configured',
      requestFailureMessage: 'OpenAI request failed',
      includeStoreFlag: true,
    };
  }

  return {
    apiKey: process.env.GROQ_API_KEY,
    baseUrl: (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
    missingApiKeyMessage: 'GROQ_API_KEY is not configured',
    requestFailureMessage: 'Groq request failed',
    includeStoreFlag: false,
  };
};

const loadPaymentStatusOverrides = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  jobIds: string[]
) => {
  if (!jobIds.length) return new Map<string, 'paid' | 'unpaid'>();

  const { data, error } = await supabase
    .from('audit_logs')
    .select('entity_id, details, created_at')
    .eq('module', 'services')
    .eq('entity_type', 'service_job')
    .in('entity_id', jobIds)
    .order('created_at', { ascending: false });

  if (error || !data?.length) return new Map<string, 'paid' | 'unpaid'>();

  const overrides = new Map<string, 'paid' | 'unpaid'>();
  for (const row of data) {
    if (overrides.has(row.entity_id)) continue;
    const details = toRecord(row.details);
    const paymentStatus = toRecord(details.payment_status).to;
    if (paymentStatus === 'paid' || paymentStatus === 'unpaid') {
      overrides.set(row.entity_id, paymentStatus);
    }
  }

  return overrides;
};

const determineFocus = (question: string) => {
  const lower = question.toLowerCase();
  return {
    payments: /paid|unpaid|payment|invoice|collected/.test(lower),
    revenue: /revenue|earn|earning|amount|sales|money|cash/.test(lower),
    schedules: /schedule|scheduled|booking|appointment|pending|upcoming|today|tomorrow/.test(lower),
    notes: /note|notes|issue|issues|wrote|written|message|messages|details/.test(lower),
    leads: /lead|leads|request|requests|enquiry|enquiries/.test(lower),
    customers: /customer|customers|client|clients|who/.test(lower),
  };
};

const buildFallbackAnswer = (
  question: string,
  snapshot: Record<string, unknown>,
  warning?: string | null
): OpsChatResponse => {
  const metrics = toRecord(snapshot.metrics);
  const pendingJobs = Array.isArray(snapshot.pendingJobs) ? snapshot.pendingJobs.length : 0;
  const paidJobs = Array.isArray(snapshot.paidJobs) ? snapshot.paidJobs.length : 0;
  const unpaidJobs = Array.isArray(snapshot.unpaidJobs) ? snapshot.unpaidJobs.length : 0;
  const noteMatches = Array.isArray(snapshot.noteMatches) ? snapshot.noteMatches : [];
  const retrievedContext = Array.isArray(snapshot.retrievedContext) ? snapshot.retrievedContext : [];

  const answerParts = [
    `${pendingJobs} pending scheduled job${pendingJobs === 1 ? '' : 's'} are currently open.`,
    `${paidJobs} job${paidJobs === 1 ? '' : 's'} are marked paid and ${unpaidJobs} remain unpaid.`,
    `Expected revenue today is ${String(metrics.expectedRevenueToday || 0)} and total expected revenue is ${String(metrics.expectedRevenueTotal || 0)}.`,
  ];

  if (/note|notes|issue|message|written|wrote/.test(question.toLowerCase()) && noteMatches.length) {
    answerParts.push(`I found ${noteMatches.length} note match${noteMatches.length === 1 ? '' : 'es'} related to your question.`);
  }

  return {
    answer: answerParts.join(' '),
    supportingFacts: [
      `${pendingJobs} pending jobs`,
      `${paidJobs} paid jobs`,
      `${unpaidJobs} unpaid jobs`,
      `Expected total revenue: ${String(metrics.expectedRevenueTotal || 0)}`,
      ...retrievedContext
        .slice(0, 2)
        .map((item) => {
          const record = toRecord(item);
          return `${readString(record.source)} | ${readString(record.customerName)} | ${readString(record.snippet)}`;
        }),
      ...(warning ? [warning] : []),
    ],
    followUpQuestions: [
      'Which unpaid jobs are scheduled next?',
      'Show me customer notes related to pet hair or smoke odor.',
      'Who requested pickup or drop-off service recently?',
      'Who has already paid and what service did they book?',
    ],
    mode: 'fallback',
    warning: warning || null,
  };
};

const scoreRetrievalDocument = (
  document: Omit<RetrievalDocument, 'score'>,
  searchTerms: string[],
  question: string,
  focus: ReturnType<typeof determineFocus>
) => {
  const haystack = `${document.customerName} ${document.serviceType || ''} ${document.tags.join(' ')} ${document.text}`.toLowerCase();
  const normalizedQuestion = question.toLowerCase();
  let score = 0;

  if (normalizedQuestion.length >= 8 && haystack.includes(normalizedQuestion)) {
    score += 12;
  }

  const matchedTerms = new Set<string>();
  for (const term of searchTerms) {
    if (!term) continue;
    if (haystack.includes(term)) {
      matchedTerms.add(term);
      score += document.tags.some((tag) => tag.includes(term)) ? 5 : 3;
    }
  }

  if (!matchedTerms.size && searchTerms.length) return 0;

  if (focus.notes && ['job_note', 'client_note', 'lead_intake', 'enquiry_message'].includes(document.source)) {
    score += 3;
  }

  if ((focus.schedules || focus.leads) && ['lead_pickup', 'job_pickup', 'lead_intake'].includes(document.source)) {
    score += 3;
  }

  if (focus.payments && /paid|unpaid|payment/.test(haystack)) {
    score += 2;
  }

  return score + getRecencyBoost(document.createdAt);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  try {
    const supabase = getSupabaseAdmin();
    const auth = await getAuthContext(req, supabase);
    if (!auth) return unauthorized(res);
    if (!hasPermission(auth, 'dashboard', 'read')) return forbidden(res);

    const opsEnabled = await isFeatureEnabled(supabase, 'ops_v1_enabled', true);
    if (!opsEnabled) return forbidden(res);

    const question = normalizeQuestion(readString(req.body?.question));
    if (!question) return badRequest(res, 'question is required');

    const history = Array.isArray(req.body?.history)
      ? (req.body.history as ChatMessageInput[])
          .map((message) => ({
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: normalizeQuestion(readString(message.content)),
          }))
          .filter((message) => message.content)
          .slice(-6)
      : [];

    const servicesContent = await getServicesContentForBooking();
    const focus = determineFocus(question);
    const historyQuestionContext = history
      .filter((message) => message.role === 'user')
      .slice(-2)
      .map((message) => message.content)
      .join(' ');
    const searchTokens = tokenizeQuestion(`${historyQuestionContext} ${question}`);
    const searchTerms = expandSearchTerms(question, searchTokens);

    let jobsQuery = supabase
      .from('service_jobs')
      .select('*')
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(250);

    let leadsQuery = supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(150);

    let clientsQuery = supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(150);

    let enquiriesQuery = supabase
      .from('enquiries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(150);

    if (focus.payments && !focus.notes && !focus.leads) {
      jobsQuery = jobsQuery.limit(120);
      clientsQuery = clientsQuery.limit(60);
      leadsQuery = leadsQuery.limit(60);
      enquiriesQuery = enquiriesQuery.limit(60);
    }

    const [
      { data: rawJobs, error: jobsError },
      { data: rawLeads, error: leadsError },
      { data: rawClients, error: clientsError },
      { data: rawEnquiries, error: enquiriesError },
    ] = await Promise.all([jobsQuery, leadsQuery, clientsQuery, enquiriesQuery]);

    if (jobsError) throw new Error(jobsError.message);
    if (leadsError) throw new Error(leadsError.message);
    if (clientsError) throw new Error(clientsError.message);
    if (enquiriesError) throw new Error(enquiriesError.message);

    const jobs = (rawJobs || []).map((job) => {
      const estimatedAmount =
        Number(job.estimated_amount || 0) ||
        estimateServiceAmount(
          servicesContent,
          readString(job.service_catalog_id) || null,
          readStringArray(job.service_addon_ids),
          readString(job.service_type) || null
        ) ||
        0;

      return {
        ...job,
        estimated_amount: estimatedAmount,
      };
    });

    const paymentOverrides = await loadPaymentStatusOverrides(
      supabase,
      jobs.map((job) => readString(job.id)).filter(Boolean)
    );

    const hydratedJobs = jobs.map((job) => ({
      ...job,
      payment_status:
        (readString(job.payment_status) === 'paid' || readString(job.payment_status) === 'unpaid'
          ? readString(job.payment_status)
          : '') ||
        paymentOverrides.get(readString(job.id)) ||
        'unpaid',
    }));

    const now = Date.now();
    const pendingJobs = hydratedJobs
      .filter((job) => !['completed', 'cancelled'].includes(readString(job.status)))
      .sort((a, b) => new Date(readString(a.scheduled_at) || 0).getTime() - new Date(readString(b.scheduled_at) || 0).getTime());

    const paidJobs = hydratedJobs
      .filter((job) => readString(job.payment_status) === 'paid')
      .sort((a, b) => new Date(readString(b.updated_at) || 0).getTime() - new Date(readString(a.updated_at) || 0).getTime());

    const unpaidJobs = hydratedJobs
      .filter((job) => readString(job.payment_status) !== 'paid')
      .sort((a, b) => new Date(readString(a.scheduled_at) || 0).getTime() - new Date(readString(b.scheduled_at) || 0).getTime());

    const upcomingJobs = pendingJobs.filter((job) => {
      const scheduledAt = readString(job.scheduled_at);
      return !scheduledAt || new Date(scheduledAt).getTime() >= now - 60_000;
    });

    const openRequestLeads = (rawLeads || []).filter((lead) => {
      const status = readString(lead.status);
      return readString(lead.booking_mode) === 'request' && ['lead', 'contacted', 'quoted'].includes(status);
    });

    const retrievalDocuments: RetrievalDocument[] = [];
    const noteMatches: NoteMatch[] = [];
    for (const client of rawClients || []) {
      const notes = readString(client.notes);
      if (!notes) continue;
      const document = {
        id: `client:${readString(client.id)}`,
        source: 'client_note' as const,
        customerName: readString(client.name) || 'Unknown client',
        serviceType: null,
        createdAt: readString(client.updated_at) || readString(client.created_at) || null,
        text: notes,
        snippet: buildSnippet(notes, searchTerms),
        tags: ['client', 'note', ...(readStringArray(client.tags) || [])],
      };
      const score = scoreRetrievalDocument(document, searchTerms, question, focus);
      if (score > 0 || !searchTerms.length) {
        retrievalDocuments.push({ ...document, score });
      }
    }

    for (const job of hydratedJobs) {
      const notes = readString(job.notes);
      if (notes) {
        const document = {
          id: `job-note:${readString(job.id)}`,
          source: 'job_note' as const,
          customerName: readString(job.client_name) || 'Unknown customer',
          serviceType: readString(job.service_type) || null,
          createdAt: readString(job.updated_at) || readString(job.created_at) || null,
          text: notes,
          snippet: buildSnippet(notes, searchTerms),
          tags: [
            'job',
            'note',
            readString(job.status),
            readString(job.payment_status),
            readString(job.vehicle_make),
            readString(job.vehicle_model),
          ].filter(Boolean),
        };
        const score = scoreRetrievalDocument(document, searchTerms, question, focus);
        if (score > 0 || !searchTerms.length) {
          retrievalDocuments.push({ ...document, score });
        }
      }

      if (job.pickup_requested || Object.keys(toRecord(job.pickup_address)).length) {
        const pickupAddress = toRecord(job.pickup_address);
        const pickupText = [
          'Pickup requested',
          readString(pickupAddress.addressLine1),
          readString(pickupAddress.city),
          readString(pickupAddress.province),
          readString(pickupAddress.postalCode),
          readString(pickupAddress.notes),
          readString(job.notes),
        ]
          .filter(Boolean)
          .join(' | ');
        const document = {
          id: `job-pickup:${readString(job.id)}`,
          source: 'job_pickup' as const,
          customerName: readString(job.client_name) || 'Unknown customer',
          serviceType: readString(job.service_type) || null,
          createdAt: readString(job.updated_at) || readString(job.created_at) || null,
          text: pickupText,
          snippet: buildSnippet(pickupText, searchTerms),
          tags: ['pickup', 'dropoff', 'address', readString(job.status)].filter(Boolean),
        };
        const score = scoreRetrievalDocument(document, searchTerms, question, focus);
        if (score > 0 || (!searchTerms.length && focus.schedules)) {
          retrievalDocuments.push({ ...document, score });
        }
      }
    }

    for (const lead of rawLeads || []) {
      const intake = toRecord(lead.intake_metadata);
      const noteBody = [
        readString(intake.notes),
        readString(intake.issueDetails),
        readString(intake.preferredSummary),
        readString(lead.service_type),
      ]
        .filter(Boolean)
        .join(' | ');
      if (noteBody) {
        const document = {
          id: `lead-intake:${readString(lead.id)}`,
          source: 'lead_intake' as const,
          customerName: readString(lead.name) || 'Unknown lead',
          serviceType: readString(lead.service_type) || null,
          createdAt: readString(lead.updated_at) || readString(lead.created_at) || null,
          text: noteBody,
          snippet: buildSnippet(noteBody, searchTerms),
          tags: ['lead', 'intake', 'request', readString(lead.status), readString(lead.booking_mode)].filter(Boolean),
        };
        const score = scoreRetrievalDocument(document, searchTerms, question, focus);
        if (score > 0 || !searchTerms.length) {
          retrievalDocuments.push({ ...document, score });
        }
      }

      if (Boolean(intake.pickupRequested) || Object.keys(toRecord(intake.pickupAddress)).length) {
        const pickupAddress = toRecord(intake.pickupAddress);
        const pickupText = [
          'Pickup requested',
          readString(intake.preferredSummary),
          readString(pickupAddress.addressLine1),
          readString(pickupAddress.city),
          readString(pickupAddress.province),
          readString(pickupAddress.postalCode),
          readString(pickupAddress.notes),
        ]
          .filter(Boolean)
          .join(' | ');
        const document = {
          id: `lead-pickup:${readString(lead.id)}`,
          source: 'lead_pickup' as const,
          customerName: readString(lead.name) || 'Unknown lead',
          serviceType: readString(lead.service_type) || null,
          createdAt: readString(lead.updated_at) || readString(lead.created_at) || null,
          text: pickupText,
          snippet: buildSnippet(pickupText, searchTerms),
          tags: ['lead', 'pickup', 'dropoff', 'address', 'request', readString(lead.status)].filter(Boolean),
        };
        const score = scoreRetrievalDocument(document, searchTerms, question, focus);
        if (score > 0 || (!searchTerms.length && focus.schedules)) {
          retrievalDocuments.push({ ...document, score });
        }
      }
    }

    for (const enquiry of rawEnquiries || []) {
      const message = readString(enquiry.message);
      const metadata = toRecord(enquiry.metadata);
      const pickup = toRecord(metadata.pickup);
      const enquiryBody = [
        message,
        readString(metadata.issueDetails),
        readString(metadata.notes),
        readString(metadata.preferredSummary),
        readString(enquiry.service_type),
      ]
        .filter(Boolean)
        .join(' | ');

      if (enquiryBody) {
        const document = {
          id: `enquiry:${readString(enquiry.id)}`,
          source: 'enquiry_message' as const,
          customerName: readString(enquiry.name) || 'Unknown enquiry',
          serviceType: readString(enquiry.service_type) || null,
          createdAt: readString(enquiry.updated_at) || readString(enquiry.created_at) || null,
          text: enquiryBody,
          snippet: buildSnippet(enquiryBody, searchTerms),
          tags: [
            'enquiry',
            'message',
            readString(enquiry.status),
            readString(enquiry.booking_mode),
            readString(enquiry.source_page),
          ].filter(Boolean),
        };
        const score = scoreRetrievalDocument(document, searchTerms, question, focus);
        if (score > 0 || !searchTerms.length) {
          retrievalDocuments.push({ ...document, score });
        }
      }

      if (Object.keys(pickup).length) {
        const pickupText = [
          'Pickup requested',
          readString(pickup.addressLine1),
          readString(pickup.city),
          readString(pickup.province),
          readString(pickup.postalCode),
          readString(pickup.notes),
        ]
          .filter(Boolean)
          .join(' | ');
        const document = {
          id: `enquiry-pickup:${readString(enquiry.id)}`,
          source: 'lead_pickup' as const,
          customerName: readString(enquiry.name) || 'Unknown enquiry',
          serviceType: readString(enquiry.service_type) || null,
          createdAt: readString(enquiry.updated_at) || readString(enquiry.created_at) || null,
          text: pickupText,
          snippet: buildSnippet(pickupText, searchTerms),
          tags: ['pickup', 'dropoff', 'address', 'enquiry'].filter(Boolean),
        };
        const score = scoreRetrievalDocument(document, searchTerms, question, focus);
        if (score > 0 || (!searchTerms.length && focus.schedules)) {
          retrievalDocuments.push({ ...document, score });
        }
      }
    }

    const rankedRetrievalDocuments = retrievalDocuments
      .filter((document) => document.text.trim())
      .sort((a, b) => b.score - a.score || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, searchTerms.length ? 12 : 8);

    for (const document of rankedRetrievalDocuments) {
      if (!['job_note', 'client_note', 'lead_intake'].includes(document.source)) continue;
      noteMatches.push({
        source:
          document.source === 'job_note'
            ? 'job'
            : document.source === 'client_note'
              ? 'client'
              : 'lead',
        customerName: document.customerName,
        serviceType: document.serviceType || null,
        summary: document.snippet,
        createdAt: document.createdAt || null,
      });
    }

    const topRevenueJobs = hydratedJobs
      .slice()
      .sort((a, b) => Number(b.estimated_amount || 0) - Number(a.estimated_amount || 0))
      .slice(0, 8);

    const sourceSnapshot = {
      question,
      focus,
      conversationHistory: history,
      metrics: {
        pendingJobCount: pendingJobs.length,
        upcomingJobCount: upcomingJobs.length,
        paidJobCount: paidJobs.length,
        unpaidJobCount: unpaidJobs.length,
        openRequestCount: openRequestLeads.length,
        activeCustomerCount: new Set(hydratedJobs.map((job) => readString(job.client_id)).filter(Boolean)).size,
        pickupRequestCount: [
          ...hydratedJobs.filter((job) => Boolean(job.pickup_requested)),
          ...openRequestLeads.filter((lead) => Boolean(toRecord(lead.intake_metadata).pickupRequested)),
        ].length,
        retrievedDocumentCount: rankedRetrievalDocuments.length,
        expectedRevenueToday: hydratedJobs
          .filter((job) => {
            const scheduledAt = readString(job.scheduled_at);
            if (!scheduledAt) return false;
            const date = new Date(scheduledAt);
            const today = new Date();
            return (
              date.getFullYear() === today.getFullYear() &&
              date.getMonth() === today.getMonth() &&
              date.getDate() === today.getDate() &&
              readString(job.status) !== 'cancelled'
            );
          })
          .reduce((sum, job) => sum + Number(job.estimated_amount || 0), 0),
        expectedRevenueTotal: hydratedJobs
          .filter((job) => readString(job.status) !== 'cancelled')
          .reduce((sum, job) => sum + Number(job.estimated_amount || 0), 0),
      },
      pendingJobs: pendingJobs.slice(0, 10).map((job) => ({
        id: readString(job.id),
        customerName: readString(job.client_name),
        serviceType: readString(job.service_type),
        scheduledAt: readString(job.scheduled_at) || null,
        paymentStatus: readString(job.payment_status),
        amount: Number(job.estimated_amount || 0),
        notes: readString(job.notes) || null,
      })),
      paidJobs: paidJobs.slice(0, 10).map((job) => ({
        id: readString(job.id),
        customerName: readString(job.client_name),
        serviceType: readString(job.service_type),
        scheduledAt: readString(job.scheduled_at) || null,
        amount: Number(job.estimated_amount || 0),
        notes: readString(job.notes) || null,
      })),
      unpaidJobs: unpaidJobs.slice(0, 10).map((job) => ({
        id: readString(job.id),
        customerName: readString(job.client_name),
        serviceType: readString(job.service_type),
        scheduledAt: readString(job.scheduled_at) || null,
        amount: Number(job.estimated_amount || 0),
        notes: readString(job.notes) || null,
      })),
      openRequestLeads: openRequestLeads.slice(0, 8).map((lead) => {
        const intake = toRecord(lead.intake_metadata);
        return {
          id: readString(lead.id),
          customerName: readString(lead.name),
          serviceType: readString(lead.service_type),
          createdAt: readString(lead.created_at),
          preferredSummary: readString(intake.preferredSummary) || null,
          issueDetails: readString(intake.issueDetails) || null,
        };
      }),
      noteMatches: noteMatches
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, focus.notes || searchTokens.length ? 10 : 4),
      retrievedContext: rankedRetrievalDocuments.slice(0, 8).map((document) => ({
        id: document.id,
        source: sourceLabel(document.source),
        customerName: document.customerName,
        serviceType: document.serviceType || null,
        createdAt: document.createdAt || null,
        score: document.score,
        snippet: document.snippet,
        tags: document.tags.slice(0, 6),
      })),
      topRevenueJobs: topRevenueJobs.map((job) => ({
        customerName: readString(job.client_name),
        serviceType: readString(job.service_type),
        amount: Number(job.estimated_amount || 0),
        paymentStatus: readString(job.payment_status),
      })),
    };

    const settings = await getAiSettings(supabase);
    const providerConfig = getProviderConfig(settings);
    if (!settings.enabled || !providerConfig.apiKey) {
      return res.status(200).json(
        buildFallbackAnswer(question, sourceSnapshot, providerConfig.apiKey ? 'AI chat is disabled in settings.' : providerConfig.missingApiKeyMessage)
      );
    }

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      instructions:
        'You are an internal operations copilot for a premium car detailing business. Answer only from the supplied source snapshot and recent conversation. Prioritize retrievedContext when the question is about notes, messages, pickup requests, or fuzzy customer details. Do not invent customers, payments, notes, counts, or revenue. If the snapshot is insufficient, say exactly what is missing. Keep answers concise, operational, and factual.',
      input: `Conversation history:\n${JSON.stringify(history, null, 2)}\n\nCurrent question:\n${question}\n\nSource snapshot:\n${JSON.stringify(sourceSnapshot, null, 2)}`,
      text: {
        format: {
          type: 'json_schema',
          name: 'ops_chat_answer',
          strict: true,
          schema: chatAnswerJsonSchema,
        },
      },
    };

    if (providerConfig.includeStoreFlag) {
      requestBody.store = false;
    }

    try {
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
          readString(
            payload.error && typeof payload.error === 'object'
              ? (payload.error as Record<string, unknown>).message
              : ''
          ) ||
          response.statusText ||
          providerConfig.requestFailureMessage;
        return res.status(200).json(buildFallbackAnswer(question, sourceSnapshot, message));
      }

      const outputText = extractResponseOutputText(payload);
      if (!outputText) {
        return res.status(200).json(buildFallbackAnswer(question, sourceSnapshot, 'AI provider returned no structured content.'));
      }

      const parsed = JSON.parse(outputText) as Record<string, unknown>;
      const answer = readString(parsed.answer);
      const supportingFacts = readStringArray(parsed.supportingFacts).slice(0, 6);
      const followUpQuestions = readStringArray(parsed.followUpQuestions).slice(0, 4);

      return res.status(200).json({
        answer: answer || buildFallbackAnswer(question, sourceSnapshot).answer,
        supportingFacts,
        followUpQuestions,
        mode: 'ai',
      } satisfies OpsChatResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI chat failed';
      return res.status(200).json(buildFallbackAnswer(question, sourceSnapshot, message));
    }
  } catch (error) {
    return serverError(res, error);
  }
}
