
const eventoService = require('../services/evento_service');

const gestisciErrore = require('../eccezioni/gestisci_errore');

// POST /eventi/crea
async function createEvento(req, res) {
    try {
        const {
            titolo, descrizione, data_inizio, data_fine, tutto_il_giorno,
            ricorrenza, fine_ricorrenza, colore, avviso, calendario_ids,
        } = req.body;

        const nuovoEvento = await eventoService.createEvento(
            titolo, descrizione, data_inizio, data_fine, tutto_il_giorno,
            ricorrenza, fine_ricorrenza, colore, avviso, calendario_ids, req.utente_id
        );

        res.status(201).json(nuovoEvento);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante la creazione dell\'evento');
    }
}

// GET /eventi/dettagli/:id
async function getEventoById(req, res) {
    try {
        const evento = await eventoService.getEventoById(req.params.id, req.utente_id);
        res.status(200).json(evento);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore nel recupero dell\'evento');
    }
}

// GET /eventi/lista/:calendarioId
async function getEventiByCalendario(req, res) {
    try {
        const { da, a } = req.query;
        const eventi = await eventoService.getEventiByCalendario(req.params.calendarioId, da, a, req.utente_id);
        res.status(200).json(eventi);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore nel recupero degli eventi');
    }
}

// GET /eventi/lista-tag/:tagId
async function getEventiByTag(req, res) {
    try {
        const eventi = await eventoService.getEventiByTag(req.params.tagId, req.utente_id);
        res.status(200).json(eventi);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore nel recupero degli eventi del tag');
    }
}

// PUT /eventi/modifica/:id
async function updateSingolaOccorrenza(req, res) {
    try {
        const eventoAggiornato = await eventoService.updateSingolaOccorrenza(req.params.id, req.body, req.utente_id);
        res.status(200).json(eventoAggiornato);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante la modifica dell\'evento');
    }
}

// PUT /eventi/modifica-serie/:id
async function updateSerieCompleta(req, res) {
    try {
        const risultato = await eventoService.updateSerieCompleta(req.params.id, req.body, req.utente_id);
        res.status(200).json(risultato);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante la modifica della serie');
    }
}

// POST /eventi/aggiungi-tag/:id
async function addTag(req, res) {
    try {
        const { tag_id } = req.body;
        const eventoAggiornato = await eventoService.addTag(req.params.id, tag_id, req.utente_id);
        res.status(200).json(eventoAggiornato);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante l\'aggiunta del tag');
    }
}

// DELETE /eventi/elimina/:id
async function deleteSingolaOccorrenza(req, res) {
    try {
        await eventoService.deleteSingolaOccorrenza(req.params.id, req.utente_id);
        res.status(204).send();
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante l\'eliminazione dell\'evento');
    }
}

// DELETE /eventi/elimina-serie/:id
async function deleteSerieCompleta(req, res) {
    try {
        await eventoService.deleteSerieCompleta(req.params.id, req.utente_id);
        res.status(204).send();
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante l\'eliminazione della serie');
    }
}

// DELETE /eventi/rimuovi-tag/:id
async function removeTag(req, res) {
    try {
        const { tag_id } = req.body;
        const eventoAggiornato = await eventoService.removeTag(req.params.id, tag_id, req.utente_id);
        res.status(200).json(eventoAggiornato);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante la rimozione del tag');
    }
}

module.exports = {
    createEvento,
    getEventoById,
    getEventiByCalendario,
    getEventiByTag,
    updateSingolaOccorrenza,
    updateSerieCompleta,
    deleteSingolaOccorrenza,
    deleteSerieCompleta,
    addTag,
    removeTag
};