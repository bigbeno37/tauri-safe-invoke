import {invoke} from '@tauri-apps/api';
import {z, ZodSchema} from 'zod';
import { InvokeArgs } from '@tauri-apps/api/tauri';

/**
 * Represents validation for a Result returned from invocation of a command.
 */
type ResultSchema<R extends z.ZodSchema, E extends z.ZodSchema> = {
	/**
	 * The schema for Ok results.
	 */
	ok: R;

	/**
	 * The schema for Err results.
	 */
	err: E;
};

/**
 * Configuration for whether safe invocations should throw errors.
 */
type ThrowParseError<T extends boolean> = {
	throwParseError: T;
}

/**
 * Represents the result of a safe invocation.
 */
type SafeInvokeResult<D, E> = { ok: true, data: D } | { ok: false, error: E };

/**
 * Utility type to return the result of a safeParse call on a Zod schema.
 */
type SafeParse<T extends z.ZodSchema> = ReturnType<T['safeParse']>;

const isResultSchema = <R extends z.ZodSchema, E extends z.ZodSchema>(schema: z.ZodSchema | ResultSchema<R, E>): schema is ResultSchema<R, E> => {
	return !!((schema as ResultSchema<R, E>).ok && (schema as ResultSchema<R, E>).err);
};

/**
 * Returns a function that, when called, invokes the given command in the Tauri backend. When a response is received
 * from the invocation, it will be compared against the given schema and, by default, will throw an Error if the
 * response doesn't match the given schema.
 *
 * @param command The command to be invoked.
 * @param schema The Zod schema(s) to use when checking the response of an invocation.
 * @param config Configuration for the generated invocation function.
 */
export const createSafeInvoker = <S extends ZodSchema | ResultSchema<ZodSchema, ZodSchema>, C extends ThrowParseError<boolean>>
	(command: string, schema: S, config?: C) => async <T extends Record<string, unknown> | void>(data: T): Promise<
		S extends ZodSchema
			? C extends ThrowParseError<false>
				? SafeInvokeResult<SafeParse<S>, unknown>
				: SafeInvokeResult<z.infer<S>, unknown>
			: S extends ResultSchema<infer R, infer E>
				? C extends ThrowParseError<false>
					? SafeInvokeResult<SafeParse<R>, SafeParse<E>>
					: SafeInvokeResult<z.infer<R>, z.infer<E>>
				: never
	> => {

		let parseResult;

		try {
			const response = await invoke(command, data as InvokeArgs);

			parseResult = isResultSchema(schema) ? schema.ok.safeParse(response) : schema.safeParse(response);

			if (config && !config.throwParseError) {
			// TODO: Remove any
				return { ok: true, data: parseResult } as any;
			}
		} catch (e) {
			if (!isResultSchema(schema)) {
			// TODO: Remove any
				return { ok: false, error: e } as any;
			}

			const result = schema.err.safeParse(e);

			if (config && !config.throwParseError) {
			// TODO: Remove any
				return { ok: false, error: result } as any;
			}

			if (!result.success) {
				throw new Error(`Invalid error type received while invoking command "${command}"! Cause: ${result.error.format()._errors}`);
			}

			// TODO: Remove any
			return { ok: false, data: result.data } as any;
		}

		if (!parseResult.success) {
			throw new Error(`Invalid response received while invoking command "${command}"! Cause: ${parseResult.error.format()._errors}`);
		}

		// TODO: Remove any
		return { ok: true, data: parseResult.data } as any;
	};