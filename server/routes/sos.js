const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const {
  triggerSOS,
  resolveAlert,
  getAlerts,
  getMyContacts,
  addContact,
  removeContact,
} = require('../controllers/sosController');

const router = express.Router();

router.use(authenticate);

router.post('/trigger', authorize('passenger'), triggerSOS);
router.patch('/:id/resolve', authorize('admin'), resolveAlert);
router.get('/alerts', authorize('admin'), getAlerts);
router.get('/contacts', getMyContacts);
router.post('/contacts', addContact);
router.delete('/contacts/:id', removeContact);

module.exports = router;
