
const elementoTodoService = require('../services/elemento_to_do_service');

const gestisciErrore = require('../eccezioni/gestisci_errore');

// POST /elementi-to-do/crea/:todoId
async function createElementoToDo(req, res) {
    try {
        const { testo, posizione, priorita } = req.body;

        const nuovoElemento = await elementoTodoService.createElementoToDo(
            req.params.todoId, testo, posizione, priorita, req.utente_id
        );

        res.status(201).json(nuovoElemento);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante la creazione dell\'elemento');
    }
}

// GET /elementi-to-do/lista/:todoId
async function getElementiToDoByTodo(req, res) {
    try {
        const { ordine } = req.query;
        const elementi = await elementoTodoService.getElementiToDoByTodo(req.params.todoId, ordine, req.utente_id);
        res.status(200).json(elementi);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore nel recupero degli elementi');
    }
}

// PUT /elementi-to-do/modifica/:id
async function updateElementoToDo(req, res) {
    try {
        const elementoAggiornato = await elementoTodoService.updateElementoToDo(req.params.id, req.body, req.utente_id);
        res.status(200).json(elementoAggiornato);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante la modifica dell\'elemento');
    }
}

// PUT /elementi-to-do/completa/:id
async function completaElementoToDo(req, res) {
    try {
        const { completato } = req.body;
        const elementoAggiornato = await elementoTodoService.completaElementoToDo(req.params.id, completato, req.utente_id);
        res.status(200).json(elementoAggiornato);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante l\'aggiornamento del completamento');
    }
}

// DELETE /elementi-to-do/elimina/:id
async function deleteElementoToDo(req, res) {
    try {
        await elementoTodoService.deleteElementoToDo(req.params.id, req.utente_id);
        res.status(204).send();
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante l\'eliminazione dell\'elemento');
    }
}

module.exports = {
    createElementoToDo,
    getElementiToDoByTodo,
    updateElementoToDo,
    completaElementoToDo,
    deleteElementoToDo,
};