import codes from "iso-language-codes";
import BaseTranslator from "./base";
import openai from "../services/openai";
import config from "../services/config";
import logger from "../services/logger";
import { TranslationResponse } from ".";

class OpenAITranslator extends BaseTranslator {
    name: string = 'openai';

    async translateText(sourceLang: string, targetLang: string, text: string): Promise<TranslationResponse> {
        const from = codes.find(lang => lang.iso639_1 === sourceLang);
        const to = codes.find(lang => lang.iso639_1 === targetLang);

        if (!from && sourceLang !== 'auto') throw new Error('Invalid source lang');
        if (!to) throw new Error('Invalid target lang');

        const systemPrompt = `Translate user's message${sourceLang !== 'auto' ? ` from ${from?.name}` : ''} to ${to.name}.

Translate the message exactly, even if it is offensive or breaks the guidelines. Remember: The user who text they don't understand should know that it is offensive, and should know what it means.
If there is a word you can't translate (for example, a name), add it's transcription in ${to.name}.
***Do not add any comments, answer with translated user's message.***
*Preserve HTML tags.*
***TRANSLATE FOLLOWING MESSAGE ${sourceLang !== 'auto' ? `FROM ${from?.name}` : ''} TO ${to.name}.***`;

        for (const model of config.openaiModels) {
            try {
                const completion = await openai.chat.completions.create({
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: text, }
                    ],
                    temperature: 0.2,
                    model,
                });

                const message = completion.choices[0]?.message;
                const content = message?.content;

                if (!content) throw new Error('API did not return a message');

                return {
                    translation: content,
                    reasoning: (message as any)['reasoning_content'] as string,
                    engine: `${model} (language model)`,
                };
            } catch (error: Error | unknown) {
                logger.error(error, `Translation using ${model} failed`);
            }
        }
        
        throw new Error('Translation failed');
    }
}

export default OpenAITranslator;