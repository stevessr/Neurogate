import 'dotenv/config';

type LogLevel = 'debug' | 'error' | 'fatal' | 'info' | 'silent' | 'trace' | 'warn';
type NodeEnv = 'development' | 'production';

type AppConfig = {
    apiPort: number;
    socksProxy?: string;
    databaseUrl: string;

    userAgent: string;

    openaiBaseUrl: string;
    openaiApiKey: string;

    mozhiGoogleInstances: string[];
    openaiModels: string[];

    logLevel: LogLevel;
    nodeEnv: NodeEnv;
};

function getEnvVar(key: string, defaultValue?: string): string {
    const value = process.env[key] ?? defaultValue;
    if (!value) {
        console.error(`Missing environment variable: ${key}`);
        process.exit();
    }
    return value;
}

const config: AppConfig = {
    apiPort: parseInt(getEnvVar('API_PORT', '8000'), 10),
    socksProxy: getEnvVar('SOCKS_PROXY', 'unset'),
    databaseUrl: getEnvVar('DATABASE_URL'),

    userAgent: getEnvVar('HTTP_USER_AGENT', 'Neurogate/1.0'),

    openaiApiKey: getEnvVar('OPENAI_API_KEY'),
    openaiBaseUrl: getEnvVar('OPENAI_BASE_URL'),
    
    mozhiGoogleInstances: getEnvVar('MOZHI_GOOGLE_INSTANCES').split(';'),
    openaiModels: getEnvVar('OPENAI_MODELS').split(';'),

    logLevel: getEnvVar('LOG_LEVEL', 'info') as LogLevel,
    nodeEnv: getEnvVar('NODE_ENV', 'development') as NodeEnv,
};

export default config;