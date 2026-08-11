import { DefaultChatTransport } from 'ai';

export const buildGeneralTransport = (opts = {}) => {
  const { targetId, scenario, baseUrl } = opts;
  const base = baseUrl || import.meta.env.VITE_API_URL || '/api/v1';
  return new DefaultChatTransport({
    api: `${base}/ai/blocknote/generate`,
    headers: () => {
      const token = localStorage.getItem('token');
      const orgId = localStorage.getItem('currentOrganizationId');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (orgId) headers['X-Organization-ID'] = orgId;
      return headers;
    },
    prepareSendMessagesRequest: ({
      id,
      messages,
      requestMetadata,
      body,
      credentials,
      headers,
      api,
    }) => {
      // console.log('Transport prepareSendMessagesRequest messages:', messages);
      // console.log('Transport prepareSendMessagesRequest requestMetadata:', requestMetadata);
      // console.log('Transport prepareSendMessagesRequest id:', id);
      // console.log('Transport prepareSendMessagesRequest credentials:', credentials);
      // console.log('Transport prepareSendMessagesRequest headers:', headers);
      // console.log('Transport prepareSendMessagesRequest api:', api);
      // console.log('Transport prepareSendMessagesRequest body:', body);
      return {
        body: {
          ...body,
          id,
          messages,
          requestMetadata,
          credentials,
          targetId,
          scenario,
        },
      };
    },
  });
};

