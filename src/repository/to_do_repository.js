
const prisma = require('../persistence/db_config');

// Elementi inclusi nel todo, in ordine di posizione
const ordineElementi = {
    elementi: { orderBy: { posizione: 'asc' } },
};

// Creazione nuovo todo
async function createTodo(dati) {
    return prisma.todo.create({ data: dati, include: ordineElementi });
}

// Visualizza todo tramite id
async function getTodoById(id) {
    return prisma.todo.findUnique({
        where: { id },
        include: ordineElementi,
    });
}

// Visualizza tutti i todo di un calendario, con i soli dati degli elementi che servono per i conteggi
async function getTodosByCalendario(calendario_id) {
    return prisma.todo.findMany({
        where: { calendario_id },
        include: {
            elementi: { select: { completato: true } },
        },
    });
}

// Trova l'ultima posizione usata tra i todo del calendario, cioè il numero più grande (null se non ce ne sono ancora), 
// serve per mettere in fondo un nuovo todo creato senza posizione
async function getUltimaPosizione(calendario_id) {
    const ultimoTodo = await prisma.todo.findFirst({
        where: { calendario_id },
        orderBy: { posizione: 'desc' },
        select: { posizione: true },
    });

    return ultimoTodo ? ultimoTodo.posizione : null;
}

// Modifica dati di un todo
async function updateTodo(id, dati) {
    return prisma.todo.update({ where: { id }, data: dati, include: ordineElementi });
}

// Eliminazione todo insieme ai suoi elementi, in un'unica transazione
async function deleteTodo(id) {
    return prisma.$transaction([
        prisma.elementoToDo.deleteMany({ where: { todo_id: id } }),
        prisma.todo.delete({ where: { id } }),
    ]);
}

module.exports = {
    createTodo,
    getTodoById,
    getTodosByCalendario,
    getUltimaPosizione,
    updateTodo,
    deleteTodo,
};