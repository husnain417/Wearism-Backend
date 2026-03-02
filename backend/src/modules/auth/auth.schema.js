export const signupSchema = {
    body: {
        type: 'object',
        required: ['email', 'password', 'full_name', 'gdpr_consent'],
        properties: {
            email: { type: 'string', format: 'email', maxLength: 254 },
            password: { type: 'string', minLength: 8, maxLength: 72 },
            full_name: { type: 'string', minLength: 1, maxLength: 100 },
            // GDPR: consent must be explicitly true — not just present
            gdpr_consent: { type: 'boolean', enum: [true] },
        },
        additionalProperties: false,
    },
};

export const loginSchema = {
    body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
    },
};

export const refreshSchema = {
    body: {
        type: 'object',
        required: ['refresh_token'],
        properties: {
            refresh_token: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
    },
};

export const forgotPasswordSchema = {
    body: {
        type: 'object',
        required: ['email'],
        properties: {
            email: { type: 'string', format: 'email' },
        },
        additionalProperties: false,
    },
};
