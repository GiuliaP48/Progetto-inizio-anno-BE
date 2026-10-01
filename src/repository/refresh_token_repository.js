const prisma = require('../persistence/db_config');

// Creazione nuovo refresh token
async function createRefreshToken(dati) {
    return prisma.refreshToken.create({
        data: dati,
    });
}

// Ricerca di un singolo refresh token tramite il suo valore
async function getByRefreshToken(token) {
    return prisma.refreshToken.findUnique({
        where: { token },
    });
}

// Ricerca di tutti i refresh token di un utente (le sue sessioni)
async function getByUtenteId(utente_id) {
    return prisma.refreshToken.findMany({
        where: { utente_id },
    });
}

// Aggiornamento scadenza di un refresh token esistente
async function updateScadenza(id, nuovaScadenza) {
    return prisma.refreshToken.update({
        where: { id },
        data: { scadenza: nuovaScadenza },
    });
}

// Eliminazione refresh token (usato per il logout)
async function deleteRefreshToken(token) {
    return prisma.refreshToken.delete({
        where: { token },
    });
}

module.exports = {
    createRefreshToken,
    getByRefreshToken,
    getByUtenteId,
    updateScadenza,
    deleteRefreshToken
};