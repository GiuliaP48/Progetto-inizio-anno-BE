
const prisma = require('../persistence/db_config');

// Creazione nuovo elemento todo
async function createElementoToDo(dati) {
    return prisma.elementoToDo.create({ data: dati });
}

// Ricerca elemento todo tramite id
async function getElementoToDoById(id) {
    return prisma.elementoToDo.findUnique({ where: { id } });
}

// Ricerca di tutti gli elementi todo di un todo
async function getElementiToDoByTodo(todo_id) {
    return prisma.elementoToDo.findMany({ where: { todo_id } });
}

// Trova l'ultima posizione usata tra gli elementi del todo, cioè il numero più grande (null se non ce ne sono ancora),
// serve per mettere in fondo un nuovo elemento creato senza posizione
async function getUltimaPosizione(todo_id) {
    const ultimoElemento = await prisma.elementoToDo.findFirst({
        where: { todo_id },
        orderBy: { posizione: 'desc' },
        select: { posizione: true },
    });

    return ultimoElemento ? ultimoElemento.posizione : null;
}

// Modifica dati di un elemento todo
async function updateElementoToDo(id, dati) {
    return prisma.elementoToDo.update({ where: { id }, data: dati });
}

// Eliminazione elemento todo
async function deleteElementoToDo(id) {
    return prisma.elementoToDo.delete({ where: { id } });
}

module.exports = {
    createElementoToDo,
    getElementoToDoById,
    getElementiToDoByTodo,
    getUltimaPosizione,
    updateElementoToDo,
    deleteElementoToDo,
};