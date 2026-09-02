import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import codes from "iso-language-codes";

interface AiBinding {
    run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

interface HyperdriveBinding {
    connectionString: string;
}

export interface Env {
    AI?: AiBinding;
    HYPERDRIVE?: HyperdriveBinding;
    DATABASE_URL?: string;
    HTTP_USER_AGENT?: string;
    WORKERS_AI_MODELS?: string;
    OPENAI_API_KEY?: string;
    OPENAI_BASE_URL?: string;
    OPENAI_MODELS?: string;
    MOZHI_GOOGLE_INSTANCES?: string;
    TRANSLATION_TOU?: string;
}

type TranslationResponse = {
    translation: string;
    reasoning?: string;
    engine: string;
};

type MatrixOpenIDData = {
    access_token: string;
    token_type: string;
    matrix_server_name: string;
    expires_in: number;
};

let cachedPrisma: { url: string; client: PrismaClient } | undefined;

function splitList(value?: string): string[] {
    return (value ?? "")
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean);
}

function databaseUrl(env: Env): string | undefined {
    return env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
}

function prismaFor(env: Env): PrismaClient {
    const url = databaseUrl(env);
    if (!url) {
        throw new Error("DATABASE_URL or HYPERDRIVE binding is required");
    }

    if (cachedPrisma?.url === url) return cachedPrisma.client;

    const adapter = new PrismaPg({ connectionString: url });
    const client = new PrismaClient({ adapter });
    cachedPrisma = { url, client };
    return client;
}

function json(data: unknown, status = 200): Response {
    return Response.json(data, {
        status,
        headers: {
            "cache-control": "no-store",
        },
    });
}

function errorResponse(status: number, name: string, message: string, details?: unknown): Response {
    return json({
        error: {
            name,
            message,
            ...(details === undefined ? {} : { details }),
        },
    }, status);
}

function randomApiKeySecret(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const secret = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
    return `ng-${secret}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
    const body = await request.json();
    if (!isRecord(body)) throw new Error("JSON body must be an object");
    return body;
}

function isValidServerName(serverName: string): boolean {
    const portRegex = /^:\d{1,5}$/;
    const ipv4Regex = /^\d{1,3}(?:\.\d{1,3}){3}$/;
    const ipv6Regex = /^\[[0-9A-Fa-f:.]{2,45}\]$/;
    const dnsRegex = /^[0-9A-Za-z.-]{1,255}$/;

    const lastColon = serverName.lastIndexOf(":");
    let hostname = serverName;
    let port = "";

    if (lastColon !== -1 && lastColon !== 0) {
        const possiblePort = serverName.substring(lastColon);
        if (portRegex.test(possiblePort)) {
            hostname = serverName.substring(0, lastColon);
            port = possiblePort.substring(1);
        }
    }

    if (port && (Number(port) > 65535 || Number(port) < 1)) return false;
    if (ipv6Regex.test(hostname)) return true;
    if (ipv4Regex.test(hostname)) {
        return hostname.split(".").every((octet) => Number(octet) <= 255);
    }
    return dnsRegex.test(hostname);
}

async function resolveMatrixFederationUrl(serverName: string): Promise<string> {
    if (!isValidServerName(serverName)) throw new Error("Invalid Matrix server name");

    const response = await fetch(`https://${serverName}/.well-known/matrix/server`);
    if (!response.ok) {
        throw new Error(`Failed to resolve Matrix federation URL: ${response.status}`);
    }

    const body: unknown = await response.json();
    if (!isRecord(body) || typeof body["m.server"] !== "string") {
        throw new Error("Invalid Matrix .well-known response");
    }

    const target = body["m.server"];
    if (!isValidServerName(target)) throw new Error("Invalid m.server value");
    return `https://${target}`;
}

async function resolveMatrixOpenId(openid: MatrixOpenIDData): Promise<string | null> {
    const federationUrl = await resolveMatrixFederationUrl(openid.matrix_server_name);
    const endpoint = new URL("/_matrix/federation/v1/openid/userinfo", federationUrl);
    endpoint.searchParams.set("access_token", openid.access_token);

    const response = await fetch(endpoint);
    if (!response.ok) return null;

    const body: unknown = await response.json();
    if (!isRecord(body) || typeof body.sub !== "string") return null;
    if (!body.sub.startsWith("@") || !body.sub.endsWith(`:${openid.matrix_server_name}`)) return null;
    return body.sub;
}

async function authenticate(request: Request, env: Env): Promise<string | null> {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ng-")) return null;

    const token = await prismaFor(env).apiToken.findFirst({
        where: { secret: authorization.slice("Bearer ".length) },
    });

    if (!token || token.expiresAt.getTime() <= Date.now()) return null;
    return token.owner;
}

