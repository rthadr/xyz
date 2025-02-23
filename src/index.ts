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

// export default {
// 	async fetch(request, env, ctx): Promise<Response> {

// 		const url = new URL(request.url);
// 		switch (url.pathname) {
// 			case '/message':
// 				return new Response('Hello, World!');
// 			case '/random':
// 				return new Response(crypto.randomUUID());
// 			default:
// 				return new Response('Not Found', { status: 404 });
// 		}
// 	},
// } satisfies ExportedHandler<Env>;

  
  interface DomainStatus {
	status: string[];
  }
  
  export default {
	async fetch(
	  request: Request,
	  env: Env,
	  ctx: ExecutionContext
	): Promise<Response> {
	  const url = new URL(request.url);
	  const domain = url.searchParams.get("domain");
	  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  
	  // Validate domain format (6-9 digits .xyz)
	  if (!domain || !/^\d{6,9}\.xyz$/.test(domain)) {
		return new Response(
		  JSON.stringify({ error: "Invalid numeric .xyz domain format" }),
		  { status: 400, headers: { "Content-Type": "application/json" } }
		);
	  }
  
	  // Rate limiting
	  const rateLimitKey = `rate_limit:${ip}`;
	  const limit = 100; // Requests per hour
	  const currentCount = parseInt((await env.xyz.get(rateLimitKey)) || "0");
  
	  if (currentCount >= limit) {
		return new Response(
		  JSON.stringify({ error: `Rate limit exceeded (${limit} requests/hour)` }),
		  { status: 429, headers: { "Content-Type": "application/json" } }
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
		return new Response(JSON.stringify(data), {
		  headers: {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
		  },
		});
	  } catch (error) {
		return new Response(
		  JSON.stringify({ error: "Domain check service unavailable" }),
		  { status: 502, headers: { "Content-Type": "application/json" } }
		);
	  }
	},
  } satisfies ExportedHandler<Env>;
  