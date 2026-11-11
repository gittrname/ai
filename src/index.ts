// AiOS bootstrapper

import * as fs from 'node:fs';
import process from 'node:process';
import chalk from 'chalk';
import got from 'got';
import promiseRetry from 'promise-retry';

import 藍 from './ai.js';
import config from './config.js';
import _log from './utils/log.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { _v: string };

import CoreModule from './modules/core/index.js';
import TalkModule from './modules/talk/index.js';
import BirthdayModule from './modules/birthday/index.js';
import ReversiModule from './modules/reversi/index.js';
import PingModule from './modules/ping/index.js';
import EmojiModule from './modules/emoji/index.js';
import EmojiReactModule from './modules/emoji-react/index.js';
import FortuneModule from './modules/fortune/index.js';
import GuessingGameModule from './modules/guessing-game/index.js';
import KazutoriModule from './modules/kazutori/index.js';
import KeywordModule from './modules/keyword/index.js';
import WelcomeModule from './modules/welcome/index.js';
import TimerModule from './modules/timer/index.js';
import DiceModule from './modules/dice/index.js';
import ServerModule from './modules/server/index.js';
import FollowModule from './modules/follow/index.js';
import ValentineModule from './modules/valentine/index.js';
import MazeModule from './modules/maze/index.js';
import ChartModule from './modules/chart/index.js';
import SleepReportModule from './modules/sleep-report/index.js';
import NotingModule from './modules/noting/index.js';
import PollModule from './modules/poll/index.js';
import ReminderModule from './modules/reminder/index.js';
import CheckCustomEmojisModule from './modules/check-custom-emojis/index.js';
import AiChatModule from './modules/aichat/index.js';

console.log('   __    ____  _____  ___ ');
console.log('  /__\\  (_  _)(  _  )/ __)');
console.log(' /(__)\\  _)(_  )(_)( \\__ \\');
console.log('(__)(__)(____)(_____)(___/\n');

function log(msg: string): void {
	_log(`[Boot]: ${msg}`);
}

log(chalk.bold(`Ai v${pkg._v}`));

process.on('uncaughtException', err => {
	try {
		console.error(`Uncaught exception: ${err.message}`);
		console.dir(err, { colors: true, depth: 2 });
	} catch { }
});

promiseRetry(retry => {
	log(`Account fetching... ${chalk.gray(config.host)}`);

	// アカウントをフェッチ
	return got.post(`${config.apiUrl}/i`, {
		json: {
			i: config.i
		}
	}).json().catch(retry);
}, {
	retries: 3
}).then((account: any) => {
	const acct = `@${account.username}`;
	log(chalk.green(`Account fetched successfully: ${chalk.underline(acct)}`));

	log('Starting AiOS...');

	// モジュール準備
	const modules: any[] = [
		new CoreModule()	// 基盤モジュール
	];
	if (config.modules.includes('reminder')) {
		modules.push(new ReminderModule());	// リマインダーモジュール（たとえば「明日の 9:00 に通知して」などの予定管理）
	}
	if (config.modules.includes('talk')) {
		modules.push(new TalkModule()); // 日常会話や雑談系の応答を担当モジュール
	}
	if (config.modules.includes('check-custom-emojis')) {
		modules.push(new CheckCustomEmojisModule()); //	カスタム絵文字の追加を検知するモジュール
	}
	if (config.modules.includes('emoji')) {
		modules.push(new EmojiModule()); // 絵文字の投稿を担当するモジュール
	}
	if (config.modules.includes('emoji-react')) {
		modules.push(new EmojiReactModule()); // 絵文字のリアクションを担当するモジュール
	}
	if (config.modules.includes('fortune')) {
		modules.push(new FortuneModule()); // 占いモジュール
	}
	if (config.modules.includes('guessing-game')) {
		modules.push(new GuessingGameModule()); // 当てっこゲームモジュール
	}
	if (config.modules.includes('kazutori')) {
		modules.push(new KazutoriModule()); // かずとりゲームモジュール
	}
	if (config.modules.includes('reversi')) {
		modules.push(new ReversiModule()); // リバーシゲームモジュール
	}
	if (config.modules.includes('timer')) {
		modules.push(new TimerModule()); // タイマー機能を提供するモジュール
	}
	if (config.modules.includes('dice')) {
		modules.push(new DiceModule()); // サイコロ機能を提供するモジュール
	}
	if (config.modules.includes('ping')) {
		modules.push(new PingModule()); // Ping機能を提供するモジュール(「生きてる？」系のヘルスチェック的な役割)
	}
	if (config.modules.includes('welcome')) {
		modules.push(new WelcomeModule()); // 新規参加者の挨拶を担当するモジュール
	}
	if (config.modules.includes('server')) {
		modules.push(new ServerModule()); // サーバー監視・状態確認の機能を提供するモジュール
	}
	if (config.modules.includes('follow')) {
		modules.push(new FollowModule()); // フォロー・フォロワーの監視を担当するモジュール(動フォローや特定ユーザーへの対応)
	}
	if (config.modules.includes('valentine')) {
		modules.push(new ValentineModule()); // バレンタインの通知を担当するモジュール
	}
	if (config.modules.includes('birthday')) {
		modules.push(new BirthdayModule()); // 誕生日の通知を担当するモジュール
	}
	if (config.modules.includes('keyword')) {
		modules.push(new KeywordModule()); // キーワード学習機能を担当するモジュール(一定の語句を覚えたり、文脈に応じて反応させる機能)
	}
	if (config.modules.includes('maze')) {
		modules.push(new MazeModule()); // 迷路ゲームモジュール
	}
	if (config.modules.includes('chart')) {
		modules.push(new ChartModule()); // チャート作成モジュール
	}
	if (config.modules.includes('sleep-report')) {
		modules.push(new SleepReportModule()); // 生活ログや寝起きの挨拶・睡眠状態の管理モジュール
	}
	if (config.modules.includes('noting')) {
		modules.push(new NotingModule()); // ランダムノート投稿や自動投稿を担当するモジュール
	}
	if (config.modules.includes('poll')) {
		modules.push(new PollModule()); // 投票機能を提供するモジュール
	}
	if (config.modules.includes('aichat')) {
		modules.push(new AiChatModule());	// AIチャットモジュール
	}

	// 藍起動
	new 藍(account, modules);
}).catch(e => {
	log(chalk.red('Failed to fetch the account'));
});
