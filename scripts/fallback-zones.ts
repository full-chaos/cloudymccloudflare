/**
 * Dev/script-only fallback data for `seed-zones.ts` when the Cloudflare API
 * is unreachable or no token is configured.
 *
 * Intentionally lives OUTSIDE `src/shared` so this committed account-specific
 * personal data never leaks into the runtime client or server bundles. The
 * runtime path reads zones from D1 `zone_cache`, populated by `/api/zones`.
 */

export const ACCOUNT_ID = "f39dbcd4130fd731be7f0f77bf013e01";

export const ZONES: { id: string; name: string }[] = [
  { id: "0507721e1eefbed0f93e10b6983eff6c", name: "mightytrashpanda.dev" },
  { id: "8550303e52098679733b63803181ec51", name: "mightytrashpanda.com" },
  { id: "615f346606b354dc1200db522eb0981f", name: "fullchaos.tech" },
  { id: "8bae68ff4a396acb94e2c457fcecf513", name: "fullchaos.studio" },
  { id: "dd654de232784868fd034b946528f1b7", name: "fullchaos.org" },
  { id: "04fc96385a5991bd57defaacfcd27536", name: "fullchaos.net" },
  { id: "5bf19e8b032c8671e753604c0e56f2b6", name: "fullchaos.dev" },
  { id: "24a424692800da637d70262de43e79fe", name: "fullchaos.ai" },
  { id: "0d9a31d813bbdaac0488dc822f65157c", name: "davegregory.tech" },
  { id: "d314a006653b964408b99bd470956056", name: "davegregory.org" },
  { id: "a223f5314177f0f919c4459b0487ae1e", name: "dave-gregory.com" },
  { id: "7bd5f8d674b6a39d2ff158508b86cc22", name: "commanderkeen.dev" },
  { id: "d4e0e5cb04c33dd18c9f914ba77101ac", name: "commanderkeen.app" },
  { id: "535231ab69787f91488472cfe9d69734", name: "chrisphotography.org" },
  { id: "83896835b6a21a369a05ae9c445faad0", name: "chrisphotography.net" },
  { id: "eb07012c131c2b8899fb7ae06f0a3bb0", name: "chrisgeorge.tech" },
  { id: "342de3830abbe5055c1b9b011b5aa906", name: "chrisgeorge.studio" },
  { id: "feea84875a995e214e0719182427779d", name: "chrisgeorge.pro" },
  { id: "f0c84429d434ee8adec88d725d8b53b3", name: "chrisgeorgephotography.com" },
  { id: "7af7b7c79536943e5b43a36275b47dab", name: "chrisgeorge.org" },
  { id: "427b2035c9f305d07b6c7e11928e9334", name: "chrisgeorge.online" },
  { id: "cac40ca96d01167ef2a9d65ccc25f322", name: "chrisgeorge.me" },
  { id: "e93f62f006353e212fce461b996b1542", name: "chrisgeorge.live" },
  { id: "a3426d037b06d714165acdfa4054d42b", name: "chrisgeorge.email" },
  { id: "6a9359ef67601bc017a32a96f66b9ca3", name: "chrisgeorge.co" },
  { id: "7349b83573f1ba4692e0815d7a0946a9", name: "chrisgeorge.cloud" },
  { id: "5d535601a903832f0ddb4226d1e03ab0", name: "chrisgeorge.biz" },
  { id: "0818cdbe6740f3aad35fecebe1d864ca", name: "chrisgeorge.app" },
  { id: "97a2445c1bcc049ace8468c6dc0f06ee", name: "chrisgeorge.ai" },
  { id: "2d5c5392de780dc530414dcaa5aa209a", name: "chaosispeace.com" },
  { id: "fcf3e3eb4d7787baa9af6602e5fd5b09", name: "cg.contractors" },
];
