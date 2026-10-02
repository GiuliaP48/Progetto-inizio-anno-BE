
const notificaService = require('../services/notifica_service');

const gestisciErrore = require('../eccezioni/gestisci_errore');

// GET /notifiche/lista
async function getNotificheByUtente(req, res) {
    try {
        const { stato } = req.query;
        const notifiche = await notificaService.getNotificheByUtente(req.utente_id, stato);
        res.status(200).json(notifiche);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore nel recupero delle notifiche');
    }
}

// PUT /notifiche/segna-letta/:id
async function notificaLetta(req, res) {
    try {
        const notificaAggiornata = await notificaService.notificaLetta(req.params.id, req.utente_id);
        res.status(200).json(notificaAggiornata);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante l\'aggiornamento della notifica');
    }
}

// PUT /notifiche/segna-tutte-lette
async function segnaTutteLette(req, res) {
    try {
        const risultato = await notificaService.segnaTutteLette(req.utente_id);
        res.status(200).json(risultato);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante l\'aggiornamento delle notifiche');
    }
}

// DELETE /notifiche/elimina/:id
async function deleteNotifica(req, res) {
    try {
        await notificaService.deleteNotifica(req.params.id, req.utente_id);
        res.status(204).send();
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante l\'eliminazione della notifica');
    }
}

module.exports = {
    getNotificheByUtente,
    notificaLetta,
    segnaTutteLette,
    deleteNotifica,
};