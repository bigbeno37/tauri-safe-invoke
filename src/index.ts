import {invoke} from '@tauri-apps/api';
import {z} from "zod";

type ResultSchema<R extends z.ZodSchema, E extends z.ZodSchema> = {
	ok: R;
	err: E;
};

type ThrowParseError<T extends boolean> = {
	throwParseError: T;
}

type SafeInvokeResult<D, E> = { ok: true, data: D } | { ok: false, error: E };
type SafeParse<T extends z.ZodSchema> = ReturnType<T["safeParse"]>;

type SafeInvoke<T> = <U extends Record<string, unknown> | void>(data: U) => Promise<T>;

type CreateSafeInvoker = {
	<R extends z.ZodSchema>(command: string, responseSchema: R, config?: ThrowParseError<true>): SafeInvoke<SafeInvokeResult<z.infer<R>, unknown>>;
	<R extends z.ZodSchema>(command: string, responseSchema: R, config: ThrowParseError<false>): SafeInvoke<SafeInvokeResult<SafeParse<R>, unknown>>;
	<R extends z.ZodSchema, E extends z.ZodSchema>(command: string, resultSchema: ResultSchema<R, E>, config?: ThrowParseError<true>): SafeInvoke<SafeInvokeResult<z.infer<R>, z.infer<E>>>;
	<R extends z.ZodSchema, E extends z.ZodSchema>(command: string, resultSchema: ResultSchema<R, E>, config: ThrowParseError<false>): SafeInvoke<SafeInvokeResult<SafeParse<R>, SafeParse<E>>>;
};

const isResultSchema = <R extends z.ZodSchema, E extends z.ZodSchema>(schema: z.ZodSchema | ResultSchema<R, E>): schema is ResultSchema<R, E> => {
	return !!((schema as ResultSchema<R, E>).ok && (schema as ResultSchema<R, E>).err);
};

export const createSafeInvoker: CreateSafeInvoker = <R extends z.ZodSchema, E extends z.ZodSchema>(command: string, schema: R | ResultSchema<R, E>, config: ThrowParseError<boolean> | undefined): SafeInvoke<SafeInvokeResult<R, unknown>> | SafeInvoke<SafeInvokeResult<SafeParse<R>, unknown>> | SafeInvoke<SafeInvokeResult<R, E>> | SafeInvoke<SafeInvokeResult<SafeParse<R>, SafeParse<E>>> =>
	async data => {
		let validationResult;

		try {
			const response = invoke(command, data as Record<string, unknown>);

			validationResult = isResultSchema(schema) ? schema.ok.safeParse(response) : schema.safeParse(response);
		} catch (e) {
			if (!isResultSchema(schema)) {
				return { ok: false, error: e };
			}

			validationResult = schema.err.safeParse(e);
		}

		if (config && !config.throwParseError) {
			return {ok: true, data: validationResult};
		}

		if (!validationResult.success) {
			throw new Error("Response from invoked command did not match expected schema! Cause:" + validationResult.error.format());
		}

		return { ok: true, data: validationResult.data };
	};