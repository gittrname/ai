import { readFileSync } from 'node:fs';

type Config = {
	host: string;
	serverName?: string;
	i: string;
	master?: string;
	wsUrl: string;
	apiUrl: string;
	keywordEnabled: boolean;
	reversiEnabled: boolean;
	notingEnabled: boolean;
	mazeEnabled?: boolean;
	chartEnabled: boolean;
	serverMonitoring: boolean;
	checkEmojisEnabled?: boolean;
	checkEmojisAtOnce?: boolean;
	geminiProApiKey?: string;
	pLaMoApiKey?: string;
	openAiApiKey?: string;
	openAiModel?: string;
	openAiBaseUrl?: string;
	defaultAiProvider?: 'gemini' | 'openai' | 'plamo';
	prompt?: string;
	aichatRandomTalkEnabled?: boolean;
	aichatRandomTalkProbability?: string | number;
	aichatRandomTalkIntervalMinutes?: string | number;
	aichatGroundingWithGoogleSearchAlwaysEnabled?: boolean;
	mecab?: string;
	mecabDic?: string;
	memoryDir?: string;
};

const config = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8')) as Record<string, any>;

const configData = Object.assign({}, config, {
	wsUrl: config.host.replace('http', 'ws'),
	apiUrl: config.host + '/api',
}) as unknown as Config;

export default configData;
