
const prisma = require('../persistence/db_config');

// Tag collegati nell'evento, solo con i dati che servono nella risposta
const tagEvento = {
    tags: { select: { id: true, nome: true, colore: true } },
};

// Creazione di un evento e delle sue eventuali occorrenze, in un'unica transazione (o vengono creati tutti, o nessuno)
// Il padre si crea con create: connect lo collega al creatore e ai calendari, scrivendo l'id in tutti e due i lati
// Le occorrenze si creano tutte insieme con createMany (molto più veloce con serie lunghe):
// createMany non sa usare connect, quindi scrivo io gli id e poi aggiungo le occorrenze alla lista degli eventi di ogni calendario
async function createEvento(dati, occorrenze, calendario_ids, creato_da) {
    return prisma.$transaction(async (tx) => {
        const eventoPadre = await tx.evento.create({
            data: {
                ...dati,
                creatore: { connect: { id: creato_da } },
                calendari: { connect: calendario_ids.map(id => ({ id })) },
            },
            include: tagEvento,
        });

        if (occorrenze.length > 0) {
            await tx.evento.createMany({
                data: occorrenze.map(occorrenza => ({
                    ...occorrenza,
                    creato_da,
                    calendario_ids,
                    evento_padre_id: eventoPadre.id,
                })),
            });

            // createMany restituisce solo quanti eventi ha creato, non i loro id:
            // li rileggo cercando gli eventi che hanno come padre quello appena creato (mi servono per i calendari)
            const occorrenzeCreate = await tx.evento.findMany({
                where: { evento_padre_id: eventoPadre.id },
                select: { id: true },
            });
            const ids = occorrenzeCreate.map(occorrenza => occorrenza.id);

            // Aggiungo le occorrenze alla lista degli eventi di ogni calendario
            for (const calendario_id of calendario_ids) {
                await tx.calendario.update({
                    where: { id: calendario_id },
                    data: { evento_ids: { push: ids } },
                });
            }
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
// I dati uguali per tutte (titolo, colore...) si scrivono con un solo updateMany
// Le date invece sono diverse per ogni occorrenza (vengono spostate della stessa "quantità" in millisecondi),
// quindi le mando tutte insieme con un unico comando (update con la lista di tutte le modifiche)
async function updateSerie(evento_padre_id, dati, spostamentoInizio, spostamentoFine) {
    return prisma.$transaction(async (tx) => {
        const occorrenze = await tx.evento.findMany({
            where: {
                OR: [
                    { id: evento_padre_id },
                    { evento_padre_id: evento_padre_id },
                ],
            },
            select: { id: true, data_inizio: true, data_fine: true, data_occorrenza_originale: true },
        });

        const ids = occorrenze.map(occorrenza => occorrenza.id);

        await tx.evento.updateMany({
            where: { id: { in: ids } },
            data: dati,
        });

        if (spostamentoInizio !== 0 || spostamentoFine !== 0) {
            // Comando: per ogni occorrenza dico quale evento cercare ($oid = id) e le nuove date da scrivere ($date)
            await tx.$runCommandRaw({
                update: 'Evento',
                updates: occorrenze.map(occorrenza => {
                    const nuoveDate = {
                        data_inizio: { $date: new Date(occorrenza.data_inizio.getTime() + spostamentoInizio).toISOString() },
                        data_fine: { $date: new Date(occorrenza.data_fine.getTime() + spostamentoFine).toISOString() },
                    };

                    if (occorrenza.data_occorrenza_originale) {
                        nuoveDate.data_occorrenza_originale = { $date: new Date(occorrenza.data_occorrenza_originale.getTime() + spostamentoInizio).toISOString() };
                    }

                    return {
                        q: { _id: { $oid: occorrenza.id } },
                        u: { $set: nuoveDate },
                    };
                }),
            });
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
// deleteMany non scollega gli eventi da calendari e tag, quindi tolgo io i loro id dalle liste evento_ids di calendari e tag,
// poi elimino le figlie tutte insieme e infine il padre
async function deleteSerieCompleta(evento_padre_id) {
    return prisma.$transaction(async (tx) => {
        const occorrenze = await tx.evento.findMany({
            where: {
                OR: [
                    { id: evento_padre_id },
                    { evento_padre_id: evento_padre_id },
                ],
            },
            select: { id: true, calendario_ids: true, tag_ids: true },
        });

        // Id di tutte le occorrenze della serie: servono per eliminare le notifiche e per toglierle dalle liste di calendari e tag
        const ids = occorrenze.map(occorrenza => occorrenza.id);
        // Stessi id in un Set, che controlla molto più velocemente se un id è tra quelli da togliere
        const idsDaTogliere = new Set(ids);

        // Gli avvisi delle occorrenze eliminate non servono più
        await tx.notifica.deleteMany({ where: { evento_id: { in: ids } } });

        // Calendari e tag collegati alla serie, ognuno una volta sola
        const calendarioIds = [...new Set(occorrenze.flatMap(occorrenza => occorrenza.calendario_ids))];
        const tagIds = [...new Set(occorrenze.flatMap(occorrenza => occorrenza.tag_ids))];

        for (const calendario_id of calendarioIds) {
            const calendario = await tx.calendario.findUnique({ where: { id: calendario_id }, select: { evento_ids: true } });
            if (!calendario) continue;

            await tx.calendario.update({
                where: { id: calendario_id },
                data: { evento_ids: { set: calendario.evento_ids.filter(id => !idsDaTogliere.has(id)) } },
            });
        }

        for (const tag_id of tagIds) {
            const tag = await tx.tag.findUnique({ where: { id: tag_id }, select: { evento_ids: true } });
            if (!tag) continue;

            await tx.tag.update({
                where: { id: tag_id },
                data: { evento_ids: { set: tag.evento_ids.filter(id => !idsDaTogliere.has(id)) } },
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

// Aggiunge un tag a tutta una serie ricorrente (padre + occorrenze), in un'unica transazione le occorrenze che hanno già il tag si saltano
// Uso updateMany invece di un update per occorrenza (molto più veloce con serie lunghe):
// updateMany non sa usare connect, quindi aggiorno a mano tutti e due i lati della relazione (tag_ids negli eventi, evento_ids nel tag)
async function addTagSerie(evento_padre_id, tag_id, modificato_da) {
    return prisma.$transaction(async (tx) => {
        const serie = await tx.evento.findMany({
            where: {
                OR: [
                    { id: evento_padre_id },
                    { evento_padre_id: evento_padre_id },
                ],
            },
            select: { id: true, tag_ids: true },
        });

        // Tengo solo gli id delle occorrenze che non hanno ancora il tag
        const ids = serie
            .filter(occorrenza => !occorrenza.tag_ids.includes(tag_id))
            .map(occorrenza => occorrenza.id);

        if (ids.length > 0) {
            // Aggiungo il tag a tutte le occorrenze con una sola query
            await tx.evento.updateMany({
                where: { id: { in: ids } },
                data: {
                    tag_ids: { push: tag_id },
                    modificato_da,
                },
            });

            // Aggiungo le occorrenze alla lista degli eventi del tag
            await tx.tag.update({
                where: { id: tag_id },
                data: { evento_ids: { push: ids } },
            });
        }

        return ids.length;
    }, { timeout: 60000 });
}

// Rimuove un tag da tutta una serie ricorrente (padre + occorrenze), in un'unica transazione, le occorrenze che non hanno il tag si saltano
// Prisma non ha un comando per togliere un solo valore da una lista, quindi calcolo io la nuova lista e updateMany dà a tutte le occorrenze esattamente gli stessi tag:
// per questo raggruppo le occorrenze che alla fine devono avere gli stessi tag e faccio un updateMany per gruppo
// (di solito il gruppo è uno solo, ne serve un altro solo se un'occorrenza ha un tag diverso)
async function removeTagSerie(evento_padre_id, tag_id, modificato_da) {
    return prisma.$transaction(async (tx) => {
        const serie = await tx.evento.findMany({
            where: {
                OR: [
                    { id: evento_padre_id },
                    { evento_padre_id: evento_padre_id },
                ],
            },
            select: { id: true, tag_ids: true },
        });

        // Tengo solo le occorrenze che hanno il tag
        const occorrenze = serie.filter(occorrenza => occorrenza.tag_ids.includes(tag_id));

        // Per ogni occorrenza calcolo i tag che le restano e la metto nel gruppo giusto.
        // Ogni gruppo prende il nome dai tag che restano, scritti come testo: [id1, id2] --> "id1,id2"
        const gruppi = new Map();
        for (const occorrenza of occorrenze) {
            const tagRimasti = occorrenza.tag_ids.filter(id => id !== tag_id);
            const nomeGruppo = tagRimasti.join(',');

            if (!gruppi.has(nomeGruppo)) {
                gruppi.set(nomeGruppo, { tagRimasti, ids: [] });
            }

            gruppi.get(nomeGruppo).ids.push(occorrenza.id);
        }

        for (const gruppo of gruppi.values()) {
            await tx.evento.updateMany({
                where: { id: { in: gruppo.ids } },
                data: {
                    tag_ids: { set: gruppo.tagRimasti },
                    modificato_da,
                },
            });
        }

        // Tolgo le occorrenze dalla lista degli eventi del tag
        if (occorrenze.length > 0) {
            const ids = occorrenze.map(occorrenza => occorrenza.id);
            const tag = await tx.tag.findUnique({
                where: { id: tag_id },
                select: { evento_ids: true },
            });

            await tx.tag.update({
                where: { id: tag_id },
                data: { evento_ids: { set: tag.evento_ids.filter(id => !ids.includes(id)) } },
            });
        }

        return occorrenze.length;
    }, { timeout: 60000 });
}

// Visualizza gli eventi di più calendari che si sovrappongono a un periodo, in ordine di data (usato per il riepilogo di oggi)
// Un evento è di oggi se ne tocca anche solo un pezzo: non deve finire prima che oggi inizi (da), né iniziare dopo che oggi finisce (fino)
async function getEventiByCalendari(calendario_ids, da, fino) {
    return prisma.evento.findMany({
        where: {
            calendario_ids: { hasSome: calendario_ids },
            data_fine: { gte: da },
            data_inizio: { lt: fino },
        },
        include: tagEvento,
        orderBy: { data_inizio: 'asc' },
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
    addTagSerie,
    removeTagSerie,
    getEventiByCalendari
};