'use strict';
// Route layer - public show endpoints (docs/04-api-design.md 4.3-4.4).
// Mounted at /api/v1/shows by src/app.js. No auth needed.
const express = require('express');
const c = require('../controllers/show.controller');
const validate = require('../middlewares/validate');
const { listShowsQuerySchema, showIdParamSchema } = require('../validators/show.validator');
const asyncHandler = require('../utils/async-handler');
const router = express.Router();
router.get('/', validate(listShowsQuerySchema, 'query'), asyncHandler(c.listShows));
router.get('/:id', validate(showIdParamSchema, 'params'), asyncHandler(c.getShow));
router.get('/:id/seats', validate(showIdParamSchema, 'params'), asyncHandler(c.seatMap));
router.get(
  '/:id/availability',
  validate(showIdParamSchema, 'params'),
  asyncHandler(c.availability)
);
module.exports = router;
