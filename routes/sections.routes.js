const { Router } = require('express');
const asyncHandler = require('../middlewares/asyncHandler');
const requireFields = require('../middlewares/requireFields');
const { createSection } = require('../controllers/sections.controller');

const router = Router();
router.post('/:showId/sections',
  requireFields(['name','capacity','priceCents']),
  asyncHandler(createSection)
);

module.exports = router;

