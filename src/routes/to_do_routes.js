
const express = require('express');
const router = express.Router();

const todoController = require('../controllers/to_do_controller');

const verificaToken = require('../middleware/autenticazione_middleware');

router.post('/crea/:calendarioId', verificaToken, todoController.createTodo);
router.get('/dettagli/:id', verificaToken, todoController.getTodoById);
router.get('/lista/:calendarioId', verificaToken, todoController.getTodosByCalendario);
router.put('/modifica/:id', verificaToken, todoController.updateTodo);
router.delete('/elimina/:id', verificaToken, todoController.deleteTodo);
router.put('/rimanda/:id', verificaToken, todoController.postponeTodo);
router.get('/resoconto/:calendarioId', verificaToken, todoController.getResoconto);

module.exports = router;