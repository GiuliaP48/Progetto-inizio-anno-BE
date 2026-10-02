
const calendarioService = require('../services/calendario_service');

const gestisciErrore = require('../eccezioni/gestisci_errore');

// POST /calendari/crea
async function createCalendario(req, res) {
    try {
        const { nome, tipo, colore, permesso_modifica } = req.body;

        const nuovoCalendario = await calendarioService.createCalendario(
            nome, tipo, colore, permesso_modifica, req.utente_id
        );

        res.status(201).json(nuovoCalendario);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante la creazione del calendario');
    }
}

// GET /calendari/dettagli/:id
async function getCalendarioById(req, res) {
    try {
        const calendario = await calendarioService.getCalendarioById(req.params.id, req.utente_id);
        res.status(200).json(calendario);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore nel recupero del calendario');
    }
}

// GET /calendari/lista
async function getCalendariByUtente(req, res) {
    try {
        const calendari = await calendarioService.getCalendariByUtente(req.utente_id);
        res.status(200).json(calendari);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore nel recupero dei calendari');
    }
}

// PUT /calendari/modifica/:id
async function updateCalendario(req, res) {
    try {
        const calendarioAggiornato = await calendarioService.updateCalendario(req.params.id, req.body, req.utente_id);
        res.status(200).json(calendarioAggiornato);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante la modifica del calendario');
    }
}

// DELETE /calendari/elimina/:id
async function deleteCalendario(req, res) {
    try {
        await calendarioService.deleteCalendario(req.params.id, req.utente_id);
        res.status(204).send();
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante l\'eliminazione del calendario');
    }
}

// POST /calendari/invita/:id
async function inviteMembro(req, res) {
    try {
        const { email } = req.body;

        const calendarioAggiornato = await calendarioService.inviteMembro(req.params.id, email, req.utente_id);

        res.status(200).json(calendarioAggiornato);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante l\'invito');
    }
}

// DELETE /calendari/rimuovi-membro/:id/:utenteId
async function removeMembro(req, res) {
    try {
        const calendarioAggiornato = await calendarioService.removeMembro(
            req.params.id, req.params.utenteId, req.utente_id
        );

        res.status(200).json(calendarioAggiornato);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante la rimozione del membro');
    }
}

// PUT /calendari/stato-invito/:id/:utenteId
async function updateStatoInvito(req, res) {
    try {
        const { risposta } = req.body;

        const calendarioAggiornato = await calendarioService.updateStatoInvito(
            req.params.id, req.params.utenteId, risposta, req.utente_id
        );

        res.status(200).json(calendarioAggiornato);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante la risposta all\'invito');
    }
}

// PUT /calendari/permesso-modifica/:id/:utenteId
async function updatePermessoMembro(req, res) {
    try {
        const { puo_modificare } = req.body;

        const calendarioAggiornato = await calendarioService.updatePermessoMembro(
            req.params.id, req.params.utenteId, puo_modificare, req.utente_id
        );

        res.status(200).json(calendarioAggiornato);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante la modifica del permesso');
    }
}

module.exports = {
    createCalendario,
    getCalendarioById,
    getCalendariByUtente,
    updateCalendario,
    deleteCalendario,
    inviteMembro,
    removeMembro,
    updateStatoInvito,
    updatePermessoMembro,
};