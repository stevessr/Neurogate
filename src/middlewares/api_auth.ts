import { FastifyReply, FastifyRequest } from "fastify";
import prisma from "../services/prisma";
import logger from "../services/logger";

declare module "fastify" {
    interface FastifyRequest {
        apiKeyOwner: string;
    }
}

export async function apiAuthMiddleware(req: FastifyRequest, reply: FastifyReply) {
    try {
        const authorizationHeader = req.headers['authorization'];
        if (typeof authorizationHeader !== 'string' || !authorizationHeader.startsWith('Bearer ng-')) {
            throw new Error('Invalid authorization');
        }

        const secret = authorizationHeader.slice('Bearer '.length);

        const apiKey = await prisma.apiToken.findFirst({
            where: {
                secret,
            },
        });

        if (!apiKey) {
            throw new Error('Invalid API key');
        }

        req.apiKeyOwner = apiKey.owner;
    } catch (error: Error | unknown) {
        logger.warn(
            {
                module: 'auth',
                method: req.method,
                url: req.url,
                ip: req.ip,
            },
            `Authentication failed (missing or invalid API key)`
        );
        return reply.code(401).send({ error: 'Unauthorized' });
    }
}