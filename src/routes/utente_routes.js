
const express = require('express');
const router = express.Router();

const utenteController = require('../controllers/utente_controller');

const verificaToken = require('../middleware/autenticazione_middleware');

router.post('/registrazione', utenteController.createUtente);
router.post('/login', utenteController.loginUtente);
router.get('/dettagli/:id', verificaToken, utenteController.getProfiloById);
router.put('/modifica/:id', verificaToken, utenteController.updateProfilo);
router.delete('/elimina/:id', verificaToken, utenteController.deleteProfilo);
router.get('/oggi', verificaToken, utenteController.getRiepilogoOggi);

module.exports = router;