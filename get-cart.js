
// api/get-cart.js
// Fetch Shein Kuwait cart URL and return normalized items
export default async function handler(req, res){
  try{
    const url = req.query.url;
    if(!url || !/^https?:\/\//i.test(url)){
      return res.status(400).json({error:'missing_or_invalid_url'});
    }
    // Basic fetch with headers to look like a browser
    const resp = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9,ar;q=0.8'
      }
    });
    const html = await resp.text();

    // Try to locate embedded JSON (Next.js/NUXT) patterns
    const jsonCandidates = [];
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) jsonCandidates.push(nextDataMatch[1]);
    const nuxtMatch = html.match(/window\.__NUXT__\s*=\s*(\{[\s\S]*?\});/);
    if (nuxtMatch) jsonCandidates.push(nuxtMatch[1]);
    const ldMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    if (ldMatch) jsonCandidates.push(ldMatch[1]);

    let items = [];
    for (const raw of jsonCandidates){
      try{
        const data = JSON.parse(raw);
        // Heuristics: look for items arrays with price & quantity
        const candidates = findItemsDeep(data);
        if (candidates.length){
          items = normalizeItems(candidates);
          break;
        }
      }catch(e){/* continue */}
    }

    // Fallback: very simple regex for product tiles (best-effort)
    if (!items.length){
      const titles = [...html.matchAll(/"name"\s*:\s*"([^"]+)"/g)].map(m=>m[1]).slice(0,10);
      const images = [...html.matchAll(/"image"\s*:\s*"(https?:[^"]+)"/g)].map(m=>m[1]).slice(0,10);
      const prices = [...html.matchAll(/"price"\s*:\s*"?(\\d+(?:\\.\\d+)?)"?/g)].map(m=>parseFloat(m[1])).slice(0,10);
      const qtys = [...html.matchAll(/"quantity"\s*:\s*(\\d+)/g)].map(m=>parseInt(m[1])).slice(0,10);
      for (let i=0;i<Math.min(titles.length, prices.length);i++){
        items.push({
          title: titles[i],
          image: images[i] || null,
          price_kwd: prices[i],
          qty: qtys[i] || 1
        });
      }
    }

    // If still nothing, return an error
    if (!items.length){
      return res.status(422).json({error:'parse_failed'});
    }

    // Convert KWD -> USD -> IQD
    const KWD_USD = 3.25; // approx
    const USD_IQD = 1350; // fixed per user
    const normalized = items.map(it=>{
      const price_usd = (it.price_kwd ?? it.priceKwd ?? it.price ?? 0) * KWD_USD;
      return {
        title: it.title || it.name || '',
        image: it.image || it.img || null,
        qty: it.qty || it.quantity || 1,
        price_usd: +price_usd.toFixed(2)
      };
    });

    return res.status(200).json({ currency:'USD', items: normalized });

  }catch(err){
    console.error(err);
    return res.status(500).json({error:'server_error'});
  }
}

// Recursively find arrays that look like cart items
function findItemsDeep(obj){
  const out = [];
  const stack = [obj];
  while (stack.length){
    const cur = stack.pop();
    if (!cur) continue;
    if (Array.isArray(cur)){
      // Look for entries with price & title
      const looksLike = cur.filter(x=>x && typeof x==='object' && hasAny(x,['price','price_kwd','priceKwd']) && hasAny(x,['title','name']));
      if (looksLike.length){
        out.push(...looksLike);
      }
    } else if (typeof cur==='object'){
      for (const k in cur){
        if (!Object.prototype.hasOwnProperty.call(cur,k)) continue;
        const v = cur[k];
        if (v && (typeof v==='object' || Array.isArray(v))) stack.push(v);
      }
    }
  }
  return out.slice(0,30);
}
function hasAny(o,keys){ return keys.some(k=>k in o); }
function normalizeItems(arr){ return arr.map(x=>({
  title: x.title || x.name || '',
  image: x.image || x.img || null,
  price_kwd: x.price_kwd ?? x.priceKwd ?? x.price ?? 0,
  qty: x.qty || x.quantity || 1
})); }
