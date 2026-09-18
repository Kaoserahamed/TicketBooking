'use strict';
// Route layer - public venue endpoints. No auth needed (storefront reads).
const express = require('express');
const c = require('../controllers/venue.controller');
const validate = require('../middlewares/validate');
const { listVenuesQuerySchema, venueIdParamSchema, listSeatsQuerySchema } = require('../validators/venue.validator');
const asyncHandler = require('../utils/async-handler');
const router = express.Router();
router.get('/', validate(listVenuesQuerySchema, 'query'), asyncHandler(c.listVenues));
router.get('/:id', validate(venueIdParamSchema, 'params'), asyncHandler(c.getVenue));
router.get('/:id/seats', validate(venueIdParamSchema, 'params'), validate(listSeatsQuerySchema, 'query'), asyncHandler(c.listSeats));
module.exports = router;
