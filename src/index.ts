/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */


import { AutoRouter } from "itty-router";

interface DomainStatus {
	status: string[];
}

const router = AutoRouter();

router.get("/api/check", async ({ query, headers }, env: Env, _: ExecutionContext) => {
	const { domain } = query as { domain: string };
	const ip = headers.get("cf-connecting-ip") || "unknown";

	// Validate domain format (6-9 digits .xyz)
	if (!domain || !/^\d{6,9}\.xyz$/.test(domain)) {
		return Response.json(
			{ message: "Invalid numeric .xyz domain format" },
			{ status: 400 },
		);
	}

	// Rate limiting
	const rateLimitKey = `rate_limit:${ip}`;
	const limit = 100; // Requests per hour
	const currentCount = parseInt((await env.xyz.get(rateLimitKey)) || "0");

	if (currentCount >= limit) {
		return Response.json(
			{ message: `Rate limit exceeded (${limit} requests/hour)` },
			{ status: 429 },
		);
	}

	// Increment counter (TTL 1 hour)
	await env.xyz.put(rateLimitKey, (currentCount + 1).toString(), {
		expirationTtl: 3600,
	});

	// Proxy to Domainr API
	try {
		const response = await fetch(
			`https://domainr.p.rapidapi.com/v2/status?mashape-key=${env.DOMAINR_API_KEY}&domain=${domain}`
		);

		if (!response.ok) throw new Error("API request failed");

		const data = await response.json<DomainStatus>();
		return Response.json(data);
	} catch (error) {
		return Response.json(
			{ message: "Domain check service unavailable" },
			{status: 502 },
		);
	}
})

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		return router.fetch<[Env, ExecutionContext]>(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
