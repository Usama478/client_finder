import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

export const fetchHistory = async () => {
    const response = await api.get('/sessions/1');
    return response.data;
};

export const startSearch = async (query: string, pageToken?: string) => {
    const payload: any = { user_id: 1, query };
    if (pageToken) payload.page_token = pageToken;
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

export default api;
