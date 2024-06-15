import { HTTPResponse } from "puppeteer";

export const tryJson = async (response: HTTPResponse) => {
	try {
		return (await response.json()) as Record<string, any>;
	} catch (e) {
		// console.error("Not valid json");
		return {};
	}
};

export const assert = <T>(p: unknown) => {
	return p as T;
};
