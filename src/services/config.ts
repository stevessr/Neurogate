import 'dotenv/config';

type AppConfig = {
    apiPort: number;
    socksProxy?: string;
    databaseUrl: string;

    openaiBaseUrl: string;
    openaiApiKey: string;
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
    apiPort: parseInt(getEnvVar('API_PORT')),
    socksProxy: getEnvVar('SOCKS_PROXY'),
    databaseUrl: getEnvVar('DATABASE_URL'),

    openaiApiKey: getEnvVar('OPENAI_API_KEY'),
    openaiBaseUrl: getEnvVar('OPENAI_BASE_URL'),
};

export default config;