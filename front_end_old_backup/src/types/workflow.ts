import type { SearchResult } from "./search-result";

export type WorkflowStageId =
  | "search"
  | "relevancy"
  | "validation"
  | "clients"
  | "details";

export interface BusinessDetailsNavigationState {
  business?: SearchResult | null;
  sourceStage?: Exclude<WorkflowStageId, "details">;
  sourceLabel?: string;
  searchId?: string | null;
}
