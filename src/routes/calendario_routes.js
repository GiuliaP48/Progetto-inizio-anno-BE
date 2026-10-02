
const express = require('express');
const router = express.Router();

const calendarioController = require('../controllers/calendario_controller');

const verificaToken = require('../middleware/autenticazione_middleware');

router.post('/crea', verificaToken, calendarioController.createCalendario);
router.get('/lista', verificaToken, calendarioController.getCalendariByUtente);
router.get('/dettagli/:id', verificaToken, calendarioController.getCalendarioById);
router.put('/modifica/:id', verificaToken, calendarioController.updateCalendario);
router.delete('/elimina/:id', verificaToken, calendarioController.deleteCalendario);
router.post('/invita/:id', verificaToken, calendarioController.inviteMembro);
router.delete('/rimuovi-membro/:id/:utenteId', verificaToken, calendarioController.removeMembro);
router.put('/stato-invito/:id/:utenteId', verificaToken, calendarioController.updateStatoInvito);
router.put('/permesso-modifica/:id/:utenteId', verificaToken, calendarioController.updatePermessoMembro);

module.exports = router;