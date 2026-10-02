
const express = require('express');
const router = express.Router();

const refreshTokenController = require('../controllers/refresh_token_controller');

const verificaToken = require('../middleware/autenticazione_middleware');

router.post('/rinnova', refreshTokenController.updateRefreshToken);
router.delete('/logout', refreshTokenController.deleteRefreshToken);
router.get('/sessioni', verificaToken, refreshTokenController.listaSessioniUtente);

module.exports = router;