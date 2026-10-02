
const express = require('express');
const router = express.Router();

const notaController = require('../controllers/nota_controller');

const verificaToken = require('../middleware/autenticazione_middleware');

router.post('/crea/:calendarioId', verificaToken, notaController.createNota);
router.get('/lista/:calendarioId', verificaToken, notaController.getNoteByCalendario);
router.put('/modifica/:id', verificaToken, notaController.updateNota);
router.delete('/elimina/:id', verificaToken, notaController.deleteNota);

module.exports = router;