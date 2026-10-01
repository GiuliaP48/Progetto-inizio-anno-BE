
const prisma = require('../persistence/db_config');

// Creazione nuova notifica
async function createNotifica(dati) {
    return prisma.notifica.create({ data: dati });
}

// Ricerca delle notifiche di un utente, dalla più recente, con letta (true/false) solo quelle lette o non lette
async function getNotificheByUtente(utente_id, letta) {
    const where = { utente_id };

    if (letta !== undefined) {
        where.letta = letta;
    }

    return prisma.notifica.findMany({
        where,
        orderBy: { data_generazione: 'desc' },
    });
}

// Ricerca notifica tramite id
async function getNotificaById(id) {
    return prisma.notifica.findUnique({ where: { id } });
}

// Segna una notifica come letta
async function segnaComeLetta(id) {
    return prisma.notifica.update({
        where: { id },
        data: { letta: true },
    });
}

// Segna come lette tutte le notifiche non lette di un utente (restituisce quante sono state aggiornate)
async function segnaTutteComeLette(utente_id) {
    return prisma.notifica.updateMany({
        where: { utente_id, letta: false },
        data: { letta: true },
    });
}

// Eliminazione notifica
async function deleteNotifica(id) {
    return prisma.notifica.delete({ where: { id } });
}

// Eliminazione delle notifiche già lette generate prima di una certa data
async function deleteNotificheLetteVecchie(limite) {
    return prisma.notifica.deleteMany({
        where: {
            letta: true,
            data_generazione: { lt: limite },
        },
    });
}

// Verifica se esiste già una notifica di tipo "avviso_evento" per un evento e utente specifici
async function existsNotificaAvviso(evento_id, utente_id) {
    const notifica = await prisma.notifica.findFirst({
        where: {
            evento_id,
            utente_id,
            tipo: 'avviso_evento',
        },
    });
    return notifica !== null;
}

module.exports = {
    createNotifica,
    getNotificheByUtente,
    getNotificaById,
    segnaComeLetta,
    segnaTutteComeLette,
    deleteNotifica,
    deleteNotificheLetteVecchie,
    existsNotificaAvviso
};