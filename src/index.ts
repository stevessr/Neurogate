import fastify from "fastify";
import config from "./services/config";

const app = fastify();



app.listen({
    port: config.apiPort,
}).then(() => {
    console.info(`Listening on ${config.apiPort}`);
});