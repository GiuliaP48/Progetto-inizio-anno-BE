
const prisma = require('../persistence/db_config');

// Creazione nuovo tag
async function createTag(dati) {
    return prisma.tag.create({ data: dati });
}

// Ricerca tag tramite id
async function getTagById(id) {
    return prisma.tag.findUnique({ where: { id } });
}

// Ricerca di tutti i tag di un calendario
async function getTagsByCalendario(calendario_id) {
    return prisma.tag.findMany({ where: { calendario_id } });
}

// Modifica dati di un tag
async function updateTag(id, dati) {
    return prisma.tag.update({ where: { id }, data: dati });
}

// Eliminazione di un tag, in un'unica transazione
// prima di eliminarlo lo si scollega da tutti i suoi eventi (set: [] toglie il suo id anche dalle liste degli eventi)
async function deleteTag(id) {
    return prisma.$transaction([
        prisma.tag.update({ where: { id }, data: { eventi: { set: [] } } }),
        prisma.tag.delete({ where: { id } }),
    ]);
}

module.exports = {
    createTag,
    getTagById,
    getTagsByCalendario,
    updateTag,
    deleteTag,
};