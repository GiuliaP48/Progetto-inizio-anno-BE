
const prisma = require('../persistence/db_config');

// Creazione nuova preferenza vista
async function createPreferenzaVista(dati) {
    return prisma.preferenzaVista.create({ data: dati });
}

// Ricerca preferenza vista di un utente per uno specifico calendario
async function getPreferenzaVista(utente_id, calendario_id) {
    return prisma.preferenzaVista.findUnique({
        where: {
            utente_id_calendario_id: {
                utente_id,
                calendario_id,
            },
        },
    });
}

// Aggiornamento preferenza vista esistente
async function updatePreferenzaVista(utente_id, calendario_id, vista) {
    return prisma.preferenzaVista.update({
        where: {
            utente_id_calendario_id: {
                utente_id,
                calendario_id,
            },
        },
        data: { vista },
    });
}

module.exports = {
    createPreferenzaVista,
    getPreferenzaVista,
    updatePreferenzaVista,
};