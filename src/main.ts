import express from "express";
import { CronJob } from "cron";
import { appendFile } from "fs/promises";
import puppeteer from "puppeteer";
import { AppfolioListings } from "./types";
import { assert, tryJson } from "./utils";

const app = express();
const port = 3000;

const loop = async () => {
	console.log(new Date().toTimeString());
	await new Promise<void>((res, rej) => {
		setTimeout(() => {
			res();
		}, 3000);
	});
	loop();
};

const job = CronJob.from({
	cronTime: "*/3 * * * * *",
	onTick: async () => {
		await logger("Ticked cron");
	},
	timeZone: "America/Los_Angeles",
});

const logger = async (msg: string) => {
	const content = new Date().toLocaleString() + "\n" + msg + "\n\n";
	await appendFile("./src/log.txt", content);
};

const scrape = async (callback: (json: AppfolioListings) => void) => {
	const browser = await puppeteer.launch({ headless: "shell" });
	const page = await browser.newPage();
	page.on("response", async (res) => {
		const json = await tryJson(res);
		if (json.name !== "appfolio-listings") return;
		const appfolioListings = assert<AppfolioListings>(json);
		const arr = appfolioListings?.values?.map((v) => {
			// console.log("v: ", v);
			const { data, page_item_url } = v;
			if (!data || !page_item_url) return [];
			const { location, market_rent, deposit } = data;
		});
		console.log("arr: ", arr);
		console.table(arr, ["URL", "Address", "Rent", "Deposit"]);
	});

	await page.goto("https://www.humboldtrentals.com/vacancies", {
		waitUntil: "networkidle0",
	});
};

app.get("/", async (req, res) => {
	// res.send("Uwu hewo there");
	// await scrape((json) => {
	// 	const str = JSON.stringify(json.values[0], null, 2);
	// 	res.send(str);
	// });
});

app.listen(port, async () => {
	console.log("Started listening on port: ", port);
	// job.start();
	await scrape(() => {});
});
