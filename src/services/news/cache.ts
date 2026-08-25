import { MemoryCache } from "@/services/market/cache";
import type { StoredNews } from "./types";

export const newsListCache = new MemoryCache<StoredNews[]>();
