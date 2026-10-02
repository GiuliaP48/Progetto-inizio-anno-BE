
const notaService = require('../services/nota_service');

const gestisciErrore = require('../eccezioni/gestisci_errore');

// POST /note/crea/:calendarioId
async function createNota(req, res) {
    try {
        const { testo, data, tipo } = req.body;

        const nuovaNota = await notaService.createNota(req.params.calendarioId, testo, data, tipo, req.utente_id);

        res.status(201).json(nuovaNota);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante la creazione della nota');
    }
}

// GET /note/lista/:calendarioId
async function getNoteByCalendario(req, res) {
    try {
        const note = await notaService.getNoteByCalendario(req.params.calendarioId, req.utente_id);
        res.status(200).json(note);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore nel recupero delle note');
    }
}

// PUT /note/modifica/:id
async function updateNota(req, res) {
    try {
        const notaAggiornata = await notaService.updateNota(req.params.id, req.body, req.utente_id);
        res.status(200).json(notaAggiornata);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante la modifica della nota');
    }
}

// DELETE /note/elimina/:id
async function deleteNota(req, res) {
    try {
        await notaService.deleteNota(req.params.id, req.utente_id);
        res.status(204).send();
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante l\'eliminazione della nota');
    }
}

module.exports = {
    createNota,
    getNoteByCalendario,
    updateNota,
    deleteNota,
};