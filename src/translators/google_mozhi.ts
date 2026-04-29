import { TranslationResponse } from ".";
import config from "../services/config";
import logger from "../services/logger";
import BaseTranslator from "./base";

class MozhiGoogleTranslator extends BaseTranslator {
    name: string = 'mozhi-google';
    
    async translateText(sourceLang: string, targetLang: string, text: string): Promise<TranslationResponse> {
        // TODO: sort by usage, aka load balancing
        const shuffledList = config.mozhiGoogleInstances.sort(() => Math.random() - 0.5);

        for (const mozhiInstance of shuffledList) {
            try {
                const response = await fetch(`${mozhiInstance}/api/translate?engine=google&from=${sourceLang}&to=${targetLang}&text=${encodeURIComponent(text)}`);
                if (!response.ok) throw new Error(`HTTP request failed with ${response.status} ${response.statusText}`);
                const json: any = await response.json();
                if (typeof json['translated-text'] !== 'string' || !json['translated-text']) throw new Error(`'translated-text' is not a string or it's empty`);
                return {
                    translation: json['translated-text'] as string,
                    engine: `google`
                };
            } catch (error: Error | unknown) {
                logger.error(error, `Translation failed using ${mozhiInstance}`);
            }
        }

        throw new Error('Translation failed');
    }
}

export default MozhiGoogleTranslator;