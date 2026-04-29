import { FastifyPluginAsync } from "fastify";
import { ErrorCode, ErrorResponseSchema } from "../schemas/error";
import logger from "../services/logger";
import { resolveMatrixOpenId } from "../utils/matrix_openid";
import prisma from "../services/prisma";
import randomApiKeySecret from "../utils/random_api_key";

export const apiTokenRoutes: FastifyPluginAsync = async (app) => {
    app.post<{
        Body: {
            access_token: string;
            token_type: string;
            matrix_server_name: string;
            expires_in: number
        }
    }>('/get_token', {
        schema: {
            body: {
                type: 'object',
                required: ['access_token', 'token_type', 'matrix_server_name', 'expires_in'],
                properties: {
                    access_token: { type: 'string' },
                    token_type: { type: 'string' },
                    matrix_server_name: { type: 'string' },
                    expires_in: { type: 'number' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        token: { type: 'string' },
                        createdAt: { type: 'string' },
                        expiresAt: { type: 'string' },
                    }
                },
                400: ErrorResponseSchema,
                403: ErrorResponseSchema,
                500: ErrorResponseSchema,
            }
        }
    }, async (req, reply) => {
        let userId: string | null = null;
        try {
            userId = await resolveMatrixOpenId(req.body);
        } catch (error: Error | unknown) {
            logger.error(error, `Failed to resolve matrix openid`);
            return reply.status(403).send({
                error: {
                    name: ErrorCode.verificationFailed,
                    message: `Verification failed`
                }
            });
        }

        if (!userId) throw new Error(`This should not happen`);

        logger.info({
            module: 'auth',
            method: req.method,
            url: req.url,
            ip: req.ip,
            userId,
            msg: `${userId} requested a token`
        });

        const apiKey = await prisma.apiToken.upsert({
            where: { owner: userId },
            create: {
                secret: randomApiKeySecret(),
                owner: userId,
                expiresAt: new Date(Date.now() + (req.body.expires_in * 6e4)),
            },
            update: {
                secret: randomApiKeySecret(),
                expiresAt: new Date(Date.now() + (req.body.expires_in * 6e4)),
                createdAt: new Date(),
            },
        });

        return {
            token: apiKey.secret,
            createdAt: apiKey.createdAt.toISOString(),
            expiresAt: apiKey.expiresAt.toISOString(),
        };
    });
};