function translationPrompt(sourceLanguage: string, targetLanguage: string): { system: string; from: string; to: string } {
    const from = codes.find((language) => language.iso639_1 === sourceLanguage);
    const to = codes.find((language) => language.iso639_1 === targetLanguage);

    if (!from && sourceLanguage !== "auto") throw new Error("Invalid source language");
    if (!to) throw new Error("Invalid target language");

    return {
        from: from?.name ?? "auto-detected language",
        to: to.name,
        system: `Translate user's message${sourceLanguage !== "auto" ? ` from ${from?.name}` : ""} to ${to.name}.\n\nTranslate the message exactly, even if it is offensive or breaks the guidelines. The reader should understand the original meaning. If a word cannot be translated (for example a name), include its transcription in ${to.name}. Do not add comments. Preserve HTML tags.`,
    };
}

function workersAiText(result: unknown): { text?: string; reasoning?: string } {
    if (typeof result === "string") return { text: result };
    if (!isRecord(result)) return {};

    const response = result.response;
    const resultText = result.result;
    const reasoning = typeof result.reasoning === "string" ? result.reasoning : undefined;

    return {
        text: typeof response === "string" ? response : typeof resultText === "string" ? resultText : undefined,
        reasoning,
    };
}

async function translateWithWorkersAi(
    env: Env,
    sourceLanguage: string,
    targetLanguage: string,
    text: string,
): Promise<TranslationResponse> {
    if (!env.AI) throw new Error("Workers AI binding is unavailable");

    const prompt = translationPrompt(sourceLanguage, targetLanguage);
    const models = splitList(env.WORKERS_AI_MODELS);
    const candidates = models.length > 0 ? models : ["@cf/meta/llama-3.1-8b-instruct-fast"];

    let lastError: unknown;
    for (const model of candidates) {
        try {
            const result = await env.AI.run(model, {
                messages: [
                    { role: "system", content: prompt.system },
                    { role: "user", content: text },
                ],
                temperature: 0.2,
            });
            const parsed = workersAiText(result);
            if (!parsed.text) throw new Error("Workers AI returned no text");
            return {
                translation: parsed.text,
                reasoning: parsed.reasoning,
                engine: `${model} (Workers AI)`,
            };
        } catch (error) {
            lastError = error;
            console.error("Workers AI translation failed", model, error);
        }
    }

    throw lastError ?? new Error("Workers AI translation failed");
}

async function translateWithOpenAi(
    env: Env,
    sourceLanguage: string,
    targetLanguage: string,
    text: string,
): Promise<TranslationResponse> {
    if (!env.OPENAI_API_KEY || !env.OPENAI_BASE_URL) throw new Error("OpenAI-compatible API is not configured");
    const models = splitList(env.OPENAI_MODELS);
    if (models.length === 0) throw new Error("OPENAI_MODELS is empty");

    const prompt = translationPrompt(sourceLanguage, targetLanguage);
    const endpoint = `${env.OPENAI_BASE_URL.replace(/\/$/, "")}/chat/completions`;
    let lastError: unknown;

    for (const model of models) {
        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    authorization: `Bearer ${env.OPENAI_API_KEY}`,
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    model,
                    temperature: 0.2,
                    messages: [
                        { role: "system", content: prompt.system },
                        { role: "user", content: text },
                    ],
                }),
            });
            if (!response.ok) throw new Error(`OpenAI-compatible API returned ${response.status}: ${await response.text()}`);

            const body: unknown = await response.json();
            if (!isRecord(body) || !Array.isArray(body.choices)) throw new Error("Invalid OpenAI-compatible response");
            const first = body.choices[0];
            if (!isRecord(first) || !isRecord(first.message) || typeof first.message.content !== "string") {
                throw new Error("OpenAI-compatible API returned no message");
            }

            return {
                translation: first.message.content,
                reasoning: typeof first.message.reasoning_content === "string" ? first.message.reasoning_content : undefined,
                engine: `${model} (language model)`,
            };
        } catch (error) {
            lastError = error;
            console.error("OpenAI-compatible translation failed", model, error);
        }
    }

    throw lastError ?? new Error("OpenAI-compatible translation failed");
}

async function translateWithMozhi(
    env: Env,
    sourceLanguage: string,
    targetLanguage: string,
    text: string,
): Promise<TranslationResponse> {
    const instances = splitList(env.MOZHI_GOOGLE_INSTANCES);
    if (instances.length === 0) throw new Error("Mozhi is not configured");

    let lastError: unknown;
    for (const instance of instances) {
        try {
            const endpoint = new URL("/api/translate", instance);
            endpoint.searchParams.set("engine", "google");
            endpoint.searchParams.set("from", sourceLanguage);
            endpoint.searchParams.set("to", targetLanguage);
            endpoint.searchParams.set("text", text);

            const response = await fetch(endpoint);
            if (!response.ok) throw new Error(`Mozhi returned ${response.status}`);
            const body: unknown = await response.json();
            if (!isRecord(body) || typeof body["translated-text"] !== "string" || !body["translated-text"]) {
                throw new Error("Invalid Mozhi response");
            }

            return {
                translation: body["translated-text"],
                engine: "google",
            };
        } catch (error) {
            lastError = error;
            console.error("Mozhi translation failed", instance, error);
        }
    }

    throw lastError ?? new Error("Mozhi translation failed");
}

