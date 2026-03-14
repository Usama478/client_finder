export interface SearchSession {
  search_id: number;
  user_id?: number;
  query?: string;
  search_query?: string;
  search_location?: string | null;
  search_filters?: Record<string, unknown> | null;
  context_id?: number | null;
  next_page_token?: string | null;
  total_results?: number | null;
  created_at?: string | null;
}

export const getSearchSessionQuery = (session: SearchSession) =>
  session.query || session.search_query || `Search #${session.search_id}`;
