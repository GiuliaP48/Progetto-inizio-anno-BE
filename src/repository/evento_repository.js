
const prisma = require('../persistence/db_config');

// Tag collegati nell'evento, solo con i dati che servono nella risposta
const tagEvento = {
    tags: { select: { id: true, nome: true, colore: true } },
};

// Creazione di un evento e delle sue eventuali occorrenze, in un'unica transazione (o vengono creati tutti, o nessuno)
async function createEvento(dati, occorrenze, calendario_ids, creato_da) {
    const collegamenti = {
        // connect collega l'evento al creatore e ai calendari.
        // Per i calendari scrive l'id in tutti e due i lati: il calendario nell'evento (calendario_ids) e l'evento nel calendario (evento_ids)
        creatore: { connect: { id: creato_da } },
        calendari: { connect: calendario_ids.map(id => ({ id })) },
    };

    return prisma.$transaction(async (tx) => {
        const eventoPadre = await tx.evento.create({
            data: { ...dati, ...collegamenti },
            include: tagEvento,
        });

        for (const occorrenza of occorrenze) {
            await tx.evento.create({
                data: {
                    ...occorrenza,
                    ...collegamenti,
                    evento_padre: { connect: { id: eventoPadre.id } },
                },
            });
        }

        return eventoPadre;
    }, { timeout: 60000 });
}

// Visualizza evento tramite id
async function getEventoById(id) {
    return prisma.evento.findUnique({ where: { id }, include: tagEvento });
}

// Visualizza tutti gli eventi collegati a un calendario, in ordine di data
// - con da: solo gli eventi che finiscono da quel momento in poi
// - con fino: solo quelli che iniziano prima di quel momento
async function getEventiByCalendario(calendario_id, da, fino) {
    const where = {
        calendario_ids: {
            has: calendario_id,
        },
    };

    if (da) {
        where.data_fine = { gte: da };
    }

    if (fino) {
        where.data_inizio = { lt: fino };
    }

    return prisma.evento.findMany({
        where,
        include: tagEvento,
        orderBy: { data_inizio: 'asc' },
    });
}

// Visualizza tutti gli eventi collegati a un tag, in ordine di data
async function getEventiByTag(tag_id) {
    return prisma.evento.findMany({
        where: { tag_ids: { has: tag_id } },
        include: tagEvento,
        orderBy: { data_inizio: 'asc' },
    });
}

// Ricerca degli eventi con un avviso che iniziano da una certa data in poi (usato per generare le notifiche di avviso)
async function getEventiFuturiConAvviso(da) {
    return prisma.evento.findMany({
        where: {
            avviso: { not: null },
            data_inizio: { gte: da },
        },
    });
}

// Modifica dati di un evento
async function updateEvento(id, dati) {
    return prisma.evento.update({ where: { id }, data: dati, include: tagEvento });
}

// Modifica di un'intera serie ricorrente (padre + tutte le occorrenze), in un'unica transazione
// I dati uguali per tutti (titolo, colore...) vengono copiati
// le date vengono spostate della stessa "quantità" (in millisecondi)
async function updateSerie(evento_padre_id, dati, spostamentoInizio, spostamentoFine) {
    return prisma.$transaction(async (tx) => {
        const occorrenze = await tx.evento.findMany({
            where: {
                OR: [
                    { id: evento_padre_id },
                    { evento_padre_id: evento_padre_id },
                ],
            },
        });

        for (const occorrenza of occorrenze) {
            const nuoviDati = { ...dati };

            if (spostamentoInizio !== 0 || spostamentoFine !== 0) {
                nuoviDati.data_inizio = new Date(occorrenza.data_inizio.getTime() + spostamentoInizio);
                nuoviDati.data_fine = new Date(occorrenza.data_fine.getTime() + spostamentoFine);

                if (occorrenza.data_occorrenza_originale) {
                    nuoviDati.data_occorrenza_originale = new Date(occorrenza.data_occorrenza_originale.getTime() + spostamentoInizio);
                }
            }

            await tx.evento.update({ where: { id: occorrenza.id }, data: nuoviDati });
        }

        return occorrenze.length;
    }, { timeout: 60000 });
}

// Eliminazione di un singolo evento (o occorrenza), in un'unica transazione
// se è il primo di una serie, la seconda occorrenza diventa il nuovo primo
// prima di eliminarlo lo si scollega da calendari e tag (set: [] toglie il suo id anche dalle loro liste)
async function deleteEvento(id) {
    return prisma.$transaction(async (tx) => {
        const occorrenze = await tx.evento.findMany({
            where: { evento_padre_id: id },
            orderBy: { data_inizio: 'asc' },
            select: { id: true },
        });

        if (occorrenze.length > 0) {
            const nuovoPadreId = occorrenze[0].id;

            await tx.evento.updateMany({
                where: { evento_padre_id: id, id: { not: nuovoPadreId } },
                data: { evento_padre_id: nuovoPadreId },
            });

            await tx.evento.update({
                where: { id: nuovoPadreId },
                data: { evento_padre_id: null },
            });
        }

        // Gli avvisi di un evento eliminato non servono più
        await tx.notifica.deleteMany({ where: { evento_id: id } });

        await tx.evento.update({
            where: { id },
            data: { calendari: { set: [] }, tags: { set: [] } },
        });

        return tx.evento.delete({ where: { id } });
    });
}

// Eliminazione di un evento padre e di tutte le sue occorrenze figlie, in un'unica transazione
// prima si scollegano tutti da calendari e tag, poi si eliminano le figlie e infine il padre
async function deleteSerieCompleta(evento_padre_id) {
    return prisma.$transaction(async (tx) => {
        const occorrenze = await tx.evento.findMany({
            where: {
                OR: [
                    { id: evento_padre_id },
                    { evento_padre_id: evento_padre_id },
                ],
            },
            select: { id: true },
        });

        // Gli avvisi delle occorrenze eliminate non servono più
        await tx.notifica.deleteMany({ where: { evento_id: { in: occorrenze.map(occorrenza => occorrenza.id) } } });

        for (const occorrenza of occorrenze) {
            await tx.evento.update({
                where: { id: occorrenza.id },
                data: { calendari: { set: [] }, tags: { set: [] } },
            });
        }

        await tx.evento.deleteMany({
            where: { evento_padre_id },
        });

        return tx.evento.delete({
            where: { id: evento_padre_id },
        });
    }, { timeout: 60000 });
}

// Aggiunge un tag a un evento (connect aggiorna anche la lista degli eventi del tag)
async function addTag(evento_id, tag_id, modificato_da) {
    return prisma.evento.update({
        where: { id: evento_id },
        data: {
            tags: { connect: { id: tag_id } },
            modificatore: { connect: { id: modificato_da } },
        },
        include: tagEvento,
    });
}

// Rimuove un tag da un evento (disconnect aggiorna anche la lista degli eventi del tag)
async function removeTag(evento_id, tag_id, modificato_da) {
    return prisma.evento.update({
        where: { id: evento_id },
        data: {
            tags: { disconnect: { id: tag_id } },
            modificatore: { connect: { id: modificato_da } },
        },
        include: tagEvento,
    });
}

module.exports = {
    createEvento,
    getEventoById,
    getEventiByCalendario,
    getEventiByTag,
    getEventiFuturiConAvviso,
    updateEvento,
    updateSerie,
    deleteEvento,
    deleteSerieCompleta,
    addTag,
    removeTag,
};