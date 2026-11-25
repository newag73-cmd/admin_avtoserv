const buckets=new Map<string,{start:number;count:number}>();
export function rateLimited(key:string,limit:number,windowMs:number,now=Date.now()){const bucket=buckets.get(key);if(!bucket||now-bucket.start>=windowMs){buckets.set(key,{start:now,count:1});return false;}bucket.count++;return bucket.count>limit;}
export function resetRateLimitsForTests(){buckets.clear();}
