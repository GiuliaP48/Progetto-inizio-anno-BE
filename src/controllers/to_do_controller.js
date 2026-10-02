
const todoService = require('../services/to_do_service');

const gestisciErrore = require('../eccezioni/gestisci_errore');

// POST /todos/crea/:calendarioId
async function createTodo(req, res) {
    try {
        const { titolo, data_originale, tipo, priorita, posizione } = req.body;

        const nuovoTodo = await todoService.createTodo(
            req.params.calendarioId, titolo, data_originale, tipo, priorita, posizione, req.utente_id
        );

        res.status(201).json(nuovoTodo);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante la creazione del todo');
    }
}

// GET /todos/dettagli/:id
async function getTodoById(req, res) {
    try {
        const todo = await todoService.getTodoById(req.params.id, req.utente_id);
        res.status(200).json(todo);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore nel recupero del todo');
    }
}

// GET /todos/lista/:calendarioId
async function getTodosByCalendario(req, res) {
    try {
        const { tipo, data, ordine } = req.query;
        const todos = await todoService.getTodosByCalendario(
            req.params.calendarioId, tipo, data, ordine, req.utente_id
        );
        res.status(200).json(todos);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore nel recupero dei todo');
    }
}

// PUT /todos/modifica/:id
async function updateTodo(req, res) {
    try {
        const todoAggiornato = await todoService.updateTodo(req.params.id, req.body, req.utente_id);
        res.status(200).json(todoAggiornato);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante la modifica del todo');
    }
}

// PUT /todos/rimanda/:id
async function postponeTodo(req, res) {
    try {
        const todoAggiornato = await todoService.postponeTodo(req.params.id, req.utente_id);
        res.status(200).json(todoAggiornato);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante il rimando del todo');
    }
}

// GET /todos/resoconto/:calendarioId
async function getResoconto(req, res) {
    try {
        const { periodo, data } = req.query;
        const resoconto = await todoService.getResoconto(req.params.calendarioId, periodo, data, req.utente_id);
        res.status(200).json(resoconto);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore nel calcolo del resoconto');
    }
}

// DELETE /todos/elimina/:id
async function deleteTodo(req, res) {
    try {
        await todoService.deleteTodo(req.params.id, req.utente_id);
        res.status(204).send();
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante l\'eliminazione del todo');
    }
}

module.exports = {
    createTodo,
    getTodoById,
    getTodosByCalendario,
    updateTodo,
    postponeTodo,
    getResoconto,
    deleteTodo
};