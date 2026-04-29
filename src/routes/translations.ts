import { FastifyPluginAsync } from "fastify";
import { ErrorCode, ErrorResponseSchema } from "../schemas/error";
import { apiAuthMiddleware } from "../middlewares/api_auth";
import logger from "../services/logger";
import translateText from "../translators";

export const apiTranslationRoutes: FastifyPluginAsync = async (app) => {
    app.post<{
        Body: {
            text: string;
        },
        Params: {
            sourceLanguage: string;
            targetLanguage: string;
        }
    }>(
        '/:sourceLanguage/:targetLanguage',
        {
            schema: {
                body: {
                    type: 'object',
                    required: ['text'],
                    properties: {
                        text: { type: 'string', },
                    },
                },
                response: {
                    200: {
                        type: 'object',
                        properties: {
                            translation: { type: 'string' },
                            reasoning: { type: 'string' },
                            engine: { type: 'string' },
                        }
                    },
                    400: ErrorResponseSchema,
                    403: ErrorResponseSchema,
                    500: ErrorResponseSchema,
                }
            },
            preHandler: [
                apiAuthMiddleware,
            ],
        },
        async (req, reply) => {
            try {
                const translation = await translateText(req.params.sourceLanguage, req.params.targetLanguage, req.body.text);

                return translation;
            } catch (error: Error | unknown) {
                logger.error(error, `Translation failed`);
            }

            return reply.status(500).send({
                error: {
                    name: ErrorCode.internalServerError,
                    message: `An internal server error has occured while attempting to translate given text.`
                }
            });
        },
    );
};