import { bindThis } from '@/decorators.js';
import chalk from 'chalk';

import 藍 from '@/ai.js';
import Friend from '@/friend.js';
import type { User } from '@/misskey/user.js';
import includes from '@/utils/includes.js';
import or from '@/utils/or.js';
import config from '@/config.js';
import { sleep } from '@/utils/sleep.js';

export default class Message {
	private ai!: 藍;
	private chatMessage: { id: string; fromUser: any; fromUserId: string; text: string; } | null;
	private note: { id: string; user: any; userId: string; text: string; renoteId?: string | null; replyId?: string | null; visibility?: string | null; } | null;
	public isChat: boolean;

	public get id(): string {
		const note = this.note;
		return this.chatMessage ? this.chatMessage.id : note ? note.id : '';
	}

	public get user(): User {
		const note = this.note;
		return this.chatMessage ? this.chatMessage.fromUser : note ? note.user : {} as User;
	}

	public get userId(): string {
		const note = this.note;
		return this.chatMessage ? this.chatMessage.fromUserId : note ? note.userId : '';
	}

	public get text(): string {
		const note = this.note;
		return this.chatMessage ? this.chatMessage.text : note ? note.text : '';
	}

	public get quoteId(): string | null {
		const note = this.note;
		return this.chatMessage ? null : note ? (note.renoteId ?? null) : null;
	}

	public get replyId(): string | null {
		const note = this.note;
		return this.chatMessage ? null : note ? (note.replyId ?? null) : null;
	}

	public get visibility(): string | null {
		const note = this.note;
		return this.chatMessage ? null : note ? (note.visibility ?? null) : null;
	}

	/**
	 * メンション部分を除いたテキスト本文
	 */
	public get extractedText(): string {
		const host = new URL(config.host).host.replace(/\./g, '\\.');
		return this.text
			.replace(new RegExp(`^@${this.ai.account.username}@${host}\\s`, 'i'), '')
			.replace(new RegExp(`^@${this.ai.account.username}\\s`, 'i'), '')
			.trim();
	}

	public friend: Friend;

	constructor(ai: 藍, chatMessageOrNote: any, isChat: boolean) {
		this.ai = ai;
		this.chatMessage = isChat ? chatMessageOrNote : null;
		this.note = isChat ? null : chatMessageOrNote;
		this.isChat = isChat;

		this.friend = new Friend(ai, { user: this.user });

		// メッセージなどに付いているユーザー情報は省略されている場合があるので完全なユーザー情報を持ってくる
		this.ai.api('users/show', {
			userId: this.userId
		}).then((user: any) => {
			this.friend.updateUser(user);
		});
	}

	@bindThis
	public async reply(text: string | null, opts?: {
		file?: any;
		cw?: string;
		renote?: string;
		immediate?: boolean;
	}) {
		if (text == null) return;

		this.ai.log(`>>> Sending reply to ${chalk.underline(this.id)}`);

		if (!opts?.immediate) {
			await sleep(2000);
		}

		if (this.chatMessage) {
			return await this.ai.sendMessage(this.chatMessage.fromUserId, {
				text: text,
				fileId: opts?.file?.id
			});
		} else {
			const note = this.note;
			if (!note) {
				return;
			}
			const payload: any = {
				replyId: note.id,
				text: text,
				fileIds: opts?.file ? [opts?.file.id] : undefined,
				cw: opts?.cw,
				renoteId: opts?.renote
			};
			if (note.visibility === 'specified') {
				payload.visibility = 'specified';
				payload.visibleUserIds = Array.isArray((note as any).visibleUserIds) ? (note as any).visibleUserIds : [note.userId];
			} else if (note.visibility === 'followers') {
				payload.visibility = 'followers';
			}
			return await this.ai.post(payload);
		}
	}

	@bindThis
	public includes(words: string[]): boolean {
		return includes(this.text, words);
	}

	@bindThis
	public or(words: (string | RegExp)[]): boolean {
		return or(this.text, words);
	}
}
