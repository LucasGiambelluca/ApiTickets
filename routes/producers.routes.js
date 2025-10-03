const { Router } = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const requireFields = require('../middlewares/requireFields');
const { createProducer, searchProducers } = require('../controllers/producers.controller');

const router = Router();
router.get('/search', asyncHandler(searchProducers));
router.post('/', requireFields(['name']), asyncHandler(createProducer));

module.exports = router;
