
const prisma = require('../persistence/db_config');

// Creazione nuova nota
async function createNota(dati) {
    return prisma.nota.create({ data: dati });
}

// Ricerca nota tramite id
async function getNotaById(id) {
    return prisma.nota.findUnique({ where: { id } });
}

// Ricerca di tutte le note di un calendario
async function getNoteByCalendario(calendario_id) {
    return prisma.nota.findMany({ where: { calendario_id } });
}

// Modifica dati di una nota
async function updateNota(id, dati) {
    return prisma.nota.update({ where: { id }, data: dati });
}

// Eliminazione nota
async function deleteNota(id) {
    return prisma.nota.delete({ where: { id } });
}

module.exports = {
    createNota,
    getNotaById,
    getNoteByCalendario,
    updateNota,
    deleteNota,
};