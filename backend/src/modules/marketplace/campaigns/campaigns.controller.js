import { campaignsService } from './campaigns.service.js';

export const campaignsController = {
  async create(request, reply) {
    const campaign = await campaignsService.createCampaign(request.user.sub, request.body || {});
    return reply.status(201).send({ success: true, campaign });
  },

  async listMine(request, reply) {
    const campaigns = await campaignsService.listMyCampaigns(request.user.sub, request.query || {});
    return reply.send({ success: true, campaigns });
  },

  async getMine(request, reply) {
    const campaign = await campaignsService.getMyCampaign(request.user.sub, request.params.id);
    return reply.send({ success: true, campaign });
  },

  async update(request, reply) {
    const campaign = await campaignsService.updateCampaign(request.user.sub, request.params.id, request.body || {});
    return reply.send({ success: true, campaign });
  },

  async activate(request, reply) {
    const campaign = await campaignsService.setStatus(request.user.sub, request.params.id, 'active');
    return reply.send({ success: true, campaign });
  },

  async pause(request, reply) {
    const campaign = await campaignsService.setStatus(request.user.sub, request.params.id, 'paused');
    return reply.send({ success: true, campaign });
  },

  async end(request, reply) {
    const campaign = await campaignsService.setStatus(request.user.sub, request.params.id, 'ended');
    return reply.send({ success: true, campaign });
  },

  async stats(request, reply) {
    const stats = await campaignsService.getCampaignStats(request.user.sub, request.params.id);
    return reply.send({ success: true, ...stats });
  },

  async trackEvent(request, reply) {
    const res = await campaignsService.trackEvent(request.user.sub, request.params.id, request.body || {});
    return reply.status(201).send({ success: true, ...res });
  },
};

