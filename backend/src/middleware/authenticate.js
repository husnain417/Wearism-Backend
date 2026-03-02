import { supabase } from '../config/supabase.js';

export async function authenticate(request, reply) {
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
            success: false,
            error: 'Missing or invalid authorization header.',
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Verify token with Supabase — this also checks expiry
        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data.user) {
            return reply.status(401).send({
                success: false,
                error: 'Token is invalid or has expired.',
            });
        }

        // Check if user has been soft-deleted (GDPR deletion in progress)
        const { data: profile } = await supabase
            .from('profiles')
            .select('deleted_at')
            .eq('id', data.user.id)
            .single();

        if (profile?.deleted_at) {
            return reply.status(403).send({
                success: false,
                error: 'This account has been deleted.',
            });
        }

        // Attach user to request — available in all route handlers
        request.user = {
            sub: data.user.id,       // user UUID — use this as FK everywhere
            email: data.user.email,
            role: data.user.role,
        };

    } catch (err) {
        request.log.error(err);
        return reply.status(401).send({
            success: false,
            error: 'Authentication failed.',
        });
    }
}
