import express from "express";
import { CronJob } from "cron";
import { appendFile } from "fs/promises";
import puppeteer from "puppeteer";
import { AppfolioListings } from "./utils/types/AppfolioListings";
import {
	assert,
	getSupabaseResultString,
	toFirstUpperCase,
	tryJson,
} from "./utils";
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

const scrape = async (
	pmListingsUrl: string,
	pmId: number,
	createdAtMap: Record<string, string>,
	callback: (
		listings: Omit<Database["public"]["Tables"]["listings"]["Row"], "id">[]
	) => void | Promise<void>
) => {
	const browser = await puppeteer.launch({ headless: "shell" });
	const page = await browser.newPage();
	page.on("response", async (res) => {
		const json = await tryJson(res);
		if (json.name !== "appfolio-listings") return;
		const appfolioListings = assert<AppfolioListings>(json);
		const listings = appfolioListings?.values;
		if (!listings) return [];
		const parsed = parseListings(listings, pmId, createdAtMap);
		await callback(parsed);
	});

	await page.goto(pmListingsUrl, {
		waitUntil: "networkidle0",
	});
	await browser.close();
};

const parseListings = (
	listings: AppfolioListings["values"],
	pmId: number,
	createdAtMap: Record<string, string>
) => {
	if (!listings) return [];
	const arr: Omit<Database["public"]["Tables"]["listings"]["Row"], "id">[] =
		listings.map(({ data }) => {
			if (!data?.listable_uid) throw new Error("No listable_uid found");
			const pmListableUid = pmId + "-" + data?.listable_uid;
			const now = new Date().toISOString();
			return {
				address_address1: data?.address_address1 ?? null,
				address_address2: data?.address_address2 ?? null,
				address_city: toFirstUpperCase(
					data?.address_city ?? "City Unlisted",
					" "
				),
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
				property_management_id: pmId,
				pm_listable_uid: pmListableUid,
				square_feet: data?.square_feet ?? 0,
				unlisted_at: null,
				updated_at: new Date().toISOString(),
				created_at: createdAtMap[pmListableUid] ?? now,
			};
		});
	return arr;
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

app.get("/", async (req, res) => {
	// res.send("Uwu hewo there");
	// await scrape((json) => {
	// 	const str = JSON.stringify(json.values[0], null, 2);
	// 	res.send(str);
	// });
});

app.listen(port, async () => {
	console.log("Started listening on port: ", port);
	const supabase = createClient<Database>(
		process.env.SUPABASE_URL as string,
		process.env.SUPABASE_SUPERUSER_KEY as string
	);

	const testQuery = await supabase.from("listings").select("id");
	const testMsg = `TEST QUERY\n` + getSupabaseResultString(testQuery);
	console.log(testMsg);

	const unlistQuery = await supabase
		.from("listings")
		.update({ unlisted_at: new Date().toISOString() })
		.gt("id", -1)
		.select("pm_listable_uid, created_at");
	if (unlistQuery.error) {
		const msg =
			`Failed to update listings\n` + getSupabaseResultString(unlistQuery);
		console.error(msg);
		await logger(msg);
		return;
	}

	const createdAtMap = unlistQuery.data.reduce<Record<string, string>>(
		(acc, { pm_listable_uid, created_at }) => ({
			...acc,
			[pm_listable_uid]: created_at,
		}),
		{}
	);
	const pmQuery = await supabase.from("property_managements").select("*");
	if (pmQuery.error) {
		const msg =
			`Failed to query property managements\n` +
			getSupabaseResultString(pmQuery);
		console.error(msg);
		await logger(msg);
		return;
	}
	// console.log(pmQuery.data);
	pmQuery.data.forEach(async ({ id, listings_url }) => {
		console.log("scrape started on " + listings_url);
		await scrape(listings_url, id, createdAtMap, async (listings) => {
			const upsert = await supabase.from("listings").upsert(listings, {
				onConflict: "pm_listable_uid",
			});
			const msg =
				`Upsert finished for pm ${id} ${listings_url}\n` +
				getSupabaseResultString(upsert);
			console.log(msg);
			await logger(msg);
		});
	});

	// job.start();
	// await scrape(() => {});
});
