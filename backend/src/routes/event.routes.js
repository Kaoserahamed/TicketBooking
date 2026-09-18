'use strict';
// Route layer - public event endpoints (docs/04-api-design.md 4.3).
// Mounted at /api/v1/events by src/app.js. No auth needed.
const express = require('express');
const c = require('../controllers/event.controller');
const validate = require('../middlewares/validate');
const { listEventsQuerySchema, eventIdParamSchema, listShowsQuerySchema } = require('../validators/event.validator');
const asyncHandler = require('../utils/async-handler');
const router = express.Router();
router.get('/', validate(listEventsQuerySchema, 'query'), asyncHandler(c.listEvents));
router.get('/:id', validate(eventIdParamSchema, 'params'), asyncHandler(c.getEvent));
router.get('/:id/shows', validate(eventIdParamSchema, 'params'), validate(listShowsQuerySchema, 'query'), asyncHandler(c.listShows));
module.exports = router;
