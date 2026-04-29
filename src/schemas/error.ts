export enum ErrorCode {
    bad_request = 'bad_request',
    forbidden = 'forbidden',
    verificationFailed = 'verificationFailed',
    internalServerError = 'internalServerError',
}

export const ErrorResponseSchema = {
    type: 'object',
    properties: {
        error: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object' },
            },
        },
    },
};