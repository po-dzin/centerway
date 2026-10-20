# Sign-in returns to the page the person requested

The sign-in return contract applies to any CenterWay page that offers an
authentication action. It preserves the current page's path, query and fragment
through the profile, email-code and Google flows, then returns to that page
after a session is established. Targets are restricted to the current origin
and the two CenterWay application origins by `safeReturnTarget`.

A promo link includes both `offer_token` and `offer_code`; `/go/way21` resolves
it to the program storefront with those parameters. The shared sign-in links
carry that complete storefront URL as `next`, so if authentication is requested
during that flow, the offer and its format survive the round trip. The same
mechanism works for direct lesson links and other in-app destinations. Tests
cover the tokenized promo destination and a deep lesson link. `LmsNotice` uses
the shared `useSignInHref` contract for unauthenticated and expired-session
notices on course pages.
