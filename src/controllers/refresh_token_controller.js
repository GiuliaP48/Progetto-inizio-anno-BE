
const utenteService = require('../services/utente_service');
const refreshTokenService = require('../services/refresh_token_service');

const gestisciErrore = require('../eccezioni/gestisci_errore');

// POST /utenti/rinnova
async function updateRefreshToken(req, res) {
    try {
        const { refreshToken } = req.body;

        const nuovoAccessToken = await utenteService.updateAccessToken(refreshToken);

        res.status(200).json({ token: nuovoAccessToken });
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante il rinnovo del token');
    }
}

// DELETE /utenti/logout
async function deleteRefreshToken(req, res) {
    try {
        const { refreshToken } = req.body;

        await refreshTokenService.deleteRefreshToken(refreshToken);

        res.status(204).send();
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore durante il logout');
    }
}

// GET /utenti/sessioni (lista sessioni attive dell'utente loggato)
async function listaSessioniUtente(req, res) {
    try {
        const sessioni = await refreshTokenService.listaSessioniUtente(req.utente_id);
        res.status(200).json(sessioni);
    } catch (errore) {
        gestisciErrore(res, errore, 'Errore nel recupero delle sessioni');
    }
}

module.exports = {
    updateRefreshToken,
    deleteRefreshToken,
    listaSessioniUtente
};