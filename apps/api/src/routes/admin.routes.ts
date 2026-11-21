import { Router } from 'express';
import { z } from 'zod';
import {
  AiProviderSchema,
  AiRoutingSchema,
  AiSettingsUpdateSchema,
  MessageStatusSchema,
  ProfileUpdateSchema,
  ProjectInputSchema,
  PublicationInputSchema,
  SkillInputSchema,
  UiDisplayConfigSchema,
  type AiProvider,
} from '@portfolio/shared';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  getAiRouting,
  getAvailableProviders,
  runLlm,
  saveAiRouting,
} from '../services/llm-router.service.js';
import { triggerWebRevalidation } from '../services/revalidate.service.js';
import {
  clearUiGenerationLogs,
  deleteSavedUiTemplate,
  evolvePortfolioUi,
  getPortfolioUiState,
  getSavedUiTemplateByEpoch,
  getUiDisplayAdminData,
  getUiGenerationLogs,
  saveUiDisplayConfig,
} from '../services/ui-evolution.service.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

// ---------- Overview ----------
adminRouter.get('/overview', async (_req, res, next) => {
  try {
    const [skills, projects, publications, unreadMessages] = await Promise.all([
      supabaseAdmin.from('skills').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('projects').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('publications').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('contact_messages').select('id', { count: 'exact', head: true }).eq('status', 'unread'),
    ]);
    res.json({
      skillsCount: skills.count ?? 0,
      projectsCount: projects.count ?? 0,
      publicationsCount: publications.count ?? 0,
      unreadMessagesCount: unreadMessages.count ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

// ---------- Profile ----------
adminRouter.get('/profile', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('site_profile').select('*').eq('slug', 'main').single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/profile', validateBody(ProfileUpdateSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_profile')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('slug', 'main')
      .select()
      .single();
    if (error) throw error;
    await triggerWebRevalidation();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ---------- Skills ----------
adminRouter.get('/skills', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('skills').select('*').order('sort_order', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/skills', validateBody(SkillInputSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('skills').insert(req.body).select().single();
    if (error) throw error;
    await triggerWebRevalidation();
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/skills/:id', validateBody(SkillInputSchema.partial()), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('skills').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    await triggerWebRevalidation();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/skills/:id', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('skills').delete().eq('id', req.params.id);
    if (error) throw error;
    await triggerWebRevalidation();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---------- Projects ----------
adminRouter.get('/projects', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('projects').select('*').order('sort_order', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/projects', validateBody(ProjectInputSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('projects').insert(req.body).select().single();
    if (error) throw error;
    await triggerWebRevalidation();
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/projects/:id', validateBody(ProjectInputSchema.partial()), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    await triggerWebRevalidation();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/projects/:id', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('projects').delete().eq('id', req.params.id);
    if (error) throw error;
    await triggerWebRevalidation();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---------- Publications ----------
adminRouter.get('/publications', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('publications')
      .select('*')
      .order('published_year', { ascending: false })
      .order('sort_order', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/publications', validateBody(PublicationInputSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('publications').insert(req.body).select().single();
    if (error) throw error;
    await triggerWebRevalidation();
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/publications/:id', validateBody(PublicationInputSchema.partial()), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('publications')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    await triggerWebRevalidation();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/publications/:id', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('publications').delete().eq('id', req.params.id);
    if (error) throw error;
    await triggerWebRevalidation();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---------- Contact Messages ----------
adminRouter.get('/messages', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch(
  '/messages/:id',
  validateBody(z.object({ status: MessageStatusSchema })),
  async (req, res, next) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('contact_messages')
        .update({ status: req.body.status })
        .eq('id', req.params.id)
        .select()
        .single();
      if (error) throw error;
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

adminRouter.delete('/messages/:id', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from('contact_messages').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---------- AI Settings ----------
adminRouter.get('/ai-settings', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('ai_settings').select('*').eq('slug', 'default').single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/ai-settings', validateBody(AiSettingsUpdateSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_settings')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('slug', 'default')
      .select()
      .single();
    if (error) throw error;
    await triggerWebRevalidation();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ---------- Signed Upload URL for Supabase Storage ----------
adminRouter.post(
  '/upload-url',
  validateBody(z.object({ path: z.string().min(3).max(150).regex(/^[a-zA-Z0-9/._-]+$/) })),
  async (req, res, next) => {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from('portfolio-assets')
        .createSignedUploadUrl(req.body.path);
      if (error) throw error;
      const { data: publicData } = supabaseAdmin.storage.from('portfolio-assets').getPublicUrl(req.body.path);
      res.json({ signedUrl: data.signedUrl, token: data.token, publicUrl: publicData.publicUrl });
    } catch (err) {
      next(err);
    }
  }
);

// ---------- Self-Evolving UI State ----------
adminRouter.get('/ui-state', async (_req, res, next) => {
  try {
    const state = await getPortfolioUiState();
    res.json(state ?? null);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch(
  '/ui-state',
  validateBody(
    z.object({
      auto_evolve: z.boolean().optional(),
      cooldown_sec: z.number().int().min(10).max(86400).optional(),
      show_ai_bar: z.boolean().optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const { show_ai_bar, ...columnFields } = req.body;
      const updatePayload: Record<string, unknown> = {
        ...columnFields,
        updated_at: new Date().toISOString(),
      };

      if (typeof show_ai_bar === 'boolean') {
        const { data: existing } = await supabaseAdmin
          .from('portfolio_ui_state')
          .select('blueprint')
          .eq('slug', 'default')
          .maybeSingle();
        const existingBp =
          existing?.blueprint && typeof existing.blueprint === 'object'
            ? (existing.blueprint as Record<string, unknown>)
            : {};
        updatePayload.blueprint = { ...existingBp, show_ai_bar };
      }

      const { error } = await supabaseAdmin
        .from('portfolio_ui_state')
        .update(updatePayload)
        .eq('slug', 'default');
      if (error) throw error;
      await triggerWebRevalidation();
      const updated = await getPortfolioUiState();
      res.json(updated ?? null);
    } catch (err) {
      next(err);
    }
  }
);

adminRouter.post(
  '/ui-state/evolve',
  validateBody(z.object({ prompt: z.string().max(1000).optional() }).default({})),
  async (req, res, next) => {
    try {
      const updated = await evolvePortfolioUi(true, req.body.prompt);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

adminRouter.get('/ui-state/logs', async (_req, res, next) => {
  try {
    const logs = await getUiGenerationLogs();
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/ui-state/logs', async (_req, res, next) => {
  try {
    await clearUiGenerationLogs();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/ui-state/templates', async (_req, res, next) => {
  try {
    const data = await getUiDisplayAdminData();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/ui-state/templates/:epoch', async (req, res, next) => {
  try {
    const epoch = Number(req.params.epoch);
    if (!Number.isInteger(epoch) || epoch <= 0) {
      res.status(400).json({ error: 'Invalid epoch number' });
      return;
    }
    const template = await getSavedUiTemplateByEpoch(epoch);
    if (!template) {
      res.status(404).json({ error: 'Saved UI template not found' });
      return;
    }
    res.json(template);
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/ui-state/display', validateBody(UiDisplayConfigSchema), async (req, res, next) => {
  try {
    const data = await saveUiDisplayConfig(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/ui-state/templates/:epoch', async (req, res, next) => {
  try {
    const epoch = Number(req.params.epoch);
    if (!Number.isInteger(epoch) || epoch <= 0) {
      res.status(400).json({ error: 'Invalid epoch number' });
      return;
    }
    const data = await deleteSavedUiTemplate(epoch);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ---------- AI Provider Routing ----------
adminRouter.get('/ai-routing', async (_req, res, next) => {
  try {
    const routing = await getAiRouting();
    res.json({
      routing,
      providers: getAvailableProviders(),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/ai-routing', validateBody(AiRoutingSchema), async (req, res, next) => {
  try {
    const routing = await saveAiRouting(req.body);
    res.json({
      routing,
      providers: getAvailableProviders(),
    });
  } catch (err) {
    next(err);
  }
});

// ---------- Live AI Health & Response Test ----------
adminRouter.post(
  '/ai-test',
  validateBody(
    z
      .object({
        prompt: z.string().max(500).optional(),
        provider: AiProviderSchema.optional(),
        model: z.string().min(2).max(120).optional(),
      })
      .default({}),
  ),
  async (req, res) => {
    const started = Date.now();
    const routing = await getAiRouting();
    const provider: AiProvider = req.body.provider ?? routing.chat_provider;
    const modelName =
      req.body.model?.trim() ||
      (provider === routing.chat_provider
        ? routing.chat_model
        : provider === 'gemini'
          ? 'gemini-3.5-flash-lite'
          : 'openai/gpt-oss-20b:free');

    const available = getAvailableProviders();
    if (!available[provider]) {
      res.json({
        ok: false,
        provider,
        model: modelName,
        latencyMs: Date.now() - started,
        error: `API key for "${provider}" is not configured in apps/api/.env`,
      });
      return;
    }

    const testPrompt =
      req.body.prompt?.trim() ||
      `Reply in one short sentence confirming ${provider} (${modelName}) is live and ready for this portfolio.`;

    try {
      const { text, usage } = await runLlm({
        provider,
        model: modelName,
        prompt: testPrompt,
        timeoutMs: 25_000,
        maxRetries: 1,
      });
      res.json({
        ok: true,
        provider,
        model: modelName,
        latencyMs: Date.now() - started,
        reply: text,
        usage,
      });
    } catch (err) {
      res.json({
        ok: false,
        provider,
        model: modelName,
        latencyMs: Date.now() - started,
        error: err instanceof Error ? err.message : 'AI request failed',
      });
    }
  }
);
