// app.vraelis.com/developers — the AUTHENTICATED developer console.
//
// Deliberately a different page from vraelis.com/developers, which is public documentation. The host
// decides which one you get (see proxy.ts). They are not re-exported through each other and must not be
// merged: one is readable before you have an account and exists to explain the product, the other requires
// a session and issues live credentials that spend money.
//
// Keys live here rather than in Settings. Creating a key, choosing its scopes and setting its daily spend
// ceiling are one decision made in one place, and splitting them across two destinations is how a person
// ends up with a key that can launch runs but no memory of granting it that.
//
// This aliases the existing /api console rather than reimplementing it, so the two URLs cannot drift while
// the rename is in progress. /api keeps working.
import ApiKeysPage from "../api/page";

export default ApiKeysPage;
