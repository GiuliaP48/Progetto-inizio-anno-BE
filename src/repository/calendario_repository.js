
const prisma = require('../persistence/db_config');

// Creazione nuovo calendario
async function createCalendario(dati) {
    return prisma.calendario.create({ data: dati });
}

// Ricerca calendario tramite id
async function getCalendarioById(id) {
    return prisma.calendario.findUnique({ where: { id } });
}

// Ricerca di tutti i calendari di cui l'utente è amministratore
async function getCalendariByAmministratore(utente_id) {
    return prisma.calendario.findMany({ where: { utente_id } });
}

// Modifica dati di un calendario (nome, colore, permesso_modifica...)
async function updateCalendario(id, dati) {
    return prisma.calendario.update({ where: { id }, data: dati });
}

// Eliminazione di un calendario e di tutto quello che contiene, in un'unica transazione (o viene eliminato tutto, o niente)
// Gli eventi che sono anche in altri calendari non vengono eliminati: perdono solo questo calendario e i suoi tag
async function deleteCalendario(id) {
    return prisma.$transaction(async (tx) => {
        // Todo ed elementi: prima gli elementi, poi i todo
        const todos = await tx.todo.findMany({
            where: { calendario_id: id },
            select: { id: true },
        });

        await tx.elementoToDo.deleteMany({ where: { todo_id: { in: todos.map(todo => todo.id) } } });
        await tx.todo.deleteMany({ where: { calendario_id: id } });

        await tx.nota.deleteMany({ where: { calendario_id: id } });

        // Id dei tag del calendario: servono per toglierli dagli eventi che restano in altri calendari
        const tags = await tx.tag.findMany({
            where: { calendario_id: id },
            select: { id: true },
        });
        const tagIds = tags.map(tag => tag.id);

        const eventi = await tx.evento.findMany({
            where: { calendario_ids: { has: id } },
            select: { id: true, calendario_ids: true, tag_ids: true },
        });

        // Divido gli eventi: quelli solo in questo calendario si eliminano, quelli anche in altri calendari restano
        const eventiDaEliminare = eventi.filter(evento => evento.calendario_ids.length === 1);
        const eventiDaScollegare = eventi.filter(evento => evento.calendario_ids.length > 1);

        // Gli eventi che sono anche in altri calendari non si eliminano: tolgo solo questo calendario e i suoi tag
        // con disconnect toglgo il collegamento da tutti e due i lati: dall'evento e dal calendario o dal tag
        for (const evento of eventiDaScollegare) {
            const tagDaTogliere = evento.tag_ids.filter(tag_id => tagIds.includes(tag_id));

            await tx.evento.update({
                where: { id: evento.id },
                data: {
                    calendari: { disconnect: { id } },
                    tags: { disconnect: tagDaTogliere.map(tag_id => ({ id: tag_id })) },
                },
            });
        }

        const idEventiDaEliminare = eventiDaEliminare.map(evento => evento.id);

        // Gli avvisi degli eventi eliminati non servono più
        await tx.notifica.deleteMany({ where: { evento_id: { in: idEventiDaEliminare } } });

        // Prima di eliminarli li scollego da calendari e tag (set: [] toglie il loro id anche dalle liste di calendari e tag)
        for (const evento_id of idEventiDaEliminare) {
            await tx.evento.update({
                where: { id: evento_id },
                data: { calendari: { set: [] }, tags: { set: [] } },
            });
        }

        // Prima le occorrenze figlie, poi gli eventi padri
        await tx.evento.deleteMany({ where: { evento_padre_id: { in: idEventiDaEliminare } } });
        await tx.evento.deleteMany({ where: { id: { in: idEventiDaEliminare } } });

        await tx.tag.deleteMany({ where: { calendario_id: id } });

        await tx.preferenzaVista.deleteMany({ where: { calendario_id: id } });

        // Inviti, rimozioni e uscite di questo calendario non servono più
        await tx.notifica.deleteMany({ where: { calendario_id: id } });

        return tx.calendario.delete({ where: { id } });
    }, { timeout: 60000 });
}

// Aggiunta nuovo membro all'array membri di un calendario
async function addMembro(calendario_id, membro) {
    return prisma.calendario.update({
        where: { id: calendario_id },
        data: {
            membri: {
                push: membro,
            },
        },
    });
}

// Aggiornamento dell'intero array membri, la uso quando cambia qualcosa di un solo membro 
async function updateMembri(calendario_id, nuoviMembri) {
    return prisma.calendario.update({
        where: { id: calendario_id },
        data: {
            membri: nuoviMembri,
        },
    });
}

// Rimozione di un membro insieme alla sua preferenza vista per quel calendario, in un'unica transazione (o si fanno tutte e due, o nessuna)
async function rimuoviMembro(calendario_id, nuoviMembri, membro_id) {
    const [calendarioAggiornato] = await prisma.$transaction([
        prisma.calendario.update({
            where: { id: calendario_id },
            data: { membri: nuoviMembri },
        }),
        prisma.preferenzaVista.deleteMany({
            where: { utente_id: membro_id, calendario_id },
        }),
    ]);

    return calendarioAggiornato;
}

// Ricerca di tutti i calendari dove l'utente è membro con invito accettato (proprietario ESCLUSO)
async function getCalendariByMembro(utente_id) {
    return prisma.calendario.findMany({
        where: {
            membri: {
                some: {
                    utente_id: utente_id,
                    stato_invito: 'accettato',
                },
            },
        },
    });
}

// Ricerca di tutti i calendari in cui l'utente compare tra i membri, con qualsiasi stato dell'invito (usato quando si elimina l'account)
async function getCalendariConMembro(utente_id) {
    return prisma.calendario.findMany({
        where: { membri: { some: { utente_id } } },
    });
}

module.exports = {
    createCalendario,
    getCalendarioById,
    getCalendariByAmministratore,
    updateCalendario,
    deleteCalendario,
    addMembro,
    updateMembri,
    rimuoviMembro,
    getCalendariByMembro,
    getCalendariConMembro
};