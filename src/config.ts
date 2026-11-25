import { readFileSync } from 'node:fs';

type ApiConfig = {
	provider: 'gemini' | 'openai' | 'plamo';
	baseUrl: string;
	apiKey?: string;
	model: string;
	timeout: number;
};

type AichatModuleConfig = {
	randomTalkEnabled?: boolean;
	randomTalkProbability?: string | number;
	randomTalkIntervalMinutes?: string | number;
	groundingWithGoogleSearchAlwaysEnabled?: boolean;
};
type AinotingModuleConfig = {
	randomNotingProbability?: string | number;
	randomNotingIntervalMinutes?: string | number;
};

type ReversiModuleConfig = {
	strength?: number;
};

type Config = {
	host: string;
	serverName?: string;
	i: string;
	master?: string;
	wsUrl: string;
	apiUrl: string;
	prompt?: string;
	mecab?: string;
	mecabDic?: string;
	memoryDir?: string;
	api: ApiConfig;
	modules: string[];
	modulesConfig?: {
		aichat?: AichatModuleConfig;
		ainoting?: AinotingModuleConfig;
		reversi?: ReversiModuleConfig;
	};
};

const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8')) as Record<string, any>;

let promptFromFile = '';
try {
	promptFromFile = readFileSync(new URL('../prompt.txt', import.meta.url), 'utf8').trim();
} catch {
	promptFromFile = '';
}

const configData = Object.assign({}, config, {
	prompt: config.prompt ?? (promptFromFile || undefined),
	modulesConfig: {
		...(config.modulesConfig ?? {}),
		aichat: {
			...(config.modulesConfig?.aichat ?? {}),
			randomTalkEnabled: config.modulesConfig?.aichat?.randomTalkEnabled ?? config.aichatRandomTalkEnabled ?? false,
			randomTalkProbability: config.modulesConfig?.aichat?.randomTalkProbability ?? config.aichatRandomTalkProbability ?? 0.02,
			randomTalkIntervalMinutes: config.modulesConfig?.aichat?.randomTalkIntervalMinutes ?? config.aichatRandomTalkIntervalMinutes ?? 720,
			groundingWithGoogleSearchAlwaysEnabled: config.modulesConfig?.aichat?.groundingWithGoogleSearchAlwaysEnabled ?? config.aichatGroundingWithGoogleSearchAlwaysEnabled ?? false,
		},
		ainoting: {
			randomNotingProbability: config.modulesConfig?.ainoting?.randomNotingProbability ?? config.ainotingRandomNotingProbability ?? 0.02,
			randomNotingIntervalMinutes: config.modulesConfig?.ainoting?.randomNotingIntervalMinutes ?? config.ainotingRandomNotingIntervalMinutes ?? 720,
		},
		reversi: {
			...(config.modulesConfig?.reversi ?? {}),
			strength: config.modulesConfig?.reversi?.strength ?? config.reversiStrength ?? 2,
		}
	},
	wsUrl: config.host.replace('http', 'ws'),
	apiUrl: config.host + '/api',
	api: {
		provider: config.api?.provider ?? config.defaultAiProvider ?? 'openai',
		baseUrl: config.api?.baseUrl ?? config.api?.baseUrl ?? 'https://api.openai.com/v1/chat/completions',
		apiKey: config.api?.apiKey ?? '',
		model: config.api?.model ?? 'gpt-4o-mini',
		timeout: config.api?.timeout ?? 30_000,
	},
}) as unknown as Config;

export default configData;
