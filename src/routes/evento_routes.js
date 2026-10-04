
const express = require('express');
const router = express.Router();

const eventoController = require('../controllers/evento_controller');

const verificaToken = require('../middleware/autenticazione_middleware');

router.post('/crea', verificaToken, eventoController.createEvento);
router.get('/dettagli/:id', verificaToken, eventoController.getEventoById);
router.get('/lista/:calendarioId', verificaToken, eventoController.getEventiByCalendario);
router.get('/lista-tag/:tagId', verificaToken, eventoController.getEventiByTag);
router.put('/modifica/:id', verificaToken, eventoController.updateSingolaOccorrenza);
router.put('/modifica-serie/:id', verificaToken, eventoController.updateSerieCompleta);
router.delete('/elimina/:id', verificaToken, eventoController.deleteSingolaOccorrenza);
router.delete('/elimina-serie/:id', verificaToken, eventoController.deleteSerieCompleta);
router.post('/aggiungi-tag/:id', verificaToken, eventoController.addTag);
router.delete('/rimuovi-tag/:id', verificaToken, eventoController.removeTag);
router.post('/aggiungi-tag-serie/:id', verificaToken, eventoController.addTagSerie);
router.delete('/rimuovi-tag-serie/:id', verificaToken, eventoController.removeTagSerie);

module.exports = router;