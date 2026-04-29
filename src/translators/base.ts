import { TranslationResponse } from ".";

abstract class BaseTranslator {
    abstract name: string;

    abstract translateText(sourceLang: string, targetLang: string, text: string): Promise<TranslationResponse>;
}

export default BaseTranslator;