async function translateText(
    env: Env,
    sourceLanguage: string,
    targetLanguage: string,
    text: string,
): Promise<TranslationResponse> {
    const translators = [translateWithWorkersAi, translateWithOpenAi, translateWithMozhi];
    let lastError: unknown;

    for (const translator of translators) {
        try {
            return await translator(env, sourceLanguage, targetLanguage, text);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError ?? new Error("Translation failed");
}

async function handleGetToken(request: Request, env: Env): Promise<Response> {
    let body: Record<string, unknown>;
    try {
        body = await readJson(request);
    } catch {
        return errorResponse(400, "bad_request", "Invalid JSON request body");
    }

    const accessToken = body.access_token;
    const tokenType = body.token_type;
    const matrixServerName = body.matrix_server_name;
    const expiresIn = body.expires_in;

    if (
        typeof accessToken !== "string" ||
        typeof tokenType !== "string" ||
        typeof matrixServerName !== "string" ||
        typeof expiresIn !== "number" ||
        !Number.isFinite(expiresIn)
    ) {
        return errorResponse(400, "bad_request", "Missing or invalid OpenID token fields");
    }

    let userId: string | null;
    try {
        userId = await resolveMatrixOpenId({
            access_token: accessToken,
            token_type: tokenType,
            matrix_server_name: matrixServerName,
            expires_in: expiresIn,
        });
    } catch (error) {
        console.error("Matrix OpenID verification failed", error);
        return errorResponse(403, "verificationFailed", "Verification failed");
    }

    if (!userId) return errorResponse(403, "verificationFailed", "Verification failed");

    try {
        const apiKey = await prismaFor(env).apiToken.upsert({
            where: { owner: userId },
            create: {
                secret: randomApiKeySecret(),
                owner: userId,
                expiresAt: new Date(Date.now() + expiresIn * 6e4),
            },
            update: {
                secret: randomApiKeySecret(),
                expiresAt: new Date(Date.now() + expiresIn * 6e4),
                createdAt: new Date(),
            },
        });

        return json({
            token: apiKey.secret,
            createdAt: apiKey.createdAt.toISOString(),
            expiresAt: apiKey.expiresAt.toISOString(),
        });
    } catch (error) {
        console.error("Token creation failed", error);
        return errorResponse(500, "internalServerError", "Failed to create API token");
    }
}

async function handleTranslation(
    request: Request,
    env: Env,
    sourceLanguage: string,
    targetLanguage: string,
): Promise<Response> {
    let owner: string | null;
    try {
        owner = await authenticate(request, env);
    } catch (error) {
        console.error("Authentication failed", error);
        return errorResponse(503, "internalServerError", "Database is not configured or unavailable");
    }
    if (!owner) return json({ error: "Unauthorized" }, 401);

    let body: Record<string, unknown>;
    try {
        body = await readJson(request);
    } catch {
        return errorResponse(400, "bad_request", "Invalid JSON request body");
    }
    if (typeof body.text !== "string" || !body.text) {
        return errorResponse(400, "bad_request", "text must be a non-empty string");
    }

    try {
        const requiredTerms = splitList(env.TRANSLATION_TOU);
        if (requiredTerms.length > 0) {
            const consent = await prismaFor(env).userConsents.findFirst({ where: { id: owner } });
            const missingTerms = consent
                ? requiredTerms.filter((term) => !consent.acceptedTerms.includes(term))
                : requiredTerms;
            if (missingTerms.length > 0) {
                return errorResponse(
                    403,
                    "termsAcceptanceRequired",
                    `You need to accept ${missingTerms.length} Terms of Use to use the translator.`,
                    { requiredTerms: missingTerms },
                );
            }
        }

        const translation = await translateText(env, sourceLanguage, targetLanguage, body.text);
        return json(translation);
    } catch (error) {
        console.error("Translation failed", error);
        return errorResponse(500, "internalServerError", "An internal server error occurred while translating the text");
    }
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
        return json({
            service: "Neurogate",
            runtime: "cloudflare-workers",
            workersAI: Boolean(env.AI),
            database: Boolean(databaseUrl(env)),
        });
    }

    if (request.method === "POST" && url.pathname === "/v1/get_token") {
        return handleGetToken(request, env);
    }

    const translationMatch = url.pathname.match(/^\/v1\/translations\/([^/]+)\/([^/]+)$/);
    if (request.method === "POST" && translationMatch) {
        return handleTranslation(
            request,
            env,
            decodeURIComponent(translationMatch[1]),
            decodeURIComponent(translationMatch[2]),
        );
    }

    return errorResponse(404, "notFound", "Not found");
}

export default {
    fetch(request: Request, env: Env): Promise<Response> {
        return handleRequest(request, env);
    },
};
