import codes from "iso-language-codes";
import logger from "../services/logger";
import BaseTranslator from "./base";
import OpenAITranslator from "./openai";
import MozhiGoogleTranslator from "./google_mozhi";

const translators: BaseTranslator[] = [
    new OpenAITranslator(),
    new MozhiGoogleTranslator(),
];

export type TranslationResponse = {
    translation: string;
    reasoning?: string;
    engine: string;
};

export default async function translateText(from: string, to: string, text: string): Promise<TranslationResponse> {
    const fromCode = codes.find(lang => lang.iso639_1 === from);
    const toCode = codes.find(lang => lang.iso639_1 === to);

    if (!fromCode && from !== 'auto') throw new Error('Invalid source lang');
    if (!toCode) throw new Error('Invalid target lang');
    // fallback mechanism
    for (const translator of translators) {
        try {
            return await translator.translateText(from, to, text);
        } catch (error: Error | unknown) {
            logger.error(
                error,
                `Translation with ${translator.name} failed, falling back... (${from} -> ${to})`
            );
        }
    }

    throw new Error(`Translation failed`);
}