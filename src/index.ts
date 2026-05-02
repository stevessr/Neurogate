import fastify from "fastify";
import config from "./services/config";
import { apiTokenRoutes } from "./routes/api_token";
import { apiTranslationRoutes } from "./routes/translations";

const app = fastify({
    logger: true,
});

app.register(apiTokenRoutes, { prefix: '/v1' });
app.register(apiTranslationRoutes, { prefix: '/v1/translations' });

app.listen({
    port: config.apiListenPort,
    host: config.apiListenHost,
}).then(() => {
    console.info(`Listening on ${config.apiListenHost}:${config.apiListenPort}`);
});