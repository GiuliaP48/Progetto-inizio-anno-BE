
const express = require('express');
const router = express.Router();

const elementoTodoController = require('../controllers/elemento_to_do_controller');

const verificaToken = require('../middleware/autenticazione_middleware');

router.post('/crea/:todoId', verificaToken, elementoTodoController.createElementoToDo);
router.get('/lista/:todoId', verificaToken, elementoTodoController.getElementiToDoByTodo);
router.put('/modifica/:id', verificaToken, elementoTodoController.updateElementoToDo);
router.put('/completa/:id', verificaToken, elementoTodoController.completaElementoToDo);
router.delete('/elimina/:id', verificaToken, elementoTodoController.deleteElementoToDo);

module.exports = router;