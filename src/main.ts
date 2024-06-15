import express from "express";
import { CronJob } from "cron";
import { appendFile } from "fs/promises";
import puppeteer from "puppeteer";
import { AppfolioListings } from "./utils/types/AppfolioListings";
import { assert, tryJson } from "./utils";
import { createClient } from "@supabase/supabase-js";
import { Database } from "./utils/types/supabase";

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

const scrape = async (
	callback: (json: AppfolioListings) => void | Promise<void>
) => {
	const browser = await puppeteer.launch({ headless: "shell" });
	const page = await browser.newPage();
	page.on("response", async (res) => {
		const json = await tryJson(res);
		if (json.name !== "appfolio-listings") return;
		const appfolioListings = assert<AppfolioListings>(json);
		await callback(appfolioListings);
		// page.close();
	});

	await page.goto("https://www.humboldtrentals.com/vacancies", {
		waitUntil: "networkidle0",
	});
};

const parseListings = (listings: AppfolioListings["values"]) => {
	if (!listings) return [];
	const arr: Omit<Database["public"]["Tables"]["Listings"]["Row"], "id">[] =
		listings.map(({ data }) => {
			if (!data?.listable_uid) throw new Error("No listable_uid found");
			return {
				address_address1: data?.address_address1 ?? null,
				address_address2: data?.address_address2 ?? null,
				address_city: data?.address_city ?? null,
				address_country: data?.address_country ?? null,
				address_latitude: data?.address_latitude?.toString() ?? null,
				address_longitude: data?.address_longitude?.toString() ?? null,
				full_address: data?.full_address ?? null,
				available_date: data?.available_date ?? null,
				deposit: data?.deposit ?? null,
				market_rent: data?.market_rent ?? null,
				marketing_title: data?.marketing_title ?? null,
				bathrooms: data?.bathrooms ?? null,
				bedrooms: data?.bedrooms ?? null,
				cats: data?.cats === "Cats not allowed" ? false : true,
				dogs: data?.dogs === "Dogs not allowed" ? false : true,
				default_photo_thumbnail_url: data?.default_photo_thumbnail_url ?? null,
				photos: data?.photos ?? [],
				listable_uid: data?.listable_uid,
			};
		});
	return arr;
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
	console.log("skey: ", process.env.SUPABASE_KEY);
	const supabase = createClient<Database>(
		process.env.SUPABASE_URL as string,
		process.env.SUPABASE_KEY as string
	);

	await scrape(async (appfolioListings) => {
		const listings = appfolioListings?.values;
		if (!listings) return;
		const parsed = parseListings(listings);
		const insert = await supabase.from("Listings").insert(parsed);
		console.log(
			`Insert finished: ${insert.error} ${insert.status} ${insert.statusText}`
		);
	});
	// job.start();
	// await scrape(() => {});
});
