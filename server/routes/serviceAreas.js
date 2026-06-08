const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const {
  getAll,
  getActive,
  create,
  update,
  remove,
} = require('../controllers/serviceAreaController');

const router = express.Router();

router.get('/active', getActive);

router.use(authenticate);

router.get('/', getAll);

router.post('/', authorize('admin'), create);

router.patch('/:id', authorize('admin'), update);

router.delete('/:id', authorize('admin'), remove);

module.exports = router;
