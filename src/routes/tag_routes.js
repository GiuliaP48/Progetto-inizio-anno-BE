
const express = require('express');
const router = express.Router();

const tagController = require('../controllers/tag_controller');

const verificaToken = require('../middleware/autenticazione_middleware');

router.post('/crea/:calendarioId', verificaToken, tagController.createTag);
router.get('/lista/:calendarioId', verificaToken, tagController.getTagsByCalendario);
router.put('/modifica/:id', verificaToken, tagController.updateTag);
router.delete('/elimina/:id', verificaToken, tagController.deleteTag);

module.exports = router;