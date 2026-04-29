import {OpenAI} from 'openai';
import config from './config';

const openai = new OpenAI({
    baseURL: config.openaiBaseUrl,
    apiKey: config.openaiApiKey,
    defaultHeaders: {
        'User-Agent': config.userAgent,
    },
});

export default openai;