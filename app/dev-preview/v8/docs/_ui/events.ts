// The docs' window events, in a module of their own so search and the assistant can open each other without
// importing each other.

export const SEARCH_EVENT = "v8-docs-search";
export const ASK_EVENT = "v8-docs-ask";

export const openSearch = () => window.dispatchEvent(new CustomEvent(SEARCH_EVENT));
/** Opens the assistant; with a question, asks it straight away. */
export const openAsk = (question?: string) => window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: { question } }));
