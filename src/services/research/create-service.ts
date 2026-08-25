import "server-only";

import { ResearchService } from "./research-service";
import { supabaseResearchPersistence } from "./persistence";

export function createResearchService(): ResearchService {
  return new ResearchService(supabaseResearchPersistence);
}
