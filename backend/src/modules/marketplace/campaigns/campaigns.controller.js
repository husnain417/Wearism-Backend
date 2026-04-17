import { campaignsService } from './campaigns.service.js';

export const campaignsController = {
  async listActive(request, reply) {
    const limit = Number(request.query?.limit ?? 6);
    const campaigns = await campaignsService.listActiveCampaigns({ limit });
    return reply.send({ success: true, campaigns });
  },

  async getActive(request, reply) {
    const campaign = await campaignsService.getActiveCampaign(request.params.id);
    return reply.send({ success: true, campaign });
  },

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

  async uploadCover(request, reply) {
    const campaignId = request.params.id;

    // Multipart/form-data upload similar to products image flow.
    const isMultipart = request.isMultipart?.() === true;
    if (!isMultipart) {
      return reply.status(400).send({ success: false, error: 'multipart/form-data is required.' });
    }

    let filePart = (request.body || {})?.file;
    if (Array.isArray(filePart)) filePart = filePart[0];

    let buffer = null;
    let filename = `cover_${Date.now()}.jpg`;
    let contentType = 'image/jpeg';

    if (filePart && Buffer.isBuffer(filePart)) {
      buffer = filePart;
    }

    if (!buffer && filePart && typeof filePart.toBuffer === 'function') {
      buffer = await filePart.toBuffer();
      filename = filePart.filename || filename;
      contentType = filePart.mimetype || contentType;
    }

    if (!buffer) {
      try {
        filePart = await request.file();
      } catch {
        filePart = null;
      }
      if (filePart && typeof filePart.toBuffer === 'function') {
        buffer = await filePart.toBuffer();
        filename = filePart.filename || filename;
        contentType = filePart.mimetype || contentType;
      }
    }

    if (!buffer) {
      return reply.status(400).send({ success: false, error: 'Cover image file is required.' });
    }

    const userId = request.user.sub;
    const image_path = `${userId}/${campaignId}/${Date.now()}_${filename}`;

    const { supabase } = await import('../../../config/supabase.js');
    const { error: uploadError } = await supabase.storage
      .from('campaigns')
      .upload(image_path, buffer, { contentType, upsert: false });
    if (uploadError) throw uploadError;

    const { data: signed, error: signErr } = await supabase.storage
      .from('campaigns')
      .createSignedUrl(image_path, 60 * 60 * 24 * 365);
    if (signErr) throw signErr;

    const campaign = await campaignsService.updateCampaign(userId, campaignId, {
      cover_image_path: image_path,
      cover_image_url: signed?.signedUrl,
    });

    return reply.status(201).send({ success: true, campaign });
  },

  async trackEvent(request, reply) {
    const res = await campaignsService.trackEvent(request.user.sub, request.params.id, request.body || {});
    return reply.status(201).send({ success: true, ...res });
  },
};

