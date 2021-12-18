import { Translate } from '@google-cloud/translate/build/src/v2';

export class TranslationClient {
	constructor() {
		this.client = new Translate();
	}

	async getLanguage(string: string): Promise<string> {
		const result = await this.client.detect(string);
		if (result[0].confidence > .5) return result[0].language;
		return undefined;
	}

	async translate(string: string, to: string, from: string): Promise<string> {
		const result = await this.client.translate(string, { to, from });
		return result[0];
	}

	client: Translate;
}
