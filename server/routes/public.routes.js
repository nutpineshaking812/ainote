import express from 'express';
import {
  publicGetSharedRecord,
  publicUpdateSharedRecord,
} from '../controllers/recordShare.controller.js';
import {
  publicGetForm,
  publicSubmitForm,
  publicQueryRecords,
} from '../controllers/publicPublish.controller.js';
import {
  publicExternalSubmit,
  publicExternalGetRecords,
  publicExternalUpdateRecord,
  publicExternalDeleteRecord,
} from '../controllers/publicApi.controller.js';
const router = express.Router();

// Public form structure (fill/query/record modes)
router.get('/forms/:formId', publicGetForm);
// Public submit (fill)
router.post('/forms/:formId/submit', publicSubmitForm);
// External API submit (webhook)
router.post('/forms/:formId/external/submit', publicExternalSubmit);
// External API query
router.get('/forms/:formId/external/records', publicExternalGetRecords);
// External API update
router.post('/forms/:formId/external/records/:recordId/update', publicExternalUpdateRecord);
// External API delete
router.post('/forms/:formId/external/records/:recordId/delete', publicExternalDeleteRecord);
// Public query (query link)
router.get('/forms/:formId/records', publicQueryRecords);
// Alias for query
router.get('/forms/:formId/query', publicQueryRecords);
// Public single record share
router.get('/forms/:formId/records/:recordId', publicGetSharedRecord);
router.post('/forms/:formId/records/:recordId/update', publicUpdateSharedRecord);

export default router;
