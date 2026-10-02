
const express = require('express');
const router = express.Router();

const preferenzaVistaController = require('../controllers/preferenza_vista_controller');

const verificaToken = require('../middleware/autenticazione_middleware');

router.put('/imposta/:calendarioId', verificaToken, preferenzaVistaController.setPreferenzaVista);
router.get('/visualizza/:calendarioId', verificaToken, preferenzaVistaController.getPreferenzaVista);

module.exports = router;