
const express = require('express');
const router = express.Router();

const notificaController = require('../controllers/notifica_controller');

const verificaToken = require('../middleware/autenticazione_middleware');

router.get('/lista', verificaToken, notificaController.getNotificheByUtente);
router.put('/segna-letta/:id', verificaToken, notificaController.notificaLetta);
router.put('/segna-tutte-lette', verificaToken, notificaController.segnaTutteLette);
router.delete('/elimina/:id', verificaToken, notificaController.deleteNotifica);

module.exports = router;