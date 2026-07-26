// THE IN-APP CHECKOUT FLAG.
//
// Off, everything is exactly as it was: /checkout mounts Stripe's embedded Checkout and the intent route
// does not exist. On, /checkout renders our own screen and confirms a Payment Element against a
// subscription created in `default_incomplete`.
//
// It is deliberately NOT NEXT_PUBLIC_. The server decides which checkout to render and the client is told
// what it is rendering, so there is exactly one authority. A public flag would let the two disagree, and
// the shape of that disagreement is a payment form pointed at an endpoint that is not enabled.
//
// DEFAULT OFF, and it must stay that way until the flow has been exercised end to end in Stripe TEST mode:
// a successful card, a declined card, a 3D Secure challenge, an abandoned payment, and a refresh mid-flow.
// This is the one part of the product where being wrong costs money in both directions, and the existing
// Checkout path is known-good, so it stays as the fallback rather than being deleted.
export function customCheckoutEnabled(): boolean {
  return (process.env.VRAELIS_CUSTOM_CHECKOUT ?? "").trim() === "1";
}
