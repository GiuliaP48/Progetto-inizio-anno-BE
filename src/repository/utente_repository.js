
const prisma = require('../persistence/db_config');

// Creazione nuovo utente
async function createUtente(dati) {
    return prisma.utente.create({ data: dati });
}

// Ricerca utente tramite email
async function getUtenteByEmail(email) {
    return prisma.utente.findUnique({ where: { email } });
}

// Ricerca utente tramite id
async function getUtenteById(id) {
    return prisma.utente.findUnique({ where: { id } });
}

// Ricerca di più utenti tramite i loro id (solo i dati pubblici, senza password)
async function getUtentiByIds(ids) {
    return prisma.utente.findMany({
        where: { id: { in: ids } },
        select: { id: true, nome: true, cognome: true, email: true },
    });
}

// Modifica dati di un utente
async function updateUtente(id, dati) {
    return prisma.utente.update({ where: { id }, data: dati });
}

// Eliminazione di un utente, in un'unica transazione (o si fa tutto, o niente):
// - i calendari condivisi passano al nuovo amministratore, l'utente viene tolto dai calendari degli altri
// - si eliminano le sue notifiche, preferenze vista e refresh token
// - nei contenuti che ha creato, modificato o completato il suo id diventa null (i contenuti restano)
async function deleteUtente(id, cessioni, uscite) {
    return prisma.$transaction(async (tx) => {
        for (const cessione of cessioni) {
            await tx.calendario.update({
                where: { id: cessione.calendario.id },
                data: {
                    utente_id: cessione.nuovoAmministratore.utente_id,
                    membri: cessione.nuoviMembri,
                },
            });
        }

        for (const uscita of uscite) {
            await tx.calendario.update({
                where: { id: uscita.calendario.id },
                data: { membri: uscita.nuoviMembri },
            });
        }

        await tx.notifica.deleteMany({ where: { utente_id: id } });
        await tx.preferenzaVista.deleteMany({ where: { utente_id: id } });
        await tx.refreshToken.deleteMany({ where: { utente_id: id } });

        // I contenuti restano nei calendari: tolgo solo il suo id da chi li ha creati, modificati e completati
        await tx.nota.updateMany({ where: { creato_da: id }, data: { creato_da: null } });
        await tx.nota.updateMany({ where: { modificato_da: id }, data: { modificato_da: null } });

        await tx.todo.updateMany({ where: { creato_da: id }, data: { creato_da: null } });
        await tx.todo.updateMany({ where: { modificato_da: id }, data: { modificato_da: null } });

        await tx.evento.updateMany({ where: { creato_da: id }, data: { creato_da: null } });
        await tx.evento.updateMany({ where: { modificato_da: id }, data: { modificato_da: null } });

        await tx.tag.updateMany({ where: { creato_da: id }, data: { creato_da: null } });
        await tx.tag.updateMany({ where: { modificato_da: id }, data: { modificato_da: null } });

        await tx.elementoToDo.updateMany({ where: { creato_da: id }, data: { creato_da: null } });
        await tx.elementoToDo.updateMany({ where: { completato_da: id }, data: { completato_da: null } });
        await tx.elementoToDo.updateMany({ where: { modificato_da: id }, data: { modificato_da: null } });

        return tx.utente.delete({ where: { id } });
    }, { timeout: 60000 });
}

module.exports = {
    createUtente,
    getUtenteByEmail,
    getUtenteById,
    getUtentiByIds,
    updateUtente,
    deleteUtente,
};