
const crypto = require('crypto');

const AppException = require('../eccezioni/app_eccezioni');

const refreshTokenRepository = require('../repository/refresh_token_repository');

const DURATA_REFRESH_TOKEN_GIORNI = 30;

// Genera una stringa casuale sicura da usare come refresh token
function generaTokenCasuale() {
    return crypto.randomBytes(40).toString('hex');
}

// Calcola una data di scadenza a partire da adesso
function calcolaScadenza() {
    const scadenza = new Date();
    scadenza.setDate(scadenza.getDate() + DURATA_REFRESH_TOKEN_GIORNI);
    return scadenza;
}

// Crea un nuovo refresh token per un utente (usato al login)
async function createRefreshToken(utente_id, dispositivo) {
    const token = generaTokenCasuale();
    const scadenza = calcolaScadenza();

    await refreshTokenRepository.createRefreshToken({
        token,
        scadenza,
        dispositivo,
        utente_id,
    });

    return token;
}

// Verifica un refresh token e, se valido, rinnova la sua scadenza
async function updateRefreshToken(tokenRicevuto) {
    // Vincoli sul refresh token
    if (!tokenRicevuto) {
        throw new AppException('Il refresh token è obbligatorio', 400);
    }

    if (typeof tokenRicevuto !== 'string') {
        throw new AppException('Il refresh token deve essere un testo', 400);
    }

    const recordToken = await refreshTokenRepository.getByRefreshToken(tokenRicevuto);

    if (!recordToken) {
        throw new AppException('Refresh token non valido', 401);
    }

    if (recordToken.scadenza < new Date()) {
        throw new AppException('Refresh token scaduto', 401);
    }

    const nuovaScadenza = calcolaScadenza();
    await refreshTokenRepository.updateScadenza(recordToken.id, nuovaScadenza);

    return recordToken.utente_id;
}

// Elimina un refresh token (usato al logout)
async function deleteRefreshToken(token) {
    // Vincoli sul refresh token
    if (!token) {
        throw new AppException('Il refresh token è obbligatorio', 400);
    }

    if (typeof token !== 'string') {
        throw new AppException('Il refresh token deve essere un testo', 400);
    }

    // Prima verifica che il refresh token esista:
    const refreshTokenTrovato = await refreshTokenRepository.getByRefreshToken(token);

    if (!refreshTokenTrovato) {
        throw new AppException('Refresh token non valido', 401);
    }

    return refreshTokenRepository.deleteRefreshToken(token);
}

// Restituisce le sessioni attive di un utente, senza esporre il valore del token
async function listaSessioniUtente(utente_id) {
    const sessioni = await refreshTokenRepository.getByUtenteId(utente_id);

    return sessioni.map(sessione => ({
        id: sessione.id,
        dispositivo: sessione.dispositivo,
        scadenza: sessione.scadenza,
    }));
}

module.exports = {
    createRefreshToken,
    updateRefreshToken,
    deleteRefreshToken,
    listaSessioniUtente,
};