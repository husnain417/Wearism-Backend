export const envSchema = {
  type: 'object',
  required: ['PORT', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'],
  properties: {
    PORT: { type: 'integer', default: 3000 },
    NODE_ENV: { type: 'string', default: 'development' },
    SUPABASE_URL: { type: 'string' },
    SUPABASE_ANON_KEY: { type: 'string' },
    SUPABASE_SERVICE_ROLE_KEY: { type: 'string' },
    JWT_SECRET: { type: 'string' },
    AI_SERVICE_URL: { type: 'string', default: 'http://localhost:8000' },
    CLOUDINARY_URL: { type: 'string' }
  }
};
