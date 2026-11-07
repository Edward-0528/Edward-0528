// Site settings. Edit this file; nothing else needs to change.
window.SITE_CONFIG = {
  productName: "Ship It Twice",            // working name, rename freely
  price: "$19",                            // launch price shown when checkout is live
  // Leave empty to run the page as a WAITLIST. Paste a Lemon Squeezy / Stripe
  // payment link to switch the page into BUY mode.
  checkoutUrl: "",
  // Email capture. Leave endpoint empty until connected (see site/README.md).
  // Supabase example:
  //   endpoint: "https://YOUR-PROJECT.supabase.co/rest/v1/waitlist",
  //   headers: { apikey: "ANON_KEY", Authorization: "Bearer ANON_KEY", Prefer: "return=minimal" }
  waitlist: {
    endpoint: "",
    headers: {}
  },
  // Shown on the page. Fill in when the apps are live.
  links: {
    appStore: "",
    googlePlay: ""
  }
};
