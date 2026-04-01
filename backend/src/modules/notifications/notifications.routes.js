// src/modules/notifications/notifications.routes.js
import { authenticate }  from '../../middleware/authenticate.js';
import { saveFcmToken, sendToUser }  from '../../services/notifications.js';

export async function notificationsRoutes(fastify) {
  // Mobile app calls this on every app open with latest token
  fastify.post('/token', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', minLength: 10 },
        },
        additionalProperties: false,
      }
    },
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (req, reply) => {
    await saveFcmToken(req.user.sub, req.body.token);
    return reply.send({ success: true });
  });

  // Internal endpoint for Celery workers to trigger notifications
  fastify.post('/internal/notify', {
    schema: {
      body: {
        type: 'object',
        required: ['user_id', 'title', 'body'],
        properties: {
          user_id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          body: { type: 'string' },
          data: { type: 'object' },
        },
        additionalProperties: false,
      }
    }
  }, async (req, reply) => {
    // Basic protection using a shared secret
    const secret = req.headers['x-ai-shared-secret'];
    if (secret !== process.env.AI_SHARED_SECRET) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { user_id, title, body, data } = req.body;
    
    // Fire and forget
    sendToUser(user_id, { title, body, data }).catch(err => {
      req.log.error(`Internal notification failed for user ${user_id}: ${err.message}`);
    });

    return reply.send({ success: true, message: 'Notification queued' });
  });
}
