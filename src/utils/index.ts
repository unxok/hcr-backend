import { PostgrestSingleResponse } from "@supabase/supabase-js";
import { HTTPResponse } from "puppeteer";

export const tryJson = async (response: HTTPResponse) => {
	try {
		return (await response.json()) as Record<string, any>;
	} catch (e) {
		// console.error("Not valid json");
		return {};
	}
};

/**
 * Asserts the passed value as the provided type.
 *
 * Warning: This bypassing actual type checking to assert the type, so always be sure it is of this type before calling `assert()`
 * @param p The value to assert the type for
 * @returns The same value as `p` but with the provided type `T`
 */
export const assert = <T>(p: unknown) => {
	return p as T;
};

/**
 * Takes a string with one or more words and capitalizes the first letter of each word
 * @param str The string to change
 * @param wordDelimeter The delimeter if `str` contains multiple words
 * @returns A string with the first letter of every word capitalized
 * ---
 * ```js
 *
 * toFirstUpperCase('teLePHonE') // 'Telephone'
 * toFirstUpperCase('HElLo wORlD', ' ') // 'Hello World'
 * ```
 */
export const toFirstUpperCase: (
	str: string,
	wordDelimeter?: string
) => string = (str, wordDelimeter) => {
	const lower = str.toLowerCase();
	if (wordDelimeter !== undefined && wordDelimeter !== null) {
		const words = lower.split(wordDelimeter);
		const resultArr = words.map((w) => toFirstUpperCase(w));
		return resultArr.join(wordDelimeter);
	}
	const chars = lower.split("");
	chars[0] = chars[0].toUpperCase();
	return chars.join("");
};

export const getSupabaseResultString = ({
	data,
	count,
	status,
	statusText,
	error,
}: PostgrestSingleResponse<any>) => {
	return `DATA LENGTH: ${
		data?.length
	}\nCOUNT: ${count}\nSTATUS: ${status}\nSTATUS TEXT: ${statusText}\nERROR: ${JSON.stringify(
		error,
		undefined,
		2
	)}`;
};
