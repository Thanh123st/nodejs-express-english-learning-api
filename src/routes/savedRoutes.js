const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { saveItem, removeSaved, listSaved } = require('../controllers/savedController');


router.post('/', verifyToken, saveItem);
router.delete('/:kind/:refId', verifyToken, removeSaved);
router.get('/', verifyToken, listSaved);

module.exports = router;
