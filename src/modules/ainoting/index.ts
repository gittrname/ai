import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import config from '@/config.js';
import urlToJson from '@/utils/url2json.js';
import got from 'got';
import { withRequestTimeout } from '@/utils/request-timeout.js';

type AiNoting = {
	question: string;
	prompt: string;
	api: string;
	key: string;
	model?: string;
	baseUrl?: string;
	grounding?: boolean;
	history?: { role: string; content: string }[];
};
type GeminiParts = {
	inlineData?: {
		mimeType: string;
		data: string;
	};
	fileData?: {
		mimeType: string;
		fileUri: string;
	};
	text?: string;
}[];
type GeminiSystemInstruction = {
	role: string;
	parts: [{text: string}]
};
type GeminiContents = {
	role: string;
	parts: GeminiParts;
};
type GeminiOptions = {
	contents?: GeminiContents[],
	systemInstruction?: GeminiSystemInstruction,
	tools?: [{}]
};

type UrlPreview = {
	title: string;
	icon: string;
	description: string;
	thumbnail: string;
	player: {
		url: string
		width: number;
		height: number;
		allow: []
	}
	sitename: string;
	sensitive: boolean;
	activityPub: string;
	url: string;
};

const TYPE_GEMINI = 'gemini';
const TYPE_OPENAI = 'openai';
const TYPE_PLAMO = 'plamo';

const OPENAI_API = 'https://api.openai.com/v1/chat/completions';
const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';

const RANDOMTALK_DEFAULT_PROBABILITY = 0.02;// デフォルトのrandomTalk確率
const RANDOMTALK_DEFAULT_INTERVAL = 1000 * 60 * 60 * 12;// デフォルトのrandomTalk間隔
const TIMELINE_CONTEXT_LIMIT = 30;

export default class extends Module {
	public readonly name = 'ainothing';
	private randomNotingProbability: number = RANDOMTALK_DEFAULT_PROBABILITY;
	private randomNotingIntervalMinutes: number = RANDOMTALK_DEFAULT_INTERVAL;

	@bindThis
	public install() {

		const ainotingConfig = config.modulesConfig?.ainoting ?? {};
		// ランダムノートの確率は設定されていればそちらを採用(設定がなければデフォルトを採用)
		if (ainotingConfig.randomNotingProbability != undefined && !Number.isNaN(Number(ainotingConfig.randomNotingProbability))) {
			this.randomNotingProbability = Number.parseFloat(String(ainotingConfig.randomNotingProbability));
		}
		// ランダムノート間隔(分)は設定されていればそちらを採用(設定がなければデフォルトを採用)
		if (ainotingConfig.randomNotingIntervalMinutes != undefined && !Number.isNaN(Number(ainotingConfig.randomNotingIntervalMinutes))) {
			this.randomNotingIntervalMinutes = 1000 * 60 * Number.parseInt(String(ainotingConfig.randomNotingIntervalMinutes), 10);
		}
		
		this.log('randomNotingProbability:' + this.randomNotingProbability);
		this.log('randomNotingIntervalMinutes:' + (this.randomNotingIntervalMinutes / (60 * 1000)));

		// 定期的にデータを取得しaiRandomNotingを行う
		setInterval(this.aiRandomNoting, this.randomNotingIntervalMinutes);

		return {
		};
	}

