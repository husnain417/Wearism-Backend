import { authenticate } from '../../../middleware/authenticate.js';
import { requireVendor } from '../../../middleware/requireVendor.js';
import { campaignsController } from './campaigns.controller.js';
import {
  createCampaignSchema,
  updateCampaignSchema,
  listMyCampaignsSchema,
  trackCampaignEventSchema,
} from './campaigns.schema.js';

export async function campaignsRoutes(fastify) {
  // Vendor CRUD
  fastify.post('/', {
    preHandler: [authenticate, requireVendor],
    schema: { ...createCampaignSchema, tags: ['Marketplace'], summary: 'Create a campaign (vendor only)' },
    config: { rateLimit: { max: 50, timeWindow: '1 hour' } },
  }, campaignsController.create);

  fastify.get('/me', {
    preHandler: [authenticate, requireVendor],
    schema: { ...listMyCampaignsSchema, tags: ['Marketplace'], summary: 'List own campaigns (vendor only)' },
  }, campaignsController.listMine);

  fastify.get('/me/:id', {
    preHandler: [authenticate, requireVendor],
    schema: { tags: ['Marketplace'], summary: 'Get a single own campaign (vendor only)' },
  }, campaignsController.getMine);

  fastify.patch('/:id', {
    preHandler: [authenticate, requireVendor],
    schema: { ...updateCampaignSchema, tags: ['Marketplace'], summary: 'Update own campaign (vendor only)' },
  }, campaignsController.update);

  fastify.patch('/:id/activate', {
    preHandler: [authenticate, requireVendor],
    schema: { tags: ['Marketplace'], summary: 'Activate campaign' },
  }, campaignsController.activate);

  fastify.patch('/:id/pause', {
    preHandler: [authenticate, requireVendor],
    schema: { tags: ['Marketplace'], summary: 'Pause campaign' },
  }, campaignsController.pause);

  fastify.patch('/:id/end', {
    preHandler: [authenticate, requireVendor],
    schema: { tags: ['Marketplace'], summary: 'End campaign' },
  }, campaignsController.end);

  fastify.get('/:id/stats', {
    preHandler: [authenticate, requireVendor],
    schema: { tags: ['Marketplace'], summary: 'Campaign KPIs (vendor only)' },
  }, campaignsController.stats);

  // User tracking (auth required)
  fastify.post('/:id/event', {
    preHandler: [authenticate],
    schema: { ...trackCampaignEventSchema, tags: ['Marketplace'], summary: 'Track campaign engagement event' },
    config: { rateLimit: { max: 600, timeWindow: '1 hour' } },
  }, campaignsController.trackEvent);
}

