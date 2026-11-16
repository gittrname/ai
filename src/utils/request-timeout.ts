export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export function withRequestTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
	label: string = 'request',
): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;

	return Promise.race([
		promise.finally(() => {
			if (timer) {
				clearTimeout(timer);
			}
		}),
		new Promise<T>((_, reject) => {
			timer = setTimeout(() => {
				reject(new Error(`${label} timed out after ${timeoutMs}ms`));
			}, timeoutMs);
		}),
	]);
}
