import { storiesService } from './stories.service.js';

export const storiesController = {
    async listFeed(request, reply) {
        const stories = await storiesService.listFeedStories(request.user.sub);
        return reply.send({ success: true, stories });
    },

    async getStatus(request, reply) {
        const status = await storiesService.getStoryStatus(request.user.sub);
        return reply.send({ success: true, ...status });
    },

    async getStory(request, reply) {
        const story = await storiesService.getStory(request.params.id, request.user.sub);
        return reply.send({ success: true, story });
    },

    async createStory(request, reply) {
        const file = request.body?.file;
        const story = await storiesService.createStory(request.user.sub, request.body, file);
        return reply.status(201).send({ success: true, story });
    },

    async deleteStory(request, reply) {
        await storiesService.deleteStory(request.user.sub, request.params.id);
        return reply.send({ success: true, message: 'Story removed.' });
    },
};
