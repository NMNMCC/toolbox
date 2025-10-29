export type AnyObject = Record<string, unknown>

export type Pair<X extends string, Y extends string> = `${X}.${Y}`

export type WithContext<Context = unknown, O extends AnyObject = AnyObject> = {
	context: Context
} & O

export type WithType<
	T extends string = string,
	O extends AnyObject = AnyObject,
> = {type: T} & O

export type Path<T, S extends string> = T extends object
	? {
			[K in keyof T]: `${Exclude<K, symbol>}${Path<T[K], S> extends never ? "" : `${S}${Path<T[K], S>}`}`
		}[keyof T]
	: never

export type FromPath<
	T,
	P extends string,
	S extends string,
> = P extends `${infer K}${S}${infer R}`
	? K extends keyof T
		? FromPath<T[K], R, S>
		: never
	: P extends keyof T
		? T[P]
		: never

export const final = async <T extends AsyncGenerator<any, any, any>>(
	generator: T,
	...middlewares: (<
		U extends Promise<
			T extends AsyncGenerator<infer Y, any, any> ? Y : never
		>,
	>(
		value: U,
	) => Promise<U>)[]
): Promise<T extends AsyncGenerator<any, infer R, any> ? R : never> => {
	let result = await generator.next()

	while (!result.done) {
		result = await generator.next(
			await middlewares.reduce(
				async (acc, middleware) => await middleware(await acc),
				result.value,
			),
		)
	}

	return result.value
}