	@bindThis
	private async genTextByGemini(AiNoting: AiNoting) {
		this.log('Generate Text By Gemini...');
		let parts: GeminiParts = [];
		const now = new Date().toLocaleString('ja-JP', {
			timeZone: 'Asia/Tokyo',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
		// 設定のプロンプトに加え、現在時刻を渡す
		let systemInstructionText = AiNoting.prompt + 'また、現在日時は' + now + 'であり、これは回答の参考にし、時刻を聞かれるまで時刻情報は提供しないこと(なお、他の日時は無効とすること)。';
		// ランダムトーク機能(利用者が意図(メンション)せず発動)の場合、ちょっとだけ配慮しておく
		systemInstructionText += 'これらのメッセージは、あなたに対するメッセージではないことを留意すること(会話相手は不特定多数)。';
		// グラウンディングについてもsystemInstructionTextに追記(こうしないとあまり使わないので)
		if (AiNoting.grounding) {
			systemInstructionText += '返答のルール2:Google search with grounding.';
		}
		// URLから情報を取得
		if (AiNoting.question !== undefined) {
			const urlexp = RegExp('(https?://[a-zA-Z0-9!?/+_~=:;.,*&@#$%\'-]+)', 'g');
			const urlarray = [...AiNoting.question.matchAll(urlexp)];
			if (urlarray.length > 0) {
				for (const url of urlarray) {
					this.log('URL:' + url[0]);
					let result: unknown = null;
					try{
						result = await urlToJson(url[0]);
					} catch (err: unknown) {
						systemInstructionText += '補足として提供されたURLは無効でした:URL=>' + url[0]
						this.log('Skip url becase error in urlToJson');
						continue;
					}
					const urlpreview: UrlPreview = result as UrlPreview;
					if (urlpreview.title) {
						systemInstructionText +=
							'補足として提供されたURLの情報は次の通り:URL=>' + urlpreview.url
							+'サイト名('+urlpreview.sitename+')、';
						if (!urlpreview.sensitive) {
							systemInstructionText +=
							'タイトル('+urlpreview.title+')、'
							+ '説明('+urlpreview.description+')、'
							+ '質問にあるURLとサイト名・タイトル・説明を組み合わせ、回答の参考にすること。'
							;
							this.log('urlpreview.sitename:' + urlpreview.sitename);
							this.log('urlpreview.title:' + urlpreview.title);
							this.log('urlpreview.description:' + urlpreview.description);
						} else {
							systemInstructionText +=
							'これはセンシティブなURLの可能性があるため、質問にあるURLとサイト名のみで、回答の参考にすること(使わなくても良い)。'
							;
						}
					} else {
						// 多分ここにはこないが念のため
						this.log('urlpreview.title is nothing');
					}
				}
			}
		}
		const systemInstruction: GeminiSystemInstruction = {role: 'system', parts: [{text: systemInstructionText}]};

		parts = [{text: AiNoting.question}];

		// 履歴を追加
		let contents: GeminiContents[] = [];
		if (AiNoting.history != null) {
			AiNoting.history.forEach(entry => {
				contents.push({
					role : entry.role,
					parts: [{text: entry.content}],
				});
			});
		}
		contents.push({role: 'user', parts: parts});

		let geminiOptions:GeminiOptions = {
			contents: contents,
			systemInstruction: systemInstruction,
		};
		// gemini api grounding support. ref:https://github.com/google-gemini/cookbook/blob/09f3b17df1751297798c2b498cae61c6bf710edc/quickstarts/Search_Grounding.ipynb
		if (AiNoting.grounding) {
			geminiOptions.tools = [{google_search:{}}];
		}
		let options = {
			url: AiNoting.api,
			searchParams: {
				key: AiNoting.key,
			},
			json: geminiOptions,
		};

		this.log(JSON.stringify(options));
		let res_data:any = null;
		let responseText:string = '';
		try {
			res_data = await withRequestTimeout(
				got.post(options.url, {
					searchParams: {
						key: AiNoting.key,
					},
					json: geminiOptions,
					timeout: { request: config.api.timeout },
				}).json(),
				config.api.timeout,
				'Gemini API request',
			);
			this.log(JSON.stringify(res_data));
			if (res_data.hasOwnProperty('candidates')) {
				if (res_data.candidates?.length > 0) {
					// 結果を取得
					if (res_data.candidates[0].hasOwnProperty('content')) {
						if (res_data.candidates[0].content.hasOwnProperty('parts')) {
							if (res_data.candidates[0].content.parts.length > 0) {
								for (let i = 0; i < res_data.candidates[0].content.parts.length; i++) {
									if (res_data.candidates[0].content.parts[i].hasOwnProperty('text')) {
										responseText += res_data.candidates[0].content.parts[i].text;
									}
								}
							}
						}
					}
					// groundingMetadataを取得
					let groundingMetadata = '';
					if (res_data.candidates[0].hasOwnProperty('groundingMetadata')) {
						// 参考サイト情報
						if (res_data.candidates[0].groundingMetadata.hasOwnProperty('groundingChunks')) {
							// 参考サイトが多すぎる場合があるので、3つに制限
							let checkMaxLength = res_data.candidates[0].groundingMetadata.groundingChunks.length;
							if (res_data.candidates[0].groundingMetadata.groundingChunks.length > 3) {
								checkMaxLength = 3;
							}
							for (let i = 0; i < checkMaxLength; i++) {
								if (res_data.candidates[0].groundingMetadata.groundingChunks[i].hasOwnProperty('web')) {
									if (res_data.candidates[0].groundingMetadata.groundingChunks[i].web.hasOwnProperty('uri')
											&& res_data.candidates[0].groundingMetadata.groundingChunks[i].web.hasOwnProperty('title')) {
										groundingMetadata += `参考(${i+1}): [${res_data.candidates[0].groundingMetadata.groundingChunks[i].web.title}](${res_data.candidates[0].groundingMetadata.groundingChunks[i].web.uri})\n`;
									}
								}
							}
						}
						// 検索ワード
						if (res_data.candidates[0].groundingMetadata.hasOwnProperty('webSearchQueries')) {
							if (res_data.candidates[0].groundingMetadata.webSearchQueries.length > 0) {
								groundingMetadata += '検索ワード: ' + res_data.candidates[0].groundingMetadata.webSearchQueries.join(',') + '\n';
							}
						}
					}
					responseText += groundingMetadata;
				}
			}
		} catch (err: unknown) {
			this.log('Error By Call Gemini');
			if (err instanceof Error) {
				this.log(`${err.name}\n${err.message}\n${err.stack}`);
			}
		}
		return responseText;
	}

	@bindThis
	private async genTextByPLaMo(AiNoting: AiNoting) {
		this.log('Generate Text By PLaMo...');

		let options = {
			url: AiNoting.api,
			headers: {
				Authorization: 'Bearer ' + AiNoting.key
			},
			json: {
				model: 'plamo-beta',
				messages: [
					{role: 'system', content: AiNoting.prompt},
					{role: 'user', content: AiNoting.question},
				],
			},
		};
		this.log(JSON.stringify(options));
		let res_data:any = null;
		try {
			res_data = await withRequestTimeout(
				got.post(options.url, {
					headers: options.headers,
					json: {
						model: 'plamo-beta',
						messages: [
							{role: 'system', content: AiNoting.prompt},
							{role: 'user', content: AiNoting.question},
						],
					},
					timeout: { request: config.api.timeout },
				}).json(),
				config.api.timeout,
				'PLaMo API request',
			);
			this.log(JSON.stringify(res_data));
			if (res_data.hasOwnProperty('choices')) {
				if (res_data.choices.length > 0) {
					if (res_data.choices[0].hasOwnProperty('message')) {
						if (res_data.choices[0].message.hasOwnProperty('content')) {
							return res_data.choices[0].message.content;
						}
					}
				}
			}
		} catch (err: unknown) {
			this.log('Error By Call PLaMo');
			if (err instanceof Error) {
				this.log(`${err.name}\n${err.message}\n${err.stack}`);
			}
		}
		return null;
	}

	@bindThis
	private async genTextByOpenAI(AiNoting: AiNoting) {
		this.log('Generate Text By OpenAI...');

		const messages = [
			{ role: 'system', content: AiNoting.prompt },
			...(AiNoting.history ?? []).map(entry => ({ role: entry.role, content: entry.content })),
			{ role: 'user', content: AiNoting.question },
		];

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};
		if (AiNoting.key) {
			headers.Authorization = 'Bearer ' + AiNoting.key;
		}
		const tool_choice = config.modulesConfig?.ainoting?.groundingWithGoogleSearchAlwaysEnabled ? 'auto' : 'none';

		const options = {
			url: AiNoting.baseUrl ?? AiNoting.api ?? OPENAI_API,
			headers,
			json: {
				model: AiNoting.model ?? config.api?.model ?? OPENAI_DEFAULT_MODEL,
				messages,
				tool_choice: tool_choice,
			},
		};
		this.log(JSON.stringify(options));
		let res_data:any = null;
		try {
			res_data = await withRequestTimeout(
				got.post(options.url, {
					headers: options.headers,
					json: {
						model: options.json.model,
						messages: options.json.messages,
						tool_choice: options.json.tool_choice,
					},
					timeout: { request: config.api.timeout },
				}).json(),
				config.api.timeout,
				'OpenAI API request',
			);
			this.log(JSON.stringify(res_data));
			if (res_data?.choices?.length > 0) {
				const content = res_data.choices[0]?.message?.content;
				if (typeof content === 'string') {
					return content;
				}
				if (Array.isArray(content)) {
					return content.map((item: any) => {
						if (typeof item === 'string') return item;
						if (item && typeof item.text === 'string') return item.text;
						return '';
					}).join('');
				}
			}
		} catch (err: unknown) {
			this.log('Error By Call OpenAI');
			if (err instanceof Error) {
				this.log(`${err.name}\n${err.message}\n${err.stack}`);
			}
		}
		return null;
	}

	@bindThis
	private formatTimelineContext(notes: any[]): string {
		const sortedNotes = [...notes].sort((a, b) =>
			new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
		).slice(-TIMELINE_CONTEXT_LIMIT);

		return sortedNotes.map(note => {
			const date = new Date(note.createdAt);
			const time = date.toLocaleString('ja-JP', {
				timeZone: 'Asia/Tokyo',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
			});
			const displayName = note.user?.name || note.user?.username || '不明';
			const text = String(note.text ?? '').replace(/\r?\n/g, ' ').trim();
			return `[${time}] ${displayName}（@${note.user?.username ?? 'unknown'}）：${text}`;
		}).join('\n');
	}

	@bindThis
	private async buildTimelineContext(seedNote: any): Promise<string> {
		const contextMap = new Map<string, any>();

		try {
			const conversation: any[] = await this.ai.api('notes/conversation', {
				noteId: seedNote.id,
				limit: TIMELINE_CONTEXT_LIMIT,
			}) as any[];
			for (const note of conversation ?? []) {
				contextMap.set(note.id, note);
			}
		} catch (err: unknown) {
			this.log('Failed to fetch notes/conversation');
		}

		try {
			const children: any[] = await this.ai.api('notes/children', {
				noteId: seedNote.id,
				limit: TIMELINE_CONTEXT_LIMIT,
			}) as any[];
			for (const note of children ?? []) {
				contextMap.set(note.id, note);
			}
		} catch (err: unknown) {
			this.log('Failed to fetch notes/children');
		}

		contextMap.set(seedNote.id, seedNote);

		const contextNotes = [...contextMap.values()].filter(note =>
			note?.id != null &&
			note.userId !== this.ai.account.id &&
			note.user?.isBot !== true &&
			typeof note.text === 'string' &&
			note.text.trim().length > 0 &&
			note.renoteId == null &&
			note.cw == null
		);

		return this.formatTimelineContext(contextNotes);
	}

	@bindThis
	private async aiRandomNoting() {
		this.log('AiNothing(randomnoting) started');

		if (Math.random() >= this.randomNotingProbability) {
			this.log('AiNothing(randomnoting) is end: probability check did not pass');
			return false;
		}
		
		let tl: any[] = [];
		try {
			tl = await this.ai.api('notes/local-timeline', {
				limit: TIMELINE_CONTEXT_LIMIT
			}) as any[];
		} catch (err: unknown) {
			this.log('Failed to fetch local timeline');
			return false;
		}

		const interestedNotes = tl.filter((note: any) =>
			note.userId !== this.ai.account.id &&
			note.user?.isBot !== true &&
			typeof note.text === 'string' &&
			note.text.trim().length > 0 &&
			note.renoteId == null &&
			note.cw == null);

		if (interestedNotes.length === 0) return false;

		const seedNote = interestedNotes[Math.floor(Math.random() * interestedNotes.length)];
		const timelineContext = await this.buildTimelineContext(seedNote);
		if (timelineContext.length === 0) return false;

		let note: string | null = null;
		const prompt = (config.prompt ?? '') +
			'以下はローカルタイムライン上の実際の会話です。会話の流れを理解し、文脈に自然に沿った短い投稿を作成してください。' +
			'特定の人物への直接的な返信を装いすぎず、会話に登場しない話題や事実を追加せず、タイムライン取得の事実には触れないでください。' +
			'Botの投稿は除外済みであり、時系列は古いものから新しいものへ並んでいます。';
		const question = 'ローカルタイムラインの会話文脈:\n' + timelineContext + '\n\nこの会話の流れに沿った投稿を一つ作成してください。';

		const type = config.api?.provider;
		switch (type) {
			case TYPE_GEMINI:
				if (!config.api?.baseUrl || !config.api?.model || !config.api?.apiKey) {
					return false;
				}
				note = await this.genTextByGemini({
					question,
					prompt,
					api: config.api.baseUrl,
					key: config.api.apiKey,
					history: [],
				});
				break;

			case TYPE_OPENAI:
				if (!config.api?.baseUrl || !config.api?.model) {
					return false;
				}
				note = await this.genTextByOpenAI({
					question,
					prompt,
					api: config.api.baseUrl,
					key: config.api.apiKey ?? '',
					model: config.api.model,
					baseUrl: config.api.baseUrl,
					history: [],
				});
				break;

			case TYPE_PLAMO:
				if (!config.api?.baseUrl || !config.api?.model || !config.api?.apiKey) {
					return false;
				}
				note = await this.genTextByPLaMo({
					question,
					prompt,
					api: config.api.baseUrl,
					key: config.api.apiKey,
					history: [],
				});
				break;

			default:
				return false;
		}

		if (note == null || note.trim() === '') {
			this.log('The result is invalid. It seems that the timeline context needs to be reviewed.');
			return false;
		}

		this.log('Noting...');
		await this.ai.post({
			text: note
		});

		return true;
	}
}
