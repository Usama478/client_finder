import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

export const fetchHistory = async () => {
    const response = await api.get('/sessions', {
        params: { user_id: 1 },
    });
    return response.data;
};

export const startSearch = async (query: string, pageToken?: string, contextId?: string | number | null) => {
    const payload: any = { user_id: 1, query };
    if (pageToken) payload.page_token = pageToken;
    if (contextId) payload.context_id = Number(contextId);

    const response = await api.post('/search', payload);
    return response.data;
};

export const fetchResults = async (searchId: string) => {
    const response = await api.get(`/results/${searchId}`);
    return response.data;
};

export const startRelevancyAgent = async (businessIds: string[]) => {
    const response = await api.post('/relevancy/analyze', { business_ids: businessIds.map(Number) });
    return response.data;
};

export const startVerificationAgent = async (businessIds: string[]) => {
    const response = await api.post('/verification/verify', { business_ids: businessIds.map(Number) });
    return response.data;
};

export const toggleClientStatus = async (resultId: string, isSaved: boolean) => {
    const response = await api.put(`/results/${resultId}/client-status`, { is_saved_client: isSaved });
    return response.data;
};

export const fetchSavedClients = async () => {
    const response = await api.get('/clients');
    return response.data;
};

export const fetchContexts = async () => {
    const response = await api.get('/contexts');
    return response.data;
};

export const createContext = async (name: string, prompt_text: string) => {
    const response = await api.post('/contexts', { name, prompt_text });
    return response.data;
};

export const fetchDashboardStats = async () => {
    const response = await api.get('/dashboard/stats');
    return response.data;
};

export const fetchApiHealth = async () => {
    const response = await api.get('/health');
    return response.data;
};

export const exportClients = async (resultIds: string[] = []) => {
    // We use native fetch here instead of axios to perfectly handle the binary Blob
    // without any of the global axios JSON interceptors mangling the stream.
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';

    // Ensure payload is an array of strings
    const payload = Array.isArray(resultIds) ? resultIds.map(String) : [];

    const response = await fetch(`${baseUrl}/export`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Export failed with status ${response.status}: ${errText}`);
    }

    return await response.blob();
};

export default api;
