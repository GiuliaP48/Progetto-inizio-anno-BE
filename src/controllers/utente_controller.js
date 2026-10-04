
const utenteService = require('../services/utente_service');

const gestisciErrore = require('../eccezioni/gestisci_errore');

// POST /utenti/registrazione
async function createUtente(req, res) {
    try {
        const { nome, cognome, email, password } = req.body;

        const nuovoUtente = await utenteService.createUtente(nome, cognome, email, password);

        res.status(201).json(nuovoUtente);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante la registrazione');
    }
}

// POST /utenti/login
async function loginUtente(req, res) {
    try {
        const { email, password } = req.body;
        const userAgent = req.headers['user-agent'];

        const risultato = await utenteService.loginUtente(email, password, userAgent);

        res.status(200).json(risultato);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante il login');
    }
}

// GET /utenti/dettagli/:id
async function getProfiloById(req, res) {
    try {
        const profilo = await utenteService.getProfiloById(req.params.id, req.utente_id);
        res.status(200).json(profilo);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore nel recupero del profilo');
    }
}

// PUT /utenti/modifica/:id
async function updateProfilo(req, res) {
    try {
        const utenteAggiornato = await utenteService.updateProfilo(req.params.id, req.body, req.utente_id);
        res.status(200).json(utenteAggiornato);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante la modifica del profilo');
    }
}

// DELETE /utenti/elimina/:id
async function deleteProfilo(req, res) {
    try {
        await utenteService.deleteUtente(req.params.id, req.utente_id);
        res.status(204).send();
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante l\'eliminazione dell\'account');
    }
}

// GET /utenti/oggi
async function getRiepilogoOggi(req, res) {
    try {
        const riepilogo = await utenteService.getRiepilogoOggi(req.utente_id);
        res.status(200).json(riepilogo);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore nel recupero del riepilogo di oggi');
    }
}

module.exports = {
    createUtente,
    loginUtente,
    getProfiloById,
    updateProfilo,
    deleteProfilo,
    getRiepilogoOggi